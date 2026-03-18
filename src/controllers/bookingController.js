const Booking = require('../models/bookingModel');
const Table = require('../models/tableModel');

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
exports.getBookings = async (req, res) => {
    try {
        let query;

        // If admin/staff show all, else only user's bookings
        if (req.user.role === 'admin' || req.user.role === 'staff') {
            query = Booking.find().populate('user table');
        } else {
            query = Booking.find({ user: req.user._id }).populate('table');
        }

        const bookings = await query.sort('-createdAt');

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get available tables for a certain date/time
// @route   GET /api/bookings/available
// @access  Public
exports.getAvailableTables = async (req, res) => {
    try {
        const { date, startTime, endTime } = req.query;

        if (!date || !startTime || !endTime) {
            return res.status(200).json({ success: true, data: [] });
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

        res.status(200).json({
            success: true,
            data: availableTables
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Registered User
exports.createBooking = async (req, res) => {
    try {
        const { table, bookingDate, startTime, endTime, specialRequests } = req.body;
        const numberOfPeople = req.body.numberOfPeople || req.body.numberOfGuests;

        if (!startTime || !endTime) {
            return res.status(400).json({ success: false, message: 'Please provide start and end time' });
        }

        // 1. Check Max 5 hours duration
        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);
        const durationMin = endMin - startMin;

        if (durationMin <= 0) {
            return res.status(400).json({ success: false, message: 'End time must be after start time' });
        }
        if (durationMin > 300) {
            return res.status(400).json({ success: false, message: 'Maximum booking duration is 5 hours' });
        }

        // 2. Check table capacity
        const requestedTable = await Table.findById(table);
        if (!requestedTable) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }
        if (requestedTable.capacity < numberOfPeople) {
            return res.status(400).json({
                success: false,
                message: `This table only accommodates up to ${requestedTable.capacity} people`
            });
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
            return res.status(400).json({
                success: false,
                message: 'This table overlaps with an existing booking'
            });
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

        res.status(201).json({
            success: true,
            data: booking
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update booking status (Admin: confirm/complete, User: cancel)
// @route   PATCH /api/bookings/:id  OR  PUT /api/bookings/:id/status
// @access  Registered User / Admin
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Basic authorization
        if (req.user.role === 'user') {
            if (booking.user.toString() !== req.user._id.toString()) {
                return res.status(401).json({ success: false, message: 'Not authorized' });
            }
            if (status !== 'Cancelled') {
                return res.status(400).json({ success: false, message: 'You can only cancel your booking' });
            }
        }

        booking.status = status;
        await booking.save();

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
