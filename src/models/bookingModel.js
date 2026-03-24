const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Booking must belong to a user']
    },
    table: {
        type: mongoose.Schema.ObjectId,
        ref: 'Table',
        required: [true, 'Booking must have a table']
    },
    bookingDate: {
        type: Date,
        required: [true, 'Please provide a booking date']
    },
    startTime: {
        type: String,
        required: [true, 'Please provide a start time']
    },
    endTime: {
        type: String,
        required: [true, 'Please provide an end time']
    },
    timeSlot: { // Preserve for legacy compatibility if needed
        type: String
    },
    numberOfPeople: {
        type: Number,
        required: [true, 'Please specify the number of people'],
        min: [1, 'There must be at least 1 person']
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'],
        default: 'Pending'
    },
    specialRequests: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Alias for frontend compatibility if needed (virtuals)
bookingSchema.virtual('bookingTime').get(function() { 
    return this.startTime && this.endTime ? `${this.startTime} - ${this.endTime}` : this.timeSlot; 
});
bookingSchema.virtual('numberOfGuests').get(function() { return this.numberOfPeople; });
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

// Remove unique index on timeSlot as we move to range-based overlaps
// Indexing for faster lookups on these fields
bookingSchema.index({ table: 1, bookingDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
