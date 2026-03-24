const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect, authorize } = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/dashboard/stats
 * @access  Private/Admin
 */
router.get('/stats', protect, authorize('admin'), dashboardController.getDashboardStats);

module.exports = router;
