const User = require('../models/userModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        sendResponse(res, 200, true, 'Users fetched successfully', users);
    } catch (err) {
        next(err);
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return sendResponse(res, 404, false, 'User not found');
        }

        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user.id.toString()) {
            return sendResponse(res, 400, false, 'You cannot delete yourself');
        }

        await User.findByIdAndDelete(req.params.id);

        sendResponse(res, 200, true, 'User deleted successfully');
    } catch (err) {
        next(err);
    }
};
