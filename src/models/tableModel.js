const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    tableNumber: {
        type: String,
        required: [true, 'Please add a table number'],
        unique: true,
        trim: true
    },
    capacity: {
        type: Number,
        required: [true, 'Please add table capacity'],
        min: [1, 'Capacity must be at least 1']
    },
    status: {
        type: String,
        enum: ['Available', 'Reserved', 'Occupied', 'Maintenance'],
        default: 'Available'
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    location: {
        type: String,
        default: 'Indoor'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Sync isAvailable with status for backward/internal compatibility
tableSchema.pre('save', function(next) {
    this.isAvailable = (this.status === 'Available');
    next();
});

module.exports = mongoose.model('Table', tableSchema);
