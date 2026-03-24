const User = require('../models/userModel');
const LoyaltyTransaction = require('../models/loyaltyTransactionModel');
const LoyaltyRule = require('../models/loyaltyRuleModel');

/**
 * Update user tier based on total loyalty points accumulated.
 */
exports.updateUserTier = async (userId, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user) return;

    // Default rules (Fallback if no rule exists)
    const tiers = [
        { name: 'Platinum', min: 10000 },
        { name: 'Gold', min: 5000 },
        { name: 'Silver', min: 1000 },
        { name: 'Bronze', min: 0 }
    ];

    let newTier = 'Bronze';
    for (const tier of tiers) {
        if (user.loyaltyPoints >= tier.min) {
            newTier = tier.name;
            break;
        }
    }

    if (user.loyaltyTier !== newTier) {
        user.loyaltyTier = newTier;
        await user.save({ session });
    }
};

/**
 * Add loyalty points to a user based on an order.
 */
exports.addPointsForOrder = async ({ userId, orderId, amount }, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user) return;

    // Base rate: 1 point per 10 currency spent
    let pointsToAdd = Math.floor(amount * 0.1); 

    // Apply Tier Multipliers
    const multipliers = {
        'Platinum': 1.5,
        'Gold': 1.2,
        'Silver': 1.1,
        'Bronze': 1.0
    };

    const multiplier = multipliers[user.loyaltyTier] || 1.0;
    pointsToAdd = Math.floor(pointsToAdd * multiplier);

    if (pointsToAdd <= 0) return;

    user.loyaltyPoints += pointsToAdd;
    await user.save({ session });

    await LoyaltyTransaction.create([{
        user: userId,
        order: orderId,
        type: 'Earned',
        points: pointsToAdd,
        reason: `Earned from order #${orderId.toString().slice(-6).toUpperCase()} (${user.loyaltyTier} bonus applied)`
    }], { session });

    await this.updateUserTier(userId, session);
    return pointsToAdd;
};

/**
 * Add welcome points for new registration
 */
exports.addWelcomePoints = async (userId, session = null) => {
    const welcomePoints = 50;
    
    await User.findByIdAndUpdate(
        userId,
        { $inc: { loyaltyPoints: welcomePoints } },
        { session }
    );

    await LoyaltyTransaction.create([{
        user: userId,
        type: 'Earned',
        points: welcomePoints,
        reason: 'Welcome bonus for joining our loyalty program!'
    }], { session });

    await this.updateUserTier(userId, session);
};

/**
 * Redeem points for a reward.
 */
exports.redeemPoints = async ({ userId, rewardId, pointsRequired, reason }, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user || user.loyaltyPoints < pointsRequired) {
        throw new Error('Loyalty balance is below the required threshold for this transaction.');
    }


    user.loyaltyPoints -= pointsRequired;
    await user.save({ session });

    await LoyaltyTransaction.create([{
        user: userId,
        reward: rewardId,
        type: 'Redeemed',
        points: pointsRequired,
        reason: reason || 'Reward redemption'
    }], { session });

    await this.updateUserTier(userId, session); // Re-check tier if points reduced (usually stays)
};

/**
 * Redeem reward during checkout/order.
 * Returns { discountAmount, finalAmount, remainingPoints }
 */
exports.redeemRewardDuringCheckout = async ({ userId, reward, orderAmount }, session = null) => {
    // 1. Validation
    if (!orderAmount || orderAmount <= 0) {
        throw new Error('Invalid order amount');
    }

    const user = await User.findById(userId).session(session);
    if (!user || user.loyaltyPoints < reward.pointsRequired) {
        throw new Error(`Loyalty balance is insufficient for this redemption. (Threshold: ${reward.pointsRequired})`);
    }


    // 2. Logic: Discount calculation
    let discountAmount = 0;
    if (reward.type === 'Discount') {
        discountAmount = Math.round((orderAmount * reward.value) / 100);
    } else if (reward.type === 'Voucher') {
        discountAmount = reward.value; // Fixed amount
    }

    // Cap discount to order amount
    discountAmount = Math.min(discountAmount, orderAmount);
    const finalAmount = orderAmount - discountAmount;

    // 3. Deduction
    const pointsUsed = reward.pointsRequired;
    user.loyaltyPoints -= pointsUsed;
    await user.save({ session });

    // 4. Record Transaction
    await LoyaltyTransaction.create([{
        user: userId,
        reward: reward._id,
        type: 'Redeemed',
        points: pointsUsed,
        discountAmount,
        finalAmount,
        reason: `Claimed ${reward.name} on order worth ₹${orderAmount}`
    }], { session });

    // Debug Logs
    console.log(`[Loyalty REDEEM] User: ${user.name} | Points: ${user.loyaltyPoints + pointsUsed} -> ${user.loyaltyPoints}`);
    console.log(`[Loyalty REDEEM] Amount: ${orderAmount} | Discount: ${discountAmount} | Final: ${finalAmount}`);

    // Update Tier
    await this.updateUserTier(userId, session);

    return { 
        success: true,
        discount: discountAmount,
        final_amount: finalAmount,
        remaining_points: user.loyaltyPoints
    };
};

