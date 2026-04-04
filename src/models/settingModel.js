const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    address: {
        type: String,
        default: '123 Coffee Street, Brew City, BC 12345'
    },
    phone: {
        type: String,
        default: '+91 (800) 123-4567'
    },
    mobile: {
        type: String,
        default: '+91 (900) 123-4567'
    },
    email: {
        type: String,
        default: 'hello@snoweracafe.com'
    },
    facebook: {
        type: String,
        default: '#'
    },
    instagram: {
        type: String,
        default: '#'
    },
    twitter: {
        type: String,
        default: '#'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Setting', settingSchema);
