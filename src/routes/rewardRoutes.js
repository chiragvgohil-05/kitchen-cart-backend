const express = require('express');
const router = express.Router();
const { getRewards, createReward, updateReward, deleteReward, redeemReward } = require('../controllers/rewardController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.get('/', getRewards);
router.post('/:id/redeem', protect, authorize('user', 'admin', 'staff'), redeemReward);
router.post('/redeem-during-order', protect, authorize('user', 'admin', 'staff'), require('../controllers/rewardController').redeemRewardDuringOrder);

// Admin Routes
router.post('/', protect, authorize('admin', 'staff'), createReward);
router.put('/:id', protect, authorize('admin', 'staff'), updateReward);
router.delete('/:id', protect, authorize('admin', 'staff'), deleteReward);

module.exports = router;
