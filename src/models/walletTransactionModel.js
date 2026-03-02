const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    order: {
        type: mongoose.Schema.ObjectId,
        ref: 'Order',
        default: null,
        index: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Amount must be greater than 0']
    },
    reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

walletTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
