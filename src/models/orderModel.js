const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    items: [
        {
            product: {
                type: mongoose.Schema.ObjectId,
                ref: 'Product',
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    orderType: {
        type: String,
        enum: ['Dine-in', 'Takeaway', 'Delivery'],
        default: 'Takeaway'
    },
    table: {
        type: mongoose.Schema.ObjectId,
        ref: 'Table',
        required: function() { return this.orderType === 'Dine-in'; }
    },
    paymentMethod: {
        type: String,
        enum: ['COD', 'Razorpay', 'Stripe', 'Wallet'],
        default: 'COD'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'cod'],
        default: 'pending'
    },
    walletUsed: {
        type: Number,
        default: 0,
        min: 0
    },
    gatewayAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    shippingAddress: {
        name: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    reward: {
        type: mongoose.Schema.ObjectId,
        ref: 'Reward'
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    paymentResult: {

        id: String,
        status: String,
        update_time: String,
        email_address: String,
        razorpay_order_id: String,
        razorpay_payment_id: String,
        razorpay_signature: String
    },
    status: {
        type: String,
        required: true,
        enum: [
            'Pending',      // Order received
            'Confirmed',    // Payment/Order confirmed
            'Preparing',    // In kitchen
            'Ready',        // Ready for serving/pickup
            'Served',       // Served to table or picked up
            'Shipped',      // Out for delivery (if Delivery type)
            'Delivered',    // Delivered (if Delivery type)
            'Cancelled'
        ],
        default: 'Pending'
    },
    inventoryAdjusted: {
        type: Boolean,
        default: false
    },
    walletRefundedAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
