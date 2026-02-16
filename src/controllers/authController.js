const User = require('../models/userModel');
const sendResponse = require('../utils/responseHandler');
const { registerSchema, loginSchema, updateDetailsSchema } = require('../validations/authValidation');

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        // Validate request body
        const { error } = registerSchema.validate(req.body);
        if (error) {
            return sendResponse(res, 400, false, 'Validation Error', null, error.details[0].message);
        }

        const { name, email, password, role, address } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return sendResponse(res, 400, false, 'Email already exists');
        }

        // Create user
        user = await User.create({
            name,
            email,
            password,
            role,
            address
        });

        sendTokenResponse(user, 201, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        // Validate request body
        const { error } = loginSchema.validate(req.body);
        if (error) {
            return sendResponse(res, 400, false, 'Validation Error', null, error.details[0].message);
        }

        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return sendResponse(res, 401, false, 'Invalid credentials');
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return sendResponse(res, 401, false, 'Invalid credentials');
        }

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
    try {
        // Validate request body
        const { error } = updateDetailsSchema.validate(req.body);
        if (error) {
            return sendResponse(res, 400, false, 'Validation Error', null, error.details[0].message);
        }

        const fieldsToUpdate = {
            name: req.body.name,
            email: req.body.email,
            address: req.body.address
        };

        const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });

        sendResponse(res, 200, true, 'User details updated successfully', user);
    } catch (err) {
        next(err);
    }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    const token = user.getSignedJwtToken();

    const options = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        httpOnly: true
    };

    const userData = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address
    };

    res.status(statusCode).json({
        success: true,
        message: 'Successfully authenticated',
        data: {
            token,
            user: userData
        },
        errors: null
    });
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        sendResponse(res, 200, true, 'User profile fetched', user);
    } catch (err) {
        next(err);
    }
};
