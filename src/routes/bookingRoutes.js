const express = require('express');
const {
    createBooking,
    getMyBookings,
    getAllBookings,
    updateBookingStatus,
    cancelBooking
} = require('../controllers/bookingController');

const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(protect); // All booking routes need protection

router.post('/', createBooking);
router.get('/mybookings', getMyBookings);

// Admin and Staff can get all bookings and update status
router.get('/', authorize('admin', 'staff'), getAllBookings);
router.put('/:id/status', authorize('admin', 'staff'), updateBookingStatus);

router.delete('/:id', cancelBooking);

module.exports = router;
