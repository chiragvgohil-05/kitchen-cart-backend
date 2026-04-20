const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables');
            process.exit(1);
        }

        console.log('Attempting to connect to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB Connection Error:');
        console.error(`Message: ${error.message}`);
        console.error(`Code: ${error.code}`);
        if (error.message.includes('ETIMEOUT')) {
            console.error('Tip: Check if your MongoDB Atlas IP Whitelist allows access from all IPs (0.0.0.0/0).');
        }
        process.exit(1);
    }
};

module.exports = connectDB;
