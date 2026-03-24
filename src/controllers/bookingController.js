const Booking = require('../models/bookingModel');
const Table = require('../models/tableModel');
const sendResponse = require('../utils/responseHandler');

const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hrs, mins] = timeStr.split(':').map(Number);
    return (hrs * 60) + (mins || 0);
};

const isOverlapping = (start1, end1, start2, end2) => {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return s1 < e2 && s2 < e1;
};

// @desc    Get all bookings (admin view: all, user view: only theirs)
// @route   GET /api/bookings
// @access  Registered Users / Admin
exports.getBookings = async (req, res, next) => {
    try {
        let query;

        // If admin/staff show all, else only user's bookings
        if (req.user.role === 'admin' || req.user.role === 'staff') {
            query = Booking.find().populate('user table');
        } else {
            query = Booking.find({ user: req.user._id }).populate('table');
        }

        const bookings = await query.sort('-createdAt');

        sendResponse(res, 200, true, 'Reservations retrieved successfully.', bookings);
    } catch (err) {
        next(err);
    }
};

// @desc    Get available tables for a certain date/time
// @route   GET /api/bookings/available
// @access  Public
exports.getAvailableTables = async (req, res, next) => {
    try {
        const { date, startTime, endTime } = req.query;

        if (!date || !startTime || !endTime) {
            return sendResponse(res, 200, true, 'No criteria provided for availability check.', []);
        }

        const normalizedDate = new Date(date);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        // 1. Get all tables that are currently "status: Available"
        const activeTables = await Table.find({ status: 'Available' });

        // 2. Identify the bookings for the given date that overlap
        const dayBookings = await Booking.find({
            bookingDate: normalizedDate,
            status: { $in: ['Confirmed', 'Pending'] }
        });

        // 3. Filter out tables that have overlapping bookings
        const bookedTableIdsForSlot = dayBookings
            .filter(b => isOverlapping(startTime, endTime, b.startTime, b.endTime))
            .map(b => b.table.toString());

        // 4. Return tables that aren't booked
        const availableTables = activeTables.filter(t => !bookedTableIdsForSlot.includes(t._id.toString()));

        sendResponse(res, 200, true, 'Available tables for the selected slot retrieved successfully.', availableTables);
    } catch (err) {
        next(err);
    }
};

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Registered User
exports.createBooking = async (req, res, next) => {
    try {
        const { table, bookingDate, startTime, endTime, specialRequests } = req.body;
        const numberOfPeople = req.body.numberOfPeople || req.body.numberOfGuests;

        if (!startTime || !endTime) {
            return sendResponse(res, 400, false, 'Both start and end times are required to process your reservation.');
        }

        // 1. Check Max 5 hours duration
        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);
        const durationMin = endMin - startMin;

        if (durationMin <= 0) {
            return sendResponse(res, 400, false, 'The reservation end time must be later than the start time.');
        }
        if (durationMin > 300) {
            return sendResponse(res, 400, false, 'Reservations are limited to a maximum duration of 5 hours.');
        }

        // 2. Check table capacity
        const requestedTable = await Table.findById(table);
        if (!requestedTable) {
            return sendResponse(res, 404, false, 'The requested table could not be found in our system.');
        }
        if (requestedTable.capacity < numberOfPeople) {
            return sendResponse(res, 400, false, `The selected table has a maximum capacity of ${requestedTable.capacity} guests.`);
        }

        const normalizedBookingDate = new Date(bookingDate);
        normalizedBookingDate.setUTCHours(0, 0, 0, 0);

        // 3. Check for overlapping bookings
        const existingBookings = await Booking.find({
            table,
            bookingDate: normalizedBookingDate,
            status: { $in: ['Confirmed', 'Pending'] }
        });

        const hasOverlap = existingBookings.some(b => isOverlapping(startTime, endTime, b.startTime, b.endTime));

        if (hasOverlap) {
            return sendResponse(res, 400, false, 'The selected time slot overlaps with an existing reservation for this table.');
        }

        // 4. Create booking
        const booking = await Booking.create({
            user: req.user._id,
            table,
            bookingDate: normalizedBookingDate,
            startTime,
            endTime,
            timeSlot: `${startTime} - ${endTime}`,
            numberOfPeople,
            specialRequests
        });

        sendResponse(res, 201, true, 'Your reservation has been successfully booked.', booking);
    } catch (err) {
        next(err);
    }
};

// @desc    Update booking status (Admin: confirm/complete, User: cancel)
// @route   PATCH /api/bookings/:id  OR  PUT /api/bookings/:id/status
// @access  Registered User / Admin
exports.updateBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'The specified reservation could not be found.');
        }

        // Basic authorization
        if (req.user.role === 'user') {
            if (booking.user.toString() !== req.user._id.toString()) {
                return sendResponse(res, 401, false, 'You do not have the required permissions to perform this action.');
            }
            if (status !== 'Cancelled') {
                return sendResponse(res, 400, false, 'Users are only permitted to cancel their own reservations.');
            }
        }

        booking.status = status;
        await booking.save();

        sendResponse(res, 200, true, `Reservation status updated to ${status} successfully.`, booking);
    } catch (err) {
        next(err);
    }
};
