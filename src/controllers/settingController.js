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
        const { address, phone, email, facebook, instagram, twitter } = req.body;
        let settings = await Setting.findOne();
        
        if (!settings) {
            settings = new Setting();
        }

        settings.address = address || settings.address;
        settings.phone = phone || settings.phone;
        settings.email = email || settings.email;
        settings.facebook = facebook || settings.facebook;
        settings.instagram = instagram || settings.instagram;
        settings.twitter = twitter || settings.twitter;
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
