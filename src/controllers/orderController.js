const crypto = require('crypto');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
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
        // Lazy require so backend can run without Stripe SDK until configured.
        const Stripe = require('stripe');
        stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
        return stripeClient;
    } catch (error) {
        console.error('Stripe SDK is missing. Install `stripe` package to enable Stripe payments.');
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
            throw buildError('Unable to reserve stock for one or more products', 400);
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
        // Refund only the wallet deduction for unpaid/partially paid orders.
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
        subject: 'Order Confirmation - Kitchen Cart',
        text: `Thank you for your order! Your order ID is ${order._id}. Please find the invoice attached.`,
        attachments: [
            {
                filename: invoiceName,
                path: invoicePath,
                contentType: 'application/pdf'
            }
        ]
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email:', err);
            return;
        }

        console.log('Email sent:', info.response);
    });
};

// @desc    Create new order (supports COD, Razorpay, Stripe + wallet usage)
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
    try {
        const paymentMethod = getValidPaymentMethod(req.body.paymentMethod);
        const shouldUseWallet = paymentMethod !== 'COD' && req.body.useWallet !== false;
        const shippingAddress = getProfileAddressForOrder(req.user);

        if (!isAddressComplete(shippingAddress)) {
            return sendResponse(
                res,
                400,
                false,
                'Please add your complete address in profile before placing an order'
            );
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

        if (orderItems.length === 0) {
            return sendResponse(res, 400, false, 'Cart items are not valid');
        }

        const totalAmount = Number(orderItems.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        ).toFixed(2));

        if (totalAmount <= 0) {
            return sendResponse(res, 400, false, 'Order total must be greater than zero');
        }

        let walletUsed = 0;
        if (shouldUseWallet) {
            const userForWallet = await User.findById(req.user.id).select('walletBalance');
            if (!userForWallet) {
                return sendResponse(res, 404, false, 'User not found');
            }
            walletUsed = Math.min(userForWallet.walletBalance || 0, totalAmount);
        }

        const gatewayAmount = Number(Math.max(0, totalAmount - walletUsed).toFixed(2));

        let razorpayOrder = null;
        let stripePaymentIntent = null;

        if (paymentMethod === 'Razorpay' && gatewayAmount > 0) {
            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
                return sendResponse(res, 500, false, 'Razorpay is not configured on the server');
            }

            const amountInPaise = Math.round(gatewayAmount * 100);
            if (amountInPaise < 100) {
                return sendResponse(res, 400, false, 'Minimum online payable amount is Rs 1.00');
            }

            razorpayOrder = await instance.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `receipt_order_${Date.now()}`
            });
        }

        if (paymentMethod === 'Stripe' && gatewayAmount > 0) {
            const stripe = getStripeClient();
            if (!stripe) {
                return sendResponse(
                    res,
                    500,
                    false,
                    'Stripe is not configured. Add STRIPE_SECRET_KEY and install stripe package'
                );
            }

            stripePaymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(gatewayAmount * 100),
                currency: 'inr',
                metadata: {
                    userId: req.user.id.toString()
                }
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
            } else if (paymentMethod === 'Stripe' && stripePaymentIntent) {
                paymentResult.id = stripePaymentIntent.id;
                paymentResult.status = 'pending';
            } else if (fullWalletPayment) {
                paymentResult.status = 'Wallet';
            }

            const order = await createOrderDocument({
                user: req.user.id,
                items: orderItems,
                totalAmount,
                paymentMethod: effectivePaymentMethod,
                paymentStatus: paymentMethod === 'COD' ? 'cod' : (fullWalletPayment ? 'paid' : 'pending'),
                walletUsed,
                gatewayAmount,
                shippingAddress,
                paymentResult,
                status: isImmediateOrder ? 'Processing' : 'Pending'
            }, session);

            if (walletUsed > 0) {
                await debitWallet(
                    {
                        userId: req.user.id,
                        amount: walletUsed,
                        reason: `Order payment for order ${order._id}`,
                        orderId: order._id,
                        meta: {
                            source: 'checkout',
                            paymentMethod: effectivePaymentMethod
                        }
                    },
                    { session }
                );
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
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                walletUsed,
                gatewayAmount
            });
        }

        if (paymentMethod === 'Stripe' && gatewayAmount > 0) {
            return sendResponse(res, 201, true, 'Stripe payment initialized', {
                order: createdOrder,
                stripePaymentIntent: {
                    id: stripePaymentIntent.id,
                    clientSecret: stripePaymentIntent.client_secret,
                    amount: stripePaymentIntent.amount,
                    currency: stripePaymentIntent.currency
                },
                walletUsed,
                gatewayAmount
            });
        }

        const message = createdOrder.paymentMethod === 'Wallet'
            ? 'Order placed successfully using wallet balance'
            : 'Order placed successfully (COD)';

        return sendResponse(res, 201, true, message, { order: createdOrder });
    } catch (err) {
        console.error('Order Creation Error:', err);
        next(err);
    }
};


// @desc    Verify Razorpay payment
// @route   POST /api/orders/verify
// @access  Private
exports.verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return sendResponse(res, 400, false, 'Payment verification payload is incomplete');
        }

        if (!process.env.RAZORPAY_SECRET) {
            return sendResponse(res, 500, false, 'Razorpay secret is not configured on server');
        }

        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return sendResponse(res, 400, false, 'Invalid signature');
        }

        const { order, alreadyPaid } = await runWithOptionalTransaction(async (session) => {
            const orderRecord = await withSession(
                Order.findOne({
                    _id: orderId,
                    user: req.user.id
                }).populate('items.product'),
                session
            );

            if (!orderRecord) {
                throw buildError('Order not found', 404);
            }

            if (orderRecord.status === 'Cancelled') {
                throw buildError('Cancelled orders cannot be paid', 400);
            }

            if (orderRecord.paymentMethod !== 'Razorpay') {
                throw buildError('This order is not a Razorpay payment order', 400);
            }

            if (orderRecord.paymentStatus === 'paid') {
                return { order: orderRecord, alreadyPaid: true };
            }

            if (orderRecord.paymentResult?.razorpay_order_id !== razorpay_order_id) {
                throw buildError('Order mismatch for payment verification', 400);
            }

            orderRecord.paymentResult = {
                ...orderRecord.paymentResult,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                status: 'paid',
                update_time: new Date().toISOString()
            };
            orderRecord.paymentStatus = 'paid';
            orderRecord.status = 'Processing';

            if (!orderRecord.inventoryAdjusted) {
                await ensureStockAvailable(orderRecord.items, session);
                await decreaseStockForOrderItems(orderRecord.items, session);
                orderRecord.inventoryAdjusted = true;
            }

            await saveWithSession(orderRecord, session);
            await withSession(Cart.findOneAndDelete({ user: req.user.id }), session);

            return {
                order: orderRecord,
                alreadyPaid: false
            };
        });

        if (!alreadyPaid) {
            await sendOrderConfirmationEmail(order, req.user);
        }

        return sendResponse(
            res,
            200,
            true,
            alreadyPaid ? 'Payment already verified' : 'Payment verified and order placed successfully',
            order
        );
    } catch (err) {
        next(err);
    }
};

// @desc    Verify Stripe payment
// @route   POST /api/orders/verify/stripe
// @access  Private
exports.verifyStripePayment = async (req, res, next) => {
    try {
        const { orderId, paymentIntentId } = req.body;

        if (!orderId || !paymentIntentId) {
            return sendResponse(res, 400, false, 'Stripe verification payload is incomplete');
        }

        const stripe = getStripeClient();
        if (!stripe) {
            return sendResponse(
                res,
                500,
                false,
                'Stripe is not configured. Add STRIPE_SECRET_KEY and install stripe package'
            );
        }

        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        } catch (error) {
            return sendResponse(res, 400, false, 'Unable to verify Stripe payment intent');
        }

        if (paymentIntent.status !== 'succeeded') {
            return sendResponse(res, 400, false, 'Stripe payment is not successful yet');
        }

        const { order, alreadyPaid } = await runWithOptionalTransaction(async (session) => {
            const orderRecord = await withSession(
                Order.findOne({
                    _id: orderId,
                    user: req.user.id
                }).populate('items.product'),
                session
            );

            if (!orderRecord) {
                throw buildError('Order not found', 404);
            }

            if (orderRecord.status === 'Cancelled') {
                throw buildError('Cancelled orders cannot be paid', 400);
            }

            if (orderRecord.paymentMethod !== 'Stripe') {
                throw buildError('This order is not a Stripe payment order', 400);
            }

            if (orderRecord.paymentStatus === 'paid') {
                return { order: orderRecord, alreadyPaid: true };
            }

            const expectedGatewayAmount = Math.round((orderRecord.gatewayAmount || orderRecord.totalAmount) * 100);
            if (paymentIntent.amount_received < expectedGatewayAmount) {
                throw buildError('Stripe payment amount mismatch', 400);
            }

            orderRecord.paymentResult = {
                ...orderRecord.paymentResult,
                id: paymentIntent.id,
                status: 'paid',
                update_time: new Date().toISOString(),
                email_address: paymentIntent.receipt_email || orderRecord.paymentResult?.email_address || ''
            };
            orderRecord.paymentStatus = 'paid';
            orderRecord.status = 'Processing';

            if (!orderRecord.inventoryAdjusted) {
                await ensureStockAvailable(orderRecord.items, session);
                await decreaseStockForOrderItems(orderRecord.items, session);
                orderRecord.inventoryAdjusted = true;
            }

            await saveWithSession(orderRecord, session);
            await withSession(Cart.findOneAndDelete({ user: req.user.id }), session);

            return {
                order: orderRecord,
                alreadyPaid: false
            };
        });

        if (!alreadyPaid) {
            await sendOrderConfirmationEmail(order, req.user);
        }

        return sendResponse(
            res,
            200,
            true,
            alreadyPaid ? 'Payment already verified' : 'Stripe payment verified and order placed successfully',
            order
        );
    } catch (err) {
        next(err);
    }
};

// @desc    Get Razorpay order data for a pending order
// @route   GET /api/orders/:id/retry-payment
// @access  Private
exports.getRazorpayOrderForPendingOrder = async (req, res, next) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user.id,
            status: 'Pending',
            paymentMethod: 'Razorpay'
        });

        if (!order) {
            return sendResponse(res, 404, false, 'Pending Razorpay order not found');
        }

        if (order.paymentStatus === 'paid') {
            return sendResponse(res, 400, false, 'Order is already paid');
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
            return sendResponse(res, 500, false, 'Razorpay is not configured on the server');
        }

        const gatewayAmount = order.gatewayAmount || order.totalAmount;
        const amount = Math.round(gatewayAmount * 100);
        if (!amount || amount < 100) {
            return sendResponse(res, 400, false, `Invalid order amount: ${gatewayAmount}`);
        }

        const options = {
            amount,
            currency: 'INR',
            receipt: `rcpt_${order._id.toString().slice(-10)}_${Date.now()}`.slice(0, 40)
        };

        const razorpayOrder = await instance.orders.create(options);

        order.paymentResult = {
            ...order.paymentResult,
            razorpay_order_id: razorpayOrder.id,
            status: 'pending'
        };
        await order.save();

        return sendResponse(res, 200, true, 'Razorpay order re-created', {
            order,
            razorpayOrder,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('Retry Payment Error Details:', err);
        next(err);
    }
};

// @desc    Download order invoice
// @route   GET /api/orders/:id/invoice
// @access  Private
exports.getOrderInvoice = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.product')
            .populate('user', 'name email');

        if (!order) {
            return sendResponse(res, 404, false, 'Order not found');
        }

        const orderUserId = order.user?._id ? order.user._id.toString() : order.user?.toString();
        const isOwner = orderUserId === req.user.id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return sendResponse(res, 403, false, 'Not authorized to access this invoice');
        }

        const { invoiceName, invoicePath } = await ensureInvoiceForOrder(order);

        return res.download(invoicePath, invoiceName, (err) => {
            if (err && !res.headersSent) {
                next(err);
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .populate('items.product');
        sendResponse(res, 200, true, 'Orders fetched successfully', orders);
    } catch (err) {
        next(err);
    }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin
// @access  Private/Admin
exports.getAllOrders = async (req, res, next) => {
    try {
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('user', 'name email')
            .populate('items.product');
        sendResponse(res, 200, true, 'All orders fetched successfully', orders);
    } catch (err) {
        next(err);
    }
};

// @desc    Cancel own order
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelMyOrder = async (req, res, next) => {
    try {
        const cancellation = await runWithOptionalTransaction(async (session) => {
            const cancelledAt = new Date();

            const order = await withSession(
                Order.findOneAndUpdate(
                    {
                        _id: req.params.id,
                        user: req.user.id,
                        status: { $in: ['Pending', 'Processing'] }
                    },
                    {
                        $set: {
                            status: 'Cancelled',
                            cancelledAt
                        }
                    },
                    { new: true }
                ).populate('items.product'),
                session
            );

            if (!order) {
                const existingOrder = await withSession(
                    Order.findOne({
                        _id: req.params.id,
                        user: req.user.id
                    }),
                    session
                );

                if (!existingOrder) {
                    throw buildError('Order not found', 404);
                }

                if (existingOrder.status === 'Cancelled') {
                    throw buildError('Order is already cancelled', 409);
                }

                throw buildError('Only orders before shipping can be cancelled', 400);
            }

            let walletCredited = getCancellationWalletCreditAmount(order);
            walletCredited = Number(walletCredited.toFixed(2));

            if (walletCredited > 0) {
                await creditWallet(
                    {
                        userId: order.user,
                        amount: walletCredited,
                        reason: `Refund for cancelled order ${order._id}`,
                        orderId: order._id,
                        meta: {
                            source: 'order_cancellation',
                            paymentStatus: order.paymentStatus,
                            paymentMethod: order.paymentMethod
                        }
                    },
                    { session }
                );

                order.walletRefundedAmount = walletCredited;
            }

            if (order.inventoryAdjusted) {
                await restoreStockForOrder(order, session);
                order.inventoryAdjusted = false;
            }

            await saveWithSession(order, session);

            return {
                order,
                walletCredited
            };
        });

        const message = cancellation.walletCredited > 0
            ? `Order cancelled. Rs ${cancellation.walletCredited.toFixed(2)} credited to wallet`
            : 'Order cancelled successfully';

        return sendResponse(res, 200, true, message, cancellation.order);
    } catch (err) {
        next(err);
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

        if (!allowedStatuses.includes(status)) {
            return sendResponse(res, 400, false, 'Invalid order status');
        }

        const result = await runWithOptionalTransaction(async (session) => {
            const order = await withSession(
                Order.findById(req.params.id).populate('items.product'),
                session
            );

            if (!order) {
                throw buildError('Order not found', 404);
            }

            const oldStatus = order.status;

            if (oldStatus === 'Cancelled' && status !== 'Cancelled') {
                throw buildError('Cancelled order status cannot be changed', 400);
            }

            if (status === 'Cancelled') {
                if (oldStatus === 'Cancelled') {
                    return { order, walletCredited: 0 };
                }

                if (!['Pending', 'Processing'].includes(oldStatus)) {
                    throw buildError('Only orders before shipping can be cancelled', 400);
                }

                order.status = 'Cancelled';
                order.cancelledAt = new Date();

                let walletCredited = getCancellationWalletCreditAmount(order);
                walletCredited = Number(walletCredited.toFixed(2));

                if (walletCredited > 0) {
                    await creditWallet(
                        {
                            userId: order.user,
                            amount: walletCredited,
                            reason: `Admin cancellation refund for order ${order._id}`,
                            orderId: order._id,
                            createdBy: req.user.id,
                            meta: {
                                source: 'admin_order_cancellation',
                                paymentStatus: order.paymentStatus,
                                paymentMethod: order.paymentMethod
                            }
                        },
                        { session }
                    );

                    order.walletRefundedAmount = walletCredited;
                }

                if (order.inventoryAdjusted) {
                    await restoreStockForOrder(order, session);
                    order.inventoryAdjusted = false;
                }

                await saveWithSession(order, session);
                return { order, walletCredited };
            }

            // If admin moves pending order to processing, mark as paid and reserve stock.
            if (oldStatus === 'Pending' && status === 'Processing') {
                if (!order.inventoryAdjusted) {
                    await ensureStockAvailable(order.items, session);
                    await decreaseStockForOrderItems(order.items, session);
                    order.inventoryAdjusted = true;
                }

                order.paymentStatus = 'paid';
                order.paymentResult = {
                    ...order.paymentResult,
                    status: 'Marked as Paid',
                    update_time: new Date().toISOString()
                };
            }

            order.status = status;
            await saveWithSession(order, session);

            return {
                order,
                walletCredited: 0
            };
        });

        return sendResponse(res, 200, true, 'Order status updated', result.order);
    } catch (err) {
        next(err);
    }
};
