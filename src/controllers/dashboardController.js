const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const sendResponse = require('../utils/responseHandler');

/**
 * @desc    Get dashboard statistics for admin
 * @route   GET /api/dashboard/stats
 * @access  Private/Admin
 */
exports.getDashboardStats = async (req, res, next) => {
    try {
        // 1. Total Revenue (Delivered & Served orders)
        const revenueResult = await Order.aggregate([
            { $match: { status: { $in: ['Delivered', 'Served'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // 2. Order counts
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: { $in: ['Pending', 'Confirmed', 'Preparing'] } });
        const liveOrders = await Order.countDocuments({ status: { $in: ['Confirmed', 'Preparing', 'Ready'] } });

        // 3. User counts
        const totalCustomers = await User.countDocuments({ role: 'user' });

        // 4. Low stock products (stock < 10)
        const lowStockProducts = await Product.find({ stock: { $lt: 10 } }).limit(5).select('name stock category').populate('category', 'name');

        // 5. Recent 5 orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'name email')
            .populate('items.product', 'name');

        // 6. Top selling products (by quantity)
        // We need to unwind items and group by product
        const topSellingResult = await Order.aggregate([
            { $match: { status: { $in: ['Delivered', 'Served', 'Shipped'] } } },
            { $unwind: '$items' },
            { $group: { _id: '$items.product', totalQty: { $sum: '$items.quantity' } } },
            { $sort: { totalQty: -1 } },
            { $limit: 5 }
        ]);
        
        // Populate top selling products
        const topSellingProducts = await Product.populate(topSellingResult, { path: '_id', select: 'name sellingPrice' });

        // 7. Sales trends (last 7 days)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            last7Days.push(d);
        }

        const salesTrends = await Promise.all(last7Days.map(async (day) => {
            const nextDay = new Date(day);
            nextDay.setDate(day.getDate() + 1);

            const dayRevenue = await Order.aggregate([
                { $match: { 
                    status: { $in: ['Delivered', 'Served'] },
                    createdAt: { $gte: day, $lt: nextDay }
                }},
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);

            return {
                day: day.toLocaleDateString('en-US', { weekday: 'short' }),
                revenue: dayRevenue.length > 0 ? dayRevenue[0].total : 0
            };
        }));

        sendResponse(res, 200, true, 'Dashboard statistics retrieved successfully.', {
            totalRevenue,
            totalOrders,
            pendingOrders,
            liveOrders,
            totalCustomers,
            lowStockProducts,
            recentOrders,
            topSellingProducts,
            salesTrends
        });

    } catch (err) {
        next(err);
    }
};
