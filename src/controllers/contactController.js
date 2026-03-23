const Contact = require('../models/contactModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Submit contact form
// @route   POST /api/v1/contact
// @access  Public
exports.submitContact = async (req, res, next) => {
    try {
        const contact = await Contact.create(req.body);
        sendResponse(res, 201, true, 'Your message has been successfully received. Our team will contact you shortly.', contact);

    } catch (err) {
        next(err);
    }
};
