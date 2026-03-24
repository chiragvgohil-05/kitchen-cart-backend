const LoyaltyTransaction = require('../models/loyaltyTransactionModel');
const User = require('../models/userModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get current user loyalty data
// @route   GET /api/loyalty/me
// @access  User
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('loyaltyPoints loyaltyTier');
        const transactions = await LoyaltyTransaction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('reward', 'name');

        sendResponse(res, 200, true, 'Loyalty program details retrieved successfully.', { user, transactions });
    } catch (err) {
        sendResponse(res, 500, false, err.message);
    }
};

// @desc    Get user loyalty history
// @route   GET /api/loyalty/history
// @access  User
exports.getHistory = async (req, res) => {
    try {
        const transactions = await LoyaltyTransaction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .populate('reward', 'name')
            .populate('order', '_id');

        sendResponse(res, 200, true, 'Your loyalty point transaction history has been retrieved.', transactions);
    } catch (err) {
        sendResponse(res, 500, false, err.message);
    }
};

// @desc    Get all loyalty transactions (Admin/Staff)
// @route   GET /api/loyalty/all
// @access  Admin/Staff
exports.getAllTransactions = async (req, res) => {
    try {
        const transactions = await LoyaltyTransaction.find()
            .sort({ createdAt: -1 })
            .populate('user', 'name email')
            .populate('reward', 'name')
            .populate('order', '_id');

        sendResponse(res, 200, true, 'Current loyalty transactions retrieved for all users.', transactions);
    } catch (err) {
        sendResponse(res, 500, false, err.message);
    }
};

// @desc    Add manual points (Staff/Admin)
// @route   POST /api/loyalty/add
// @access  Staff/Admin
exports.addManualPoints = async (req, res) => {
    try {
        const { userId, points, reason } = req.body;
        
        const user = await User.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: points } }, { new: true });
        if (!user) {
            return sendResponse(res, 404, false, 'The specified user account could not be found.');
        }

        await LoyaltyTransaction.create({
            user: userId,
            type: 'Earned',
            points,
            reason: reason || 'Manual point addition'
        });

        // Trigger tier update...
        const loyaltyService = require('../services/loyaltyService');
        await loyaltyService.updateUserTier(userId);

        sendResponse(res, 200, true, 'Points manually assigned to the customer\'s account successfully.');
    } catch (err) {
        sendResponse(res, 400, false, err.message);
    }
};
