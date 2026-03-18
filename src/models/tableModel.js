const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    tableNumber: {
        type: String,
        required: [true, 'Please add a table number'],
        unique: true
    },
    capacity: {
        type: Number,
        required: [true, 'Please add table capacity']
    },
    location: {
        type: String,
        enum: ['Indoor', 'Outdoor', 'Balcony', 'Private Room'],
        default: 'Indoor'
    },
    status: {
        type: String,
        enum: ['Available', 'Reserved', 'Occupied'],
        default: 'Available'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Table', tableSchema);
