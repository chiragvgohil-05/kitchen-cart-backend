const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../kitchen-cart-backend/.env') });

const Order = require('../kitchen-cart-backend/src/models/orderModel');

async function checkOrder() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kitchen_cart');
        console.log('Connected to DB');
        
        const orderId = '69e47476555355cfa8cab110';
        const order = await Order.findById(orderId);
        
        if (!order) {
            console.log('Order not found');
        } else {
            console.log('Order Details:');
            console.log(JSON.stringify({
                _id: order._id,
                status: order.status,
                gatewayAmount: order.gatewayAmount,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus
            }, null, 2));
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

checkOrder();
