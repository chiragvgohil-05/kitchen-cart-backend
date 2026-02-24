const Razorpay = require('razorpay');
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

// @desc    Create new order (Initialize Payment)
// @route   POST /api/v1/orders
// @access  Private
// @desc    Create new order (Initialize Payment)
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
    try {
        // Front‑end sends shippingAddress and optionally paymentMethod (default COD)
        const { shippingAddress, paymentMethod = 'COD' } = req.body;

        // Get the user's cart with populated product data
        const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return sendResponse(res, 400, false, 'No items in cart');
        }

        // ---- 1️⃣ Calculate total using the correct field ----
        let totalAmount = 0;
        cart.items.forEach(item => {
            // product schema uses `sellingPrice`
            totalAmount += (item.product.sellingPrice || 0) * item.quantity;
        });

        // ---- 2️⃣ Razorpay flow (if requested) ----
        if (paymentMethod === 'Razorpay') {
            const options = {
                amount: Math.round(totalAmount * 100), // paise
                currency: 'INR',
                receipt: `receipt_order_${Date.now()}`
            };
            const razorpayOrder = await instance.orders.create(options);

            const order = await Order.create({
                user: req.user.id,
                items: cart.items.map(item => ({
                    product: item.product._id,
                    quantity: item.quantity,
                    price: item.product.sellingPrice
                })),
                totalAmount,
                shippingAddress,
                paymentResult: {
                    razorpay_order_id: razorpayOrder.id,
                    status: 'pending'
                }
            });

            return sendResponse(res, 201, true, 'Razorpay order created', {
                order,
                razorpayOrder
            });
        }

        // ---- 3️⃣ COD flow (default) ----
        const order = await Order.create({
            user: req.user.id,
            items: cart.items.map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.sellingPrice
            })),
            totalAmount,
            shippingAddress,
            status: 'Processing',
            paymentResult: { status: 'COD' }
        });

        // Reduce stock for each purchased product
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (product) {
                product.stock = Math.max(0, product.stock - item.quantity);
                await product.save();
            }
        }

        // Empty the cart after a successful COD order
        await Cart.findOneAndDelete({ user: req.user.id });

        return sendResponse(res, 201, true, 'Order placed successfully (COD)', { order });
    } catch (err) {
        console.error('Order Creation Error:', err);
        next(err);
    }
};


// @desc    Verify Payment
// @route   POST /api/v1/orders/verify
// @access  Private
exports.verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId // Our DB Order ID
        } = req.body;

        const body = razorpay_order_id + '|' + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Payment Success
            const order = await Order.findById(orderId).populate('items.product');

            if (!order) {
                return sendResponse(res, 404, false, 'Order not found');
            }

            order.paymentResult = {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                status: 'paid'
            };
            order.status = 'Processing';
            await order.save();

            // Clear Cart
            await Cart.findOneAndDelete({ user: req.user.id });

            // Reduce Stock
            for (const item of order.items) {
                const product = await Product.findById(item.product._id);
                if (product) {
                    product.stock -= item.quantity;
                    await product.save();
                }
            }

            // Generate Invoice
            const invoiceName = `invoice_${order._id}.pdf`;
            const invoicePath = path.join(__dirname, '../../invoices', invoiceName);

            createInvoice(order, invoicePath);

            // Send Email (Async - don't block response)
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

            sendResponse(res, 200, true, 'Payment verified and order placed successfully', order);

        } else {
            sendResponse(res, 400, false, 'Invalid signature');
        }
    } catch (err) {
        next(err);
    }
};

// @desc    Get logged in user orders
// @route   GET /api/v1/orders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user.id }).populate('items.product');
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
        const orders = await Order.find().populate('user', 'name email').populate('items.product');
        sendResponse(res, 200, true, 'All orders fetched successfully', orders);
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
        const order = await Order.findById(req.params.id);

        if (!order) {
            return sendResponse(res, 404, false, 'Order not found');
        }

        order.status = status;
        await order.save();

        sendResponse(res, 200, true, 'Order status updated', order);
    } catch (err) {
        next(err);
    }
};
