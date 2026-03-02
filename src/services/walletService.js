const User = require('../models/userModel');
const WalletTransaction = require('../models/walletTransactionModel');

const withSession = (query, session) => (session ? query.session(session) : query);

const buildError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const normalizeAmount = (amount) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw buildError('Amount must be a positive number', 400);
    }

    return Number(parsed.toFixed(2));
};

const createWalletTransaction = async (
    { userId, type, amount, reason, orderId = null, createdBy = null, meta = {} },
    { session = null } = {}
) => {
    const payload = {
        user: userId,
        order: orderId,
        type,
        amount,
        reason,
        createdBy,
        meta
    };

    if (session) {
        const [transaction] = await WalletTransaction.create([payload], { session });
        return transaction;
    }

    return WalletTransaction.create(payload);
};

const creditWallet = async (
    { userId, amount, reason, orderId = null, createdBy = null, meta = {} },
    { session = null } = {}
) => {
    const normalizedAmount = normalizeAmount(amount);

    const updatedUser = await withSession(
        User.findByIdAndUpdate(
            userId,
            { $inc: { walletBalance: normalizedAmount } },
            { new: true, runValidators: true }
        ),
        session
    );

    if (!updatedUser) {
        throw buildError('User not found', 404);
    }

    const transaction = await createWalletTransaction(
        {
            userId,
            type: 'credit',
            amount: normalizedAmount,
            reason,
            orderId,
            createdBy,
            meta
        },
        { session }
    );

    return { updatedUser, transaction, amount: normalizedAmount };
};

const debitWallet = async (
    { userId, amount, reason, orderId = null, createdBy = null, meta = {} },
    { session = null } = {}
) => {
    const normalizedAmount = normalizeAmount(amount);

    const updatedUser = await withSession(
        User.findOneAndUpdate(
            { _id: userId, walletBalance: { $gte: normalizedAmount } },
            { $inc: { walletBalance: -normalizedAmount } },
            { new: true, runValidators: true }
        ),
        session
    );

    if (!updatedUser) {
        const userExists = await withSession(User.exists({ _id: userId }), session);
        if (!userExists) {
            throw buildError('User not found', 404);
        }
        throw buildError('Insufficient wallet balance', 400);
    }

    const transaction = await createWalletTransaction(
        {
            userId,
            type: 'debit',
            amount: normalizedAmount,
            reason,
            orderId,
            createdBy,
            meta
        },
        { session }
    );

    return { updatedUser, transaction, amount: normalizedAmount };
};

module.exports = {
    creditWallet,
    debitWallet,
    createWalletTransaction
};
