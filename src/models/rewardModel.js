const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a reward name'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a reward description']
    },
    pointsRequired: {
        type: Number,
        required: [true, 'Please specify points required for redemption'],
        min: [1, 'Points required must be at least 1']
    },
    type: {
        type: String,
        enum: ['Discount', 'FreeItem', 'Voucher'],
        default: 'Discount'
    },
    value: {
        type: Number, // Percentage for discount, or fixed value
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Reward', rewardSchema);
