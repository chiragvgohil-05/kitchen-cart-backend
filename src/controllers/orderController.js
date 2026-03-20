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
        await createInvoice(order, invoicePath);
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
            throw buildError('One or more products are no longer available', 400);
        }

        if (product.stock < item.quantity) {
            throw buildError(`Insufficient stock for ${product.name}`, 400);
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
            throw buildError('Unable to reserve stock', 400);
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
        const { orderType, table } = req.body;
        const paymentMethod = getValidPaymentMethod(req.body.paymentMethod);
        const shouldUseWallet = paymentMethod !== 'COD' && req.body.useWallet !== false;
        
        let shippingAddress = {};
        if (orderType === 'Delivery') {
            shippingAddress = getProfileAddressForOrder(req.user);
            if (!isAddressComplete(shippingAddress)) {
                return sendResponse(res, 400, false, 'Please add complete address for delivery');
            }
        }

        if (orderType === 'Dine-in' && !table) {
            return sendResponse(res, 400, false, 'Please select a table for dine-in');
        }

        const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return sendResponse(res, 400, false, 'No items in cart');
        }

        const orderItems = cart.items
            .filter(item => item.product)
            .map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.sellingPrice || 0
            }));

        const totalAmount = Number(orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2));

        let walletUsed = 0;
        if (shouldUseWallet) {
            const userForWallet = await User.findById(req.user.id).select('walletBalance');
            walletUsed = Math.min(userForWallet?.walletBalance || 0, totalAmount);
        }

        const gatewayAmount = Number(Math.max(0, totalAmount - walletUsed).toFixed(2));

        let razorpayOrder = null;
        if (paymentMethod === 'Razorpay' && gatewayAmount > 0) {
            const amountInPaise = Math.round(gatewayAmount * 100);
            razorpayOrder = await instance.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `rcpt_${Date.now()}`
            });
        }

        const createdOrder = await runWithOptionalTransaction(async (session) => {
            await ensureStockAvailable(orderItems, session);

            const fullWalletPayment = paymentMethod !== 'COD' && gatewayAmount === 0;
            const effectivePaymentMethod = fullWalletPayment ? 'Wallet' : paymentMethod;
            const isImmediateOrder = paymentMethod === 'COD' || fullWalletPayment;

            const paymentResult = {};
            if (paymentMethod === 'COD') {
                paymentResult.status = 'COD';
            } else if (paymentMethod === 'Razorpay' && razorpayOrder) {
                paymentResult.razorpay_order_id = razorpayOrder.id;
                paymentResult.status = 'pending';
            } else if (fullWalletPayment) {
                paymentResult.status = 'Wallet';
            }

            const order = await createOrderDocument({
                user: req.user.id,
                items: orderItems,
                totalAmount,
                orderType: orderType || 'Takeaway',
                table: orderType === 'Dine-in' ? table : undefined,
                paymentMethod: effectivePaymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'cod' : (fullWalletPayment ? 'paid' : 'pending'),
                walletUsed,
                gatewayAmount,
                shippingAddress,
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

            return order;
        });

        if (paymentMethod === 'Razorpay' && gatewayAmount > 0) {
            return sendResponse(res, 201, true, 'Razorpay order created', {
                order: createdOrder,
                razorpayOrder,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID
            });
        }

        return sendResponse(res, 201, true, 'Order placed successfully', { order: createdOrder });
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
            return sendResponse(res, 400, false, 'Invalid order status');
        }

        const result = await runWithOptionalTransaction(async (session) => {
            const order = await withSession(Order.findById(req.params.id).populate('items.product'), session);
            if (!order) throw buildError('Order not found', 404);

            const oldStatus = order.status;

            if (oldStatus === 'Cancelled' && status !== 'Cancelled') {
                throw buildError('Cancelled order status cannot be changed', 400);
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
                order.status = status;
            }

            await saveWithSession(order, session);
            return { order };
        });

        return sendResponse(res, 200, true, 'Order status updated', result.order);
    } catch (err) {
        next(err);
    }
};

// ... existing methods like getMyOrders, getAllOrders, getOrderInvoice, verifyPayment ...
// For brevity, I'll only keep the modified parts and assume the rest are there as they were.
// Actually, it's better to rewrite the whole file to ensure nothing is broken.
// I'll append the rest of the functions from previous read.

exports.verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET).update(body).digest('hex');

        if (expectedSignature !== razorpay_signature) return sendResponse(res, 400, false, 'Invalid signature');

        const { order } = await runWithOptionalTransaction(async (session) => {
            const orderRecord = await withSession(Order.findOne({ _id: orderId, user: req.user.id }).populate('items.product'), session);
            if (!orderRecord) throw buildError('Order not found', 404);
            
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
        return sendResponse(res, 200, true, 'Payment verified', order);
    } catch (err) { next(err); }
};

exports.getMyOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).populate('items.product').populate('table');
        sendResponse(res, 200, true, 'Orders fetched', orders);
    } catch (err) { next(err); }
};

exports.getAllOrders = async (req, res, next) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).populate('user', 'name email').populate('items.product').populate('table');
        sendResponse(res, 200, true, 'All orders fetched', orders);
    } catch (err) { next(err); }
};

exports.getOrderInvoice = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.product').populate('user', 'name email');
        if (!order) return sendResponse(res, 404, false, 'Order not found');
        const { invoiceName, invoicePath } = await ensureInvoiceForOrder(order);
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

            if (!order) throw buildError('Order cannot be cancelled', 400);

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

        return sendResponse(res, 200, true, 'Order cancelled', result.order);
    } catch (err) { next(err); }
};

exports.verifyStripePayment = async (req, res, next) => {
    try {
        const { sessionId, orderId } = req.body;
        const stripe = getStripeClient();
        if (!stripe) return sendResponse(res, 400, false, 'Stripe not configured');

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') return sendResponse(res, 400, false, 'Payment not completed');

        const { order } = await runWithOptionalTransaction(async (dbSession) => {
            const orderRecord = await withSession(Order.findOne({ _id: orderId, user: req.user.id }).populate('items.product'), dbSession);
            if (!orderRecord) throw buildError('Order not found', 404);
            
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
        return sendResponse(res, 200, true, 'Stripe payment verified', order);
    } catch (err) { next(err); }
};

exports.getRazorpayOrderForPendingOrder = async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.user.id, status: 'Pending' });
        if (!order) return sendResponse(res, 404, false, 'Eligible order not found');

        if (order.gatewayAmount <= 0) return sendResponse(res, 400, false, 'No payment required');

        const amountInPaise = Math.round(order.gatewayAmount * 100);
        const razorpayOrder = await instance.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_retry_${order._id}_${Date.now()}`
        });

        return sendResponse(res, 200, true, 'Razorpay retry order created', {
            razorpayOrder,
            order,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) { next(err); }
};
