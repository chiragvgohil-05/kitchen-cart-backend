const crypto = require('crypto');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const Table = require('../models/tableModel');
const instance = require('../config/razorpay');
const transporter = require('../config/nodemailer');
const createInvoice = require('../utils/invoiceGenerator');
const sendResponse = require('../utils/responseHandler');
const { creditWallet, debitWallet } = require('../services/walletService');
const { runWithOptionalTransaction } = require('../services/transactionService');
const { addPointsForOrder, redeemRewardDuringCheckout } = require('../services/loyaltyService');
const Reward = require('../models/rewardModel');
const Setting = require('../models/settingModel');

const path = require('path');

const fs = require('fs');

let stripeClient = null;

const getStripeClient = () => {
    if (!process.env.STRIPE_SECRET_KEY) {
        return null;
    }

    if (stripeClient) {
        return stripeClient;
    }

    try {
        const Stripe = require('stripe');
        stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
        return stripeClient;
    } catch (error) {
        console.error('Stripe SDK is missing');
        return null;
    }
};

const withSession = (query, session) => (session ? query.session(session) : query);

const saveWithSession = async (doc, session) => {
    if (session) {
        return doc.save({ session });
    }
    return doc.save();
};

const buildError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const normalizeStringField = (value) => (
    typeof value === 'string' ? value.trim() : ''
);

const getProfileAddressForOrder = (user) => {
    const profileAddress = user?.address || {};
    return {
        name: normalizeStringField(user?.name),
        street: normalizeStringField(profileAddress.street),
        city: normalizeStringField(profileAddress.city),
        state: normalizeStringField(profileAddress.state),
        zipCode: normalizeStringField(profileAddress.zipCode),
        country: normalizeStringField(profileAddress.country)
    };
};

const isAddressComplete = (address) => {
    const requiredFields = ['street', 'city', 'state', 'zipCode', 'country'];
    return requiredFields.every(field => Boolean(address[field]));
};

const ensureInvoiceForOrder = async (order, options = {}) => {
    const force = Boolean(options.force);
    const invoiceDir = path.join(__dirname, '../../invoices');
    if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const invoiceName = `invoice_${order._id}.pdf`;
    const invoicePath = path.join(invoiceDir, invoiceName);

    if (force || !fs.existsSync(invoicePath)) {
        const settings = await Setting.findOne();
        await createInvoice(order, invoicePath, settings);
    }

    return { invoiceName, invoicePath };
};

const getValidPaymentMethod = (paymentMethod) => {
    if (['COD', 'Razorpay', 'Stripe'].includes(paymentMethod)) {
        return paymentMethod;
    }
    return 'COD';
};

const createOrderDocument = async (payload, session = null) => {
    if (session) {
        const [order] = await Order.create([payload], { session });
        return order;
    }
    return Order.create(payload);
};

const ensureStockAvailable = async (orderItems, session = null) => {
    for (const item of orderItems) {
        const productId = item.product?._id || item.product;
        const product = await withSession(
            Product.findById(productId).select('name stock'),
            session
        );

        if (!product) {
            throw buildError('One or more products in your order are no longer available in our inventory.', 400);
        }

        if (product.stock < item.quantity) {
            throw buildError(`Insufficient stock available for ${product.name}.`, 400);
        }
    }
};

const decreaseStockForOrderItems = async (orderItems, session = null) => {
    for (const item of orderItems) {
        const productId = item.product?._id || item.product;

        const updated = await withSession(
            Product.findOneAndUpdate(
                { _id: productId, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } },
                { new: true }
            ),
            session
        );

        if (!updated) {
            throw buildError('An error occurred while reserving stock for your order. Please try again.', 400);
        }
    }
};

const restoreStockForOrder = async (order, session = null) => {
    for (const item of order.items || []) {
        const productId = item.product?._id || item.product;
        await withSession(
            Product.findByIdAndUpdate(productId, { $inc: { stock: item.quantity } }),
            session
        );
    }
};

const getCancellationWalletCreditAmount = (order) => {
    const onlinePaidOrder = ['Razorpay', 'Stripe', 'Wallet'].includes(order.paymentMethod)
        && order.paymentStatus === 'paid';

    if (onlinePaidOrder) {
        return order.totalAmount;
    }

    if (order.walletUsed > 0) {
        return order.walletUsed;
    }

    return 0;
};

const sendOrderConfirmationEmail = async (order, user) => {
    if (!process.env.EMAIL_USER || !user?.email) {
        return;
    }

    const { invoiceName, invoicePath } = await ensureInvoiceForOrder(order, { force: true });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Order Confirmation - ${order.orderType} Order`,
        text: `Thank you for your order! Your order ID is ${order._id}. Type: ${order.orderType}`,
        attachments: [
            {
                filename: invoiceName,
                path: invoicePath,
                contentType: 'application/pdf'
            }
        ]
    };

    transporter.sendMail(mailOptions, (err) => {
        if (err) console.error('Error sending email:', err);
    });
};

// @desc    Create new order
exports.createOrder = async (req, res, next) => {
    try {
        const { orderType, table, rewardId } = req.body;
        const paymentMethod = getValidPaymentMethod(req.body.paymentMethod);
        const shouldUseWallet = paymentMethod !== 'COD' && req.body.useWallet !== false;

        let shippingAddress = {};
        if (orderType === 'Delivery') {
            shippingAddress = getProfileAddressForOrder(req.user);
            if (!isAddressComplete(shippingAddress)) {
                return sendResponse(res, 400, false, 'Valid shipping coordinates are required for delivery logistics.');
            }

        }

        if (orderType === 'Dine-in' && !table) {
            return sendResponse(res, 400, false, 'Please specify a table number for your dine-in experience.');
        }

        const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return sendResponse(res, 400, false, 'Cart is empty. Please select items from our curated menu.');
        }


        const orderItems = cart.items
            .filter(item => item.product)
            .map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.sellingPrice || 0
            }));

        const totalAmountBeforeDiscount = Number(orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2));

        let appliedReward = null;
        if (rewardId) {
            const reward = await Reward.findById(rewardId);
            if (!reward || !reward.isActive) {
                return sendResponse(res, 400, false, 'The selected reward is invalid or expired.');
            }
            const userForLoyalty = await User.findById(req.user.id).select('loyaltyPoints');
            if (!userForLoyalty || userForLoyalty.loyaltyPoints < reward.pointsRequired) {
                return sendResponse(res, 400, false, `Your loyalty balance is insufficient for this redemption. (Required: ${reward.pointsRequired})`);
            }

            appliedReward = reward;
        }

        // We need to calculate these values, but some depend on the transaction (reward redemption)
        // However, for Razorpay, we need a gatewayAmount before the final response.
        // We'll perform redemptions inside the transaction.

        const result = await runWithOptionalTransaction(async (session) => {
            await ensureStockAvailable(orderItems, session);

            let currentDiscount = 0;
            let finalAmount = totalAmountBeforeDiscount;

            if (appliedReward) {
                const loyaltyResult = await redeemRewardDuringCheckout({
                    userId: req.user.id,
                    reward: appliedReward,
                    orderAmount: totalAmountBeforeDiscount
                }, session);
                currentDiscount = loyaltyResult.discount;
                finalAmount = loyaltyResult.final_amount;
            }

            let walletUsed = 0;
            if (shouldUseWallet) {
                const userForWallet = await User.findById(req.user.id).session(session).select('walletBalance');
                walletUsed = Math.min(userForWallet?.walletBalance || 0, finalAmount);
            }

            const gatewayAmount = Number(Math.max(0, finalAmount - walletUsed).toFixed(2));
            const fullWalletPayment = paymentMethod !== 'COD' && gatewayAmount === 0;
            const effectivePaymentMethod = fullWalletPayment ? 'Wallet' : paymentMethod;
            const isImmediateOrder = paymentMethod === 'COD' || fullWalletPayment;

            const paymentResult = { status: paymentMethod === 'COD' ? 'COD' : (fullWalletPayment ? 'Wallet' : 'pending') };

            const order = await createOrderDocument({
                user: req.user.id,
                items: orderItems,
                totalAmount: finalAmount,
                orderType: orderType || 'Takeaway',
                table: orderType === 'Dine-in' ? table : undefined,
                paymentMethod: effectivePaymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'cod' : (fullWalletPayment ? 'paid' : 'pending'),
                walletUsed,
                gatewayAmount,
                shippingAddress,
                reward: appliedReward?._id,
                discountAmount: currentDiscount,
                paymentResult,
                status: isImmediateOrder ? 'Confirmed' : 'Pending'
            }, session);

            if (walletUsed > 0) {
                await debitWallet({
                    userId: req.user.id,
                    amount: walletUsed,
                    reason: `Payment for order ${order._id}`,
                    orderId: order._id
                }, { session });
            }

            if (isImmediateOrder) {
                await decreaseStockForOrderItems(order.items, session);
                order.inventoryAdjusted = true;
                await saveWithSession(order, session);
                await withSession(Cart.findOneAndDelete({ user: req.user.id }), session);
            }

            return { order, gatewayAmount };
        });

        const { order, gatewayAmount } = result;

        // Ensure order is fully populated for the confirmation email and invoice
        const populatedOrder = await Order.findById(order._id).populate('table').populate('reward').populate('items.product');

        // If Razorpay is needed, we create the gateway order AFTER the local order is committed 
        // OR we can do it inside but it's risky if Razorpay succeeds but local transaction fails.
        // Actually, the previous code created it before. Let's create it now.
        let razorpayOrder = null;
        if (paymentMethod === 'Razorpay' && gatewayAmount > 0) {
            const amountInPaise = Math.round(gatewayAmount * 100);
            razorpayOrder = await instance.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `rcpt_${order._id}`
            });

            // Update order with razorpay_order_id
            order.paymentResult.razorpay_order_id = razorpayOrder.id;
            await order.save();
        }

        if (razorpayOrder) {
            return sendResponse(res, 201, true, 'Payment gateway order initialized.', {
                order,
                razorpayOrder,
                gatewayAmount,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID
            });
        }

        await sendOrderConfirmationEmail(populatedOrder, req.user);
        return sendResponse(res, 201, true, 'Your order has been placed successfully. Thank you for choosing SnowEra Cafe!', { order });
    } catch (err) {
        next(err);
    }
};


// @desc    Update order status (By Staff/Admin)
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served', 'Shipped', 'Delivered', 'Cancelled'];

        if (!allowedStatuses.includes(status)) {
            return sendResponse(res, 400, false, 'The provided order status is not valid.');
        }

        const result = await runWithOptionalTransaction(async (session) => {
            const order = await withSession(Order.findById(req.params.id).populate('items.product'), session);
            if (!order) throw buildError('The specified order record could not be found.', 404);

            const oldStatus = order.status;

            if (oldStatus === 'Cancelled' && status !== 'Cancelled') {
                throw buildError('The status of a cancelled order cannot be modified.', 400);
            }

            if (status === 'Cancelled') {
                order.status = 'Cancelled';
                order.cancelledAt = new Date();

                let walletCredited = getCancellationWalletCreditAmount(order);
                if (walletCredited > 0) {
                    await creditWallet({
                        userId: order.user,
                        amount: walletCredited,
                        reason: `Refund for order ${order._id}`,
                        orderId: order._id
                    }, { session });
                }

                if (order.inventoryAdjusted) {
                    await restoreStockForOrder(order, session);
                    order.inventoryAdjusted = false;
                }
            } else {
                // Moving to confirmed or beyond means payment is settled for COD/Wallet if needed
                if (status !== 'Pending' && oldStatus === 'Pending') {
                    if (!order.inventoryAdjusted) {
                        await ensureStockAvailable(order.items, session);
                        await decreaseStockForOrderItems(order.items, session);
                        order.inventoryAdjusted = true;
                    }
                    if (order.paymentStatus !== 'paid' && order.paymentMethod !== 'COD') {
                        order.paymentStatus = 'paid';
                    }
                }

                // Loyalty Points Logic
                const isNewlyCompleted = (status === 'Delivered' || status === 'Served') &&
                    (oldStatus !== 'Delivered' && oldStatus !== 'Served');

                if (isNewlyCompleted && order.user) {
                    await addPointsForOrder({
                        userId: order.user,
                        orderId: order._id,
                        amount: order.totalAmount
                    }, session);
                }

                order.status = status;
            }


            await saveWithSession(order, session);
            return { order };
        });

        return sendResponse(res, 200, true, 'The order status has been successfully updated.', result.order);
    } catch (err) {
        next(err);
    }
};

exports.verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET).update(body).digest('hex');

        if (expectedSignature !== razorpay_signature) return sendResponse(res, 400, false, 'Payment verification failed due to an invalid security signature.');

        const { order } = await runWithOptionalTransaction(async (session) => {
            const orderRecord = await withSession(Order.findOne({ _id: orderId, user: req.user.id }).populate('items.product').populate('table').populate('reward'), session);
            if (!orderRecord) throw buildError('The specified order record could not be found.', 404);

            orderRecord.paymentStatus = 'paid';
            orderRecord.status = 'Confirmed';
            if (!orderRecord.inventoryAdjusted) {
                await ensureStockAvailable(orderRecord.items, session);
                await decreaseStockForOrderItems(orderRecord.items, session);
                orderRecord.inventoryAdjusted = true;
            }
            await saveWithSession(orderRecord, session);
            await withSession(Cart.findOneAndDelete({ user: req.user.id }), session);
            return { order: orderRecord };
        });

        await sendOrderConfirmationEmail(order, req.user);
        return sendResponse(res, 200, true, 'Your payment has been successfully verified, and the order is confirmed.', order);
    } catch (err) { next(err); }
};

exports.getMyOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).populate('items.product').populate('table').populate('reward');
        sendResponse(res, 200, true, 'Your order history has been retrieved successfully.', orders);
    } catch (err) { next(err); }
};

exports.getAllOrders = async (req, res, next) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).populate('user', 'name email').populate('items.product').populate('table').populate('reward');
        sendResponse(res, 200, true, 'All system orders have been retrieved successfully.', orders);
    } catch (err) { next(err); }
};

exports.getOrderInvoice = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.product').populate('user', 'name email').populate('table').populate('reward');
        if (!order) return sendResponse(res, 404, false, 'The specified order record could not be found.');
        const { invoiceName, invoicePath } = await ensureInvoiceForOrder(order, { force: true });
        return res.download(invoicePath, invoiceName);
    } catch (err) { next(err); }
};

exports.cancelMyOrder = async (req, res, next) => {
    try {
        const result = await runWithOptionalTransaction(async (session) => {
            const order = await withSession(Order.findOneAndUpdate(
                { _id: req.params.id, user: req.user.id, status: { $in: ['Pending', 'Confirmed'] } },
                { $set: { status: 'Cancelled', cancelledAt: new Date() } },
                { new: true }
            ).populate('items.product'), session);

            if (!order) throw buildError('This order is either already processed or does not exist, and cannot be cancelled.', 400);

            let walletCredited = getCancellationWalletCreditAmount(order);
            if (walletCredited > 0) {
                await creditWallet({ userId: order.user, amount: walletCredited, reason: `Refund for order ${order._id}`, orderId: order._id }, { session });
            }

            if (order.inventoryAdjusted) {
                await restoreStockForOrder(order, session);
                order.inventoryAdjusted = false;
            }
            await saveWithSession(order, session);
            return { order, walletCredited };
        });

        return sendResponse(res, 200, true, 'Your order has been successfully cancelled, and any applicable refund has been initiated.', result.order);
    } catch (err) { next(err); }
};

exports.verifyStripePayment = async (req, res, next) => {
    try {
        const { sessionId, orderId } = req.body;
        const stripe = getStripeClient();
        if (!stripe) return sendResponse(res, 400, false, 'Stripe payment system is currently not configured.');

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') return sendResponse(res, 400, false, 'We could not confirm your payment. Please check your transaction status.');

        const { order } = await runWithOptionalTransaction(async (dbSession) => {
            const orderRecord = await withSession(Order.findOne({ _id: orderId, user: req.user.id }).populate('items.product').populate('table').populate('reward'), dbSession);
            if (!orderRecord) throw buildError('The specified order record could not be found.', 404);

            orderRecord.paymentStatus = 'paid';
            orderRecord.status = 'Confirmed';
            if (!orderRecord.inventoryAdjusted) {
                await ensureStockAvailable(orderRecord.items, dbSession);
                await decreaseStockForOrderItems(orderRecord.items, dbSession);
                orderRecord.inventoryAdjusted = true;
            }
            await saveWithSession(orderRecord, dbSession);
            await withSession(Cart.findOneAndDelete({ user: req.user.id }), dbSession);
            return { order: orderRecord };
        });

        await sendOrderConfirmationEmail(order, req.user);
        return sendResponse(res, 200, true, 'Your Stripe payment has been successfully verified, and the order is confirmed.', order);
    } catch (err) { next(err); }
};

exports.getRazorpayOrderForPendingOrder = async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.user.id, status: 'Pending' });
        if (!order) return sendResponse(res, 404, false, 'Eligible order not found.');

        if (order.gatewayAmount <= 0) return sendResponse(res, 400, false, 'No payment required for this order.');

        const amountInPaise = Math.round(order.gatewayAmount * 100);
        const receipt = `ret_${order._id.toString().slice(-10)}_${Date.now()}`;
        console.log('Creating Razorpay Order:', { amountInPaise, receipt });

        const razorpayOrder = await instance.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: receipt
        });

        return sendResponse(res, 200, true, 'Retry payment initialized successfully.', {
            razorpayOrder,
            order,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('Razorpay Retry Error:', {
            message: err.message,
            statusCode: err.statusCode,
            description: err.error?.description,
            metadata: err.error?.metadata
        });
        next(err);
    }
};
