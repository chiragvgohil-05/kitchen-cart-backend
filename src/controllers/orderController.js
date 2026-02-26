const crypto = require('crypto');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const instance = require('../config/razorpay');
const transporter = require('../config/nodemailer');
const createInvoice = require('../utils/invoiceGenerator');
const sendResponse = require('../utils/responseHandler');
const path = require('path');
const fs = require('fs');

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

const restoreStockForOrder = async (order) => {
    for (const item of order.items || []) {
        const productId = item.product?._id || item.product;
        const product = await Product.findById(productId);
        if (product) {
            product.stock += item.quantity;
            await product.save();
        }
    }
};

// @desc    Create new order (Initialize Payment)
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
    try {
        const { paymentMethod = 'COD' } = req.body;
        const selectedPaymentMethod = paymentMethod === 'Razorpay' ? 'Razorpay' : 'COD';
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

        const totalAmount = orderItems.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        if (selectedPaymentMethod === 'Razorpay') {
            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
                return sendResponse(res, 500, false, 'Razorpay is not configured on the server');
            }

            const options = {
                amount: Math.round(totalAmount * 100),
                currency: 'INR',
                receipt: `receipt_order_${Date.now()}`
            };
            const razorpayOrder = await instance.orders.create(options);

            const order = await Order.create({
                user: req.user.id,
                items: orderItems,
                totalAmount,
                shippingAddress,
                paymentResult: {
                    razorpay_order_id: razorpayOrder.id,
                    status: 'pending'
                }
            });

            return sendResponse(res, 201, true, 'Razorpay order created', {
                order,
                razorpayOrder,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID
            });
        }

        const order = await Order.create({
            user: req.user.id,
            items: orderItems,
            totalAmount,
            shippingAddress,
            status: 'Processing',
            paymentResult: { status: 'COD' }
        });

        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            if (product) {
                product.stock = Math.max(0, product.stock - item.quantity);
                await product.save();
            }
        }

        await Cart.findOneAndDelete({ user: req.user.id });

        return sendResponse(res, 201, true, 'Order placed successfully (COD)', { order });
    } catch (err) {
        console.error('Order Creation Error:', err);
        next(err);
    }
};


// @desc    Verify Payment
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

        const body = razorpay_order_id + '|' + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return sendResponse(res, 400, false, 'Invalid signature');
        }

        const order = await Order.findOne({
            _id: orderId,
            user: req.user.id
        }).populate('items.product');

        if (!order) {
            return sendResponse(res, 404, false, 'Order not found');
        }

        if (order.paymentResult?.razorpay_order_id !== razorpay_order_id) {
            return sendResponse(res, 400, false, 'Order mismatch for payment verification');
        }

        if (order.paymentResult?.status === 'paid') {
            return sendResponse(res, 200, true, 'Payment already verified', order);
        }

        order.paymentResult = {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            status: 'paid'
        };
        order.status = 'Processing';
        await order.save();

        await Cart.findOneAndDelete({ user: req.user.id });

        for (const item of order.items) {
            const productId = item.product?._id || item.product;
            const product = await Product.findById(productId);
            if (product) {
                product.stock = Math.max(0, product.stock - item.quantity);
                await product.save();
            }
        }

        const { invoiceName, invoicePath } = await ensureInvoiceForOrder(order, { force: true });

        if (process.env.EMAIL_USER && req.user?.email) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: req.user.email,
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
                if (err) console.error('Error sending email:', err);
                else console.log('Email sent:', info.response);
            });
        }

        return sendResponse(res, 200, true, 'Payment verified and order placed successfully', order);
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
            status: { $regex: /^pending$/i } // Case-insensitive check
        });

        if (!order) {
            return sendResponse(res, 404, false, 'Pending order not found');
        }

        if (order.paymentResult?.status === 'paid') {
            return sendResponse(res, 400, false, 'Order is already paid');
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
            return sendResponse(res, 500, false, 'Razorpay is not configured on the server');
        }

        const amount = Math.round(order.totalAmount * 100);
        if (!amount || amount < 100) { // Razorpay minimum amount is 100 paise (R 1)
            return sendResponse(res, 400, false, `Invalid order amount: ${order.totalAmount}`);
        }

        const options = {
            amount: amount,
            currency: 'INR',
            receipt: `rcpt_${order._id.toString().slice(-10)}_${Date.now()}`.slice(0, 40)
        };

        console.log('Razorpay Order Options:', options);
        const razorpayOrder = await instance.orders.create(options);

        // Ensure paymentResult object exists
        if (!order.paymentResult) {
            order.paymentResult = {};
        }

        // Update the order with new razorpay_order_id
        order.paymentResult.razorpay_order_id = razorpayOrder.id;
        order.markModified('paymentResult'); // Ensure Mongoose detects the nested change
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
// @route   GET /api/v1/orders
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
// @route   GET /api/v1/orders/admin
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
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user.id
        }).populate('items.product');

        if (!order) {
            return sendResponse(res, 404, false, 'Order not found');
        }

        if (order.status === 'Cancelled') {
            return sendResponse(res, 200, true, 'Order already cancelled', order);
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            return sendResponse(res, 400, false, 'This order cannot be cancelled now');
        }

        const shouldRestoreStock = ['COD', 'paid', 'Marked as Paid'].includes(order.paymentResult?.status);
        if (shouldRestoreStock) {
            await restoreStockForOrder(order);
        }

        order.status = 'Cancelled';
        await order.save();

        return sendResponse(res, 200, true, 'Order cancelled successfully', order);
    } catch (err) {
        next(err);
    }
};

// @desc    Update order status
// @route   PUT /api/v1/orders/:id
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id).populate('items.product');

        if (!order) {
            return sendResponse(res, 404, false, 'Order not found');
        }

        const oldStatus = order.status;
        if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
            const shouldRestoreStock = ['COD', 'paid', 'Marked as Paid'].includes(order.paymentResult?.status);
            if (shouldRestoreStock) {
                await restoreStockForOrder(order);
            }
        }

        // If admin manually updates a Pending order to Processing (mark as paid), decrease stock
        if (oldStatus === 'Pending' && status === 'Processing') {
            for (const item of order.items) {
                const productId = item.product?._id || item.product;
                const product = await Product.findById(productId);
                if (product) {
                    product.stock = Math.max(0, product.stock - item.quantity);
                    await product.save();
                }
            }
            order.paymentResult.status = 'Marked as Paid';
        }

        order.status = status;
        await order.save();

        return sendResponse(res, 200, true, 'Order status updated', order);
    } catch (err) {
        next(err);
    }
};
