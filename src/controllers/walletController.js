const mongoose = require('mongoose');
const User = require('../models/userModel');
const WalletTransaction = require('../models/walletTransactionModel');
const sendResponse = require('../utils/responseHandler');
const { creditWallet, debitWallet } = require('../services/walletService');
const { runWithOptionalTransaction } = require('../services/transactionService');

const parsePagination = (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
};

const withSession = (query, session) => (session ? query.session(session) : query);

// @desc    Get logged in user wallet balance
// @route   GET /api/wallet/balance
// @access  Private
exports.getMyWalletBalance = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('walletBalance');

        if (!user) {
            return sendResponse(res, 404, false, 'The specified user account could not be found.');
        }


        return sendResponse(res, 200, true, 'Your current wallet balance has been retrieved successfully.', {
            walletBalance: user.walletBalance
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get logged in user wallet transactions
// @route   GET /api/wallet/transactions
// @access  Private
exports.getMyWalletTransactions = async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const filter = { user: req.user.id };

        if (['credit', 'debit'].includes(req.query.type)) {
            filter.type = req.query.type;
        }

        const [transactions, total] = await Promise.all([
            WalletTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('order', 'status totalAmount paymentStatus paymentMethod'),
            WalletTransaction.countDocuments(filter)
        ]);

        return sendResponse(res, 200, true, 'Your wallet transaction history has been retrieved successfully.', {

            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: Get wallet transactions
// @route   GET /api/wallet/admin/transactions
// @access  Private/Admin
exports.getAdminWalletTransactions = async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const filter = {};

        if (req.query.userId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
                return sendResponse(res, 400, false, 'Invalid userId');
            }
            filter.user = req.query.userId;
        }

        if (['credit', 'debit'].includes(req.query.type)) {
            filter.type = req.query.type;
        }

        const [transactions, total] = await Promise.all([
            WalletTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('user', 'name email')
                .populate('order', 'status totalAmount paymentStatus paymentMethod')
                .populate('createdBy', 'name email role'),
            WalletTransaction.countDocuments(filter)
        ]);

        return sendResponse(res, 200, true, 'System wallet transactions fetched successfully.', {

            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: Adjust user wallet balance
// @route   POST /api/wallet/admin/adjust
// @access  Private/Admin
exports.adjustWalletBalanceByAdmin = async (req, res, next) => {
    try {
        const { userId, type, amount, reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return sendResponse(res, 400, false, 'The provided User ID is invalid.');
        }


        if (!['credit', 'debit'].includes(type)) {
            return sendResponse(res, 400, false, 'Please specify a valid adjustment type (credit or debit).');
        }


        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return sendResponse(res, 400, false, 'A valid reason must be provided for all manual wallet adjustments.');
        }


        const result = await runWithOptionalTransaction(async (session) => {
            const user = await withSession(User.findById(userId), session);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            if (type === 'credit') {
                const creditResult = await creditWallet(
                    {
                        userId,
                        amount,
                        reason: reason.trim(),
                        createdBy: req.user.id,
                        meta: { source: 'admin_adjustment' }
                    },
                    { session }
                );

                return {
                    user: creditResult.updatedUser,
                    transaction: creditResult.transaction
                };
            }

            const debitResult = await debitWallet(
                {
                    userId,
                    amount,
                    reason: reason.trim(),
                    createdBy: req.user.id,
                    meta: { source: 'admin_adjustment' }
                },
                { session }
            );

            return {
                user: debitResult.updatedUser,
                transaction: debitResult.transaction
            };
        });

        return sendResponse(res, 200, true, 'The account\'s wallet balance has been successfully adjusted.', {

            user: {
                _id: result.user._id,
                name: result.user.name,
                email: result.user.email,
                walletBalance: result.user.walletBalance
            },
            transaction: result.transaction
        });
    } catch (error) {
        next(error);
    }
};
