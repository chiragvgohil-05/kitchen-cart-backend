const Table = require('../models/tableModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get all tables
// @route   GET /api/tables
// @access  Public
exports.getTables = async (req, res, next) => {
    try {
        const tables = await Table.find().sort('tableNumber');
        sendResponse(res, 200, true, 'Table layout and status information retrieved successfully.', tables);
    } catch (err) {
        next(err);
    }
};

// @desc    Create a new table
// @route   POST /api/tables
// @access  Admin
exports.createTable = async (req, res, next) => {
    try {
        const table = await Table.create(req.body);
        sendResponse(res, 201, true, 'Successfully added a new table to the restaurant layout.', table);
    } catch (err) {
        next(err);
    }
};

// @desc    Update a table
// @route   PUT /api/tables/:id
// @access  Admin
exports.updateTable = async (req, res, next) => {
    try {
        const table = await Table.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!table) {
            return sendResponse(res, 404, false, 'The specified table could not be found in our records.');
        }

        sendResponse(res, 200, true, 'Table configuration details updated successfully.', table);
    } catch (err) {
        next(err);
    }
};

// @desc    Delete a table
// @route   DELETE /api/tables/:id
// @access  Admin
exports.deleteTable = async (req, res, next) => {
    try {
        const table = await Table.findByIdAndDelete(req.params.id);

        if (!table) {
            return sendResponse(res, 404, false, 'The specified table could not be found in our records.');
        }

        sendResponse(res, 200, true, 'Table has been successfully removed from the system.');
    } catch (err) {
        next(err);
    }
};
