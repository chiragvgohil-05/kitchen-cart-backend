const Setting = require('../models/settingModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get site settings
// @route   GET /api/settings
// @access  Public
const getSettings = async (req, res, next) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) {
            // Create default settings if not exists
            settings = await Setting.create({});
        }
        sendResponse(res, 200, true, 'Store configuration settings retrieved successfully.', settings);
    } catch (error) { 
        next(error);
    }
};

// @desc    Update site settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res, next) => {
    try {
        const { address, phone, email, facebook, instagram, twitter, mobile } = req.body;
        let settings = await Setting.findOne();
        
        if (!settings) {
            settings = new Setting();
        }

        settings.address = address !== undefined ? address : settings.address;
        settings.phone = phone !== undefined ? phone : settings.phone;
        settings.mobile = mobile !== undefined ? mobile : settings.mobile;
        settings.email = email !== undefined ? email : settings.email;
        settings.facebook = facebook !== undefined ? facebook : settings.facebook;
        settings.instagram = instagram !== undefined ? instagram : settings.instagram;
        settings.twitter = twitter !== undefined ? twitter : settings.twitter;
        settings.updatedAt = Date.now();

        await settings.save();
        sendResponse(res, 200, true, 'Store configuration settings updated successfully.', settings);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSettings,
    updateSettings
};
