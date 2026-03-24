const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.ObjectId,
        ref: 'Order'
    },
    reward: {
        type: mongoose.Schema.ObjectId,
        ref: 'Reward'
    },
    type: {
        type: String,
        enum: ['Earned', 'Redeemed'],
        required: true
    },
    points: {
        type: Number,
        required: true
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        default: 0
    },
    reason: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
