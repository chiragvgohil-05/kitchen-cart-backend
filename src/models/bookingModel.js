const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    table: {
        type: mongoose.Schema.ObjectId,
        ref: 'Table',
        required: true
    },
    bookingDate: {
        type: Date,
        required: [true, 'Please add a booking date']
    },
    bookingTime: {
        type: String,
        required: [true, 'Please add a booking time']
    },
    numberOfGuests: {
        type: Number,
        required: [true, 'Please add number of guests']
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'],
        default: 'Pending'
    },
    specialRequests: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Booking', bookingSchema);
