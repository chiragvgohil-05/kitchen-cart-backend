const express = require('express');
const router = express.Router();
const { getMe, getHistory, getAllTransactions, addManualPoints } = require('../controllers/loyaltyController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.get('/me', protect, authorize('user'), getMe); // Current user status
router.get('/history', protect, authorize('user'), getHistory); // Current user history

// Admin/Staff routes
router.get('/all', protect, authorize('admin', 'staff'), getAllTransactions);
router.post('/add', protect, authorize('admin', 'staff'), addManualPoints);

module.exports = router;
