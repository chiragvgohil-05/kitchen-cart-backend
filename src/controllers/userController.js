const User = require('../models/userModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        sendResponse(res, 200, true, 'Customer and staff directory retrieved successfully.', users);
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
            return sendResponse(res, 404, false, 'The specified user account could not be found.');
        }

        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user.id.toString()) {
            return sendResponse(res, 400, false, 'For security reasons, you cannot delete your own administrative account.');
        }

        await User.findByIdAndDelete(req.params.id);

        sendResponse(res, 200, true, 'User account has been permanently removed from the system.');
    } catch (err) {
        next(err);
    }
};

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;

        const allowedRoles = ['user', 'staff', 'admin'];
        if (!role || !allowedRoles.includes(role)) {
            return sendResponse(res, 400, false, `The provided role is invalid. Please choose from: ${allowedRoles.join(', ')}.`);
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return sendResponse(res, 404, false, 'The specified user account could not be found.');
        }

        // Prevent admin from changing their own role
        if (user._id.toString() === req.user.id.toString()) {
            return sendResponse(res, 400, false, 'You are not permitted to modify your own account\'s access level.');
        }

        user.role = role;
        await user.save();

        sendResponse(res, 200, true, `Successfully updated the user's access level to ${role}.`, { _id: user._id, name: user.name, email: user.email, role: user.role });
    } catch (err) {
        next(err);
    }
};
