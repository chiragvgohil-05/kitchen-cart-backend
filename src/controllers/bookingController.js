const Booking = require('../models/bookingModel');
const Table = require('../models/tableModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Create new booking
// @route   POST /api/v1/bookings
// @access  Private
exports.createBooking = async (req, res, next) => {
    try {
        req.body.user = req.user.id;

        // Check if table exists and is available
        const table = await Table.findById(req.body.table);
        if (!table) {
            return sendResponse(res, 404, false, 'Table not found');
        }

        if (table.status === 'Occupied') {
            return sendResponse(res, 400, false, 'Table is currently occupied');
        }

        const booking = await Booking.create(req.body);

        // Update table status optionally, or handle availability logic separately
        // For simplicity, we just create the booking record

        sendResponse(res, 201, true, 'Booking created successfully', booking);
    } catch (err) {
        next(err);
    }
};

// @desc    Get my bookings
// @route   GET /api/v1/bookings/mybookings
// @access  Private
exports.getMyBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ user: req.user.id }).populate('table');
        sendResponse(res, 200, true, 'User bookings fetched successfully', bookings);
    } catch (err) {
        next(err);
    }
};

// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @access  Private/Admin/Staff
exports.getAllBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find().populate('user').populate('table');
        sendResponse(res, 200, true, 'All bookings fetched successfully', bookings);
    } catch (err) {
        next(err);
    }
};

// @desc    Update booking status
// @route   PUT /api/v1/bookings/:id/status
// @access  Private/Admin/Staff
exports.updateBookingStatus = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Booking not found');
        }

        booking.status = req.body.status;
        await booking.save();

        // If booking is confirmed or completed, we might want to update table status
        if (req.body.status === 'Confirmed') {
            await Table.findByIdAndUpdate(booking.table, { status: 'Reserved' });
        } else if (req.body.status === 'Completed' || req.body.status === 'Cancelled') {
            await Table.findByIdAndUpdate(booking.table, { status: 'Available' });
        }

        sendResponse(res, 200, true, 'Booking status updated successfully', booking);
    } catch (err) {
        next(err);
    }
};

// @desc    Cancel booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private
exports.cancelBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Booking not found');
        }

        // Make sure user owns booking or is admin/staff
        if (booking.user.toString() !== req.user.id && req.user.role === 'user') {
            return sendResponse(res, 401, false, 'Not authorized to cancel this booking');
        }

        booking.status = 'Cancelled';
        await booking.save();

        // Update table status to available
        await Table.findByIdAndUpdate(booking.table, { status: 'Available' });

        sendResponse(res, 200, true, 'Booking cancelled successfully', {});
    } catch (err) {
        next(err);
    }
};
