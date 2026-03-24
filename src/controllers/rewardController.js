const Reward = require('../models/rewardModel');
const sendResponse = require('../utils/responseHandler');
const { redeemPoints, redeemRewardDuringCheckout } = require('../services/loyaltyService');


// @desc    Get all active rewards
// @route   GET /api/rewards
// @access  Public
exports.getRewards = async (req, res) => {
    try {
        const rewards = await Reward.find({ isActive: true });
        sendResponse(res, 200, true, 'Active loyalty rewards retrieved successfully.', rewards);
    } catch (err) {
        sendResponse(res, 500, false, err.message);
    }
};

// @desc    Create a new reward
// @route   POST /api/rewards
// @access  Admin
exports.createReward = async (req, res) => {
    try {
        const reward = await Reward.create(req.body);
        sendResponse(res, 201, true, 'New loyalty reward added to the program successfully.', reward);
    } catch (err) {
        sendResponse(res, 400, false, err.message);
    }
};

// @desc    Update a reward
// @route   PUT /api/rewards/:id
// @access  Admin
exports.updateReward = async (req, res) => {
    try {
        const reward = await Reward.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!reward) {
            return sendResponse(res, 404, false, 'The requested loyalty reward could not be found.');
        }
        sendResponse(res, 200, true, 'Loyalty reward details updated successfully.', reward);
    } catch (err) {
        sendResponse(res, 400, false, err.message);
    }
};

// @desc    Delete a reward
// @route   DELETE /api/rewards/:id
// @access  Admin
exports.deleteReward = async (req, res) => {
    try {
        const reward = await Reward.findByIdAndDelete(req.params.id);
        if (!reward) {
            return sendResponse(res, 404, false, 'The requested loyalty reward could not be found.');
        }
        sendResponse(res, 200, true, 'Loyalty reward removed from the program successfully.');
    } catch (err) {
        sendResponse(res, 400, false, err.message);
    }
};

// @desc    Redeem points for a reward
// @route   POST /api/rewards/:id/redeem
// @access  User
exports.redeemReward = async (req, res) => {
    try {
        const reward = await Reward.findById(req.params.id);
        if (!reward || !reward.isActive) {
            return sendResponse(res, 404, false, 'The requested reward is either unavailable or has been deactivated.');
        }

        await redeemPoints({
            userId: req.user.id,
            rewardId: reward._id,
            pointsRequired: reward.pointsRequired,
            reason: `Redeemed for ${reward.name}`
        });

        sendResponse(res, 200, true, 'Loyalty points transformed into your chosen reward successfully.');
    } catch (err) {
        sendResponse(res, 400, false, err.message);
    }
};

// @desc    Redeem reward during checkout
// @route   POST /api/rewards/redeem-during-order
// @access  User
exports.redeemRewardDuringOrder = async (req, res) => {
    try {
        const { reward_id, order_amount } = req.body;

        const reward = await Reward.findById(reward_id);
        if (!reward || !reward.isActive) {
            return sendResponse(res, 404, false, 'The requested reward is either unavailable or has been deactivated.');
        }

        const result = await redeemRewardDuringCheckout({
            userId: req.user.id,
            reward,
            orderAmount: order_amount
        });

        sendResponse(res, 200, true, 'Reward discount applied to your current order successfully.', result);
    } catch (err) {
        sendResponse(res, 400, false, err.message);
    }
};
