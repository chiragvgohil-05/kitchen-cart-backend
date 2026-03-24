const express = require('express');
const {
    getBookings,
    getAvailableTables,
    createBooking,
    updateBookingStatus
} = require('../controllers/bookingController');

const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/available', getAvailableTables);

router.use(protect);

router.get('/', getBookings);
router.post('/', createBooking);
router.patch('/:id', updateBookingStatus);
router.put('/:id/status', updateBookingStatus); // Support existing admin frontend

module.exports = router;
