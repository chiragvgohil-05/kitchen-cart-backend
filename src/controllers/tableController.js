const Table = require('../models/tableModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get all tables
// @route   GET /api/v1/tables
// @access  Public
exports.getTables = async (req, res, next) => {
    try {
        const tables = await Table.find();
        sendResponse(res, 200, true, 'Tables fetched successfully', tables);
    } catch (err) {
        next(err);
    }
};

// @desc    Get single table
// @route   GET /api/v1/tables/:id
// @access  Public
exports.getTable = async (req, res, next) => {
    try {
        const table = await Table.findById(req.params.id);

        if (!table) {
            return sendResponse(res, 404, false, 'Table not found');
        }

        sendResponse(res, 200, true, 'Table fetched successfully', table);
    } catch (err) {
        next(err);
    }
};

// @desc    Create new table
// @route   POST /api/v1/tables
// @access  Private/Admin
exports.createTable = async (req, res, next) => {
    try {
        const table = await Table.create(req.body);
        sendResponse(res, 201, true, 'Table created successfully', table);
    } catch (err) {
        next(err);
    }
};

// @desc    Update table
// @route   PUT /api/v1/tables/:id
// @access  Private/Admin
exports.updateTable = async (req, res, next) => {
    try {
        let table = await Table.findById(req.params.id);

        if (!table) {
            return sendResponse(res, 404, false, 'Table not found');
        }

        table = await Table.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        sendResponse(res, 200, true, 'Table updated successfully', table);
    } catch (err) {
        next(err);
    }
};

// @desc    Delete table
// @route   DELETE /api/v1/tables/:id
// @access  Private/Admin
exports.deleteTable = async (req, res, next) => {
    try {
        const table = await Table.findById(req.params.id);

        if (!table) {
            return sendResponse(res, 404, false, 'Table not found');
        }

        await table.deleteOne();

        sendResponse(res, 200, true, 'Table deleted successfully', {});
    } catch (err) {
        next(err);
    }
};
