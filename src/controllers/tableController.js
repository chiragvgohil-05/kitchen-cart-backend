const Table = require('../models/tableModel');

// @desc    Get all tables
// @route   GET /api/tables
// @access  Public
exports.getTables = async (req, res) => {
    try {
        const tables = await Table.find().sort('tableNumber');
        res.status(200).json({
            success: true,
            count: tables.length,
            data: tables
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create a new table
// @route   POST /api/tables
// @access  Admin
exports.createTable = async (req, res) => {
    try {
        const table = await Table.create(req.body);
        res.status(201).json({
            success: true,
            data: table
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update a table
// @route   PUT /api/tables/:id
// @access  Admin
exports.updateTable = async (req, res) => {
    try {
        const table = await Table.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!table) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }

        res.status(200).json({
            success: true,
            data: table
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete a table
// @route   DELETE /api/tables/:id
// @access  Admin
exports.deleteTable = async (req, res) => {
    try {
        const table = await Table.findByIdAndDelete(req.params.id);

        if (!table) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
