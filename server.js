require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Connect to Database
console.log('Starting server initialization...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Configured Port: ${PORT}`);

const server = app.listen(PORT, () => {
    console.log(`Server is live and running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/`);
    
    // Connect to Database after server starts
    connectDB();
});

// Handle usage of unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error('CRITICAL: Unhandled Promise Rejection');
    console.error(`Error message: ${err.message}`);
    if (err.stack) console.error(err.stack);
    
    // Close server & exit process to allow Railway to restart the container
    server.close(() => {
        console.log('Server closed due to critical error.');
        process.exit(1);
    });
});
