const Contact = require('../models/contactModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Submit contact form
// @route   POST /api/v1/contact
// @access  Public
exports.submitContact = async (req, res, next) => {
    try {
        const contact = await Contact.create(req.body);
        sendResponse(res, 201, true, 'Message submitted successfully', contact);
    } catch (err) {
        next(err);
    }
};
