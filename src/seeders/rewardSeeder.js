const mongoose = require('mongoose');
const Reward = require('../models/rewardModel');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const defaultRewards = [
    {
        name: "Welcome Treat",
        description: "Enjoy a special 5% discount on any order. Perfect for your next visit!",
        pointsRequired: 500,
        type: "Discount",
        value: 5,
        isActive: true
    },
    {
        name: "Caffeine Kick",
        description: "Redeem your points for a free regular latte or cappuccino of your choice.",
        pointsRequired: 1200,
        type: "FreeItem",
        value: 150,
        isActive: true
    },
    {
        name: "Elite Pass",
        description: "Unlock an exclusive 10% discount on your entire order. For our most loyal fans!",
        pointsRequired: 2500,
        type: "Discount",
        value: 10,
        isActive: true
    }
];

const seedRewards = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for rewards seeding');

        for (const rewardData of defaultRewards) {
            const exists = await Reward.findOne({ name: rewardData.name });
            if (!exists) {
                await Reward.create(rewardData);
                console.log(`Created reward: ${rewardData.name}`);
            } else {
                console.log(`Reward already exists: ${rewardData.name}`);
            }
        }

        mongoose.connection.close();
    } catch (error) {
        console.error('Error seeding rewards:', error);
        process.exit(1);
    }
};

if (require.main === module) {
  seedRewards();
}

module.exports = seedRewards;
