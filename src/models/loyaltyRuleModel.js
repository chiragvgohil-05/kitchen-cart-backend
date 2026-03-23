const mongoose = require('mongoose');

const loyaltyRuleSchema = new mongoose.Schema({
    pointsPerSpend: {
        type: Number,
        default: 0.1, // 1 point per 10 spent
        required: true
    },
    tierRules: [
        {
            tierName: {
                type: String,
                enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
                required: true
            },
            minPoints: {
                type: Number,
                required: true
            },
            multiplier: {
                type: Number,
                default: 1.0 // Future use: e.g., Gold gets 1.5x points
            }
        }
    ],
    redemptionRate: {
        type: Number,
        default: 1, // 1 point = ₹1
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('LoyaltyRule', loyaltyRuleSchema);
