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

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;

        const allowedRoles = ['user', 'staff', 'admin'];
        if (!role || !allowedRoles.includes(role)) {
            return sendResponse(res, 400, false, `Invalid role. Must be one of: ${allowedRoles.join(', ')}`);
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return sendResponse(res, 404, false, 'User not found');
        }

        // Prevent admin from changing their own role
        if (user._id.toString() === req.user.id.toString()) {
            return sendResponse(res, 400, false, 'You cannot change your own role');
        }

        user.role = role;
        await user.save();

        sendResponse(res, 200, true, `User role updated to ${role}`, { _id: user._id, name: user.name, email: user.email, role: user.role });
    } catch (err) {
        next(err);
    }
};

