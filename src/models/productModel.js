const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    mrp: {
        type: Number,
        required: [true, 'Please add the MRP/Old price']
    },
    sellingPrice: {
        type: Number,
        required: [true, 'Please add the selling price']
    },
    discount: {
        type: Number,
        default: 0
    },
    category: {
        type: mongoose.Schema.ObjectId,
        ref: 'Category',
        required: true
    },
    stock: {
        type: Number,
        required: [true, 'Please add stock quantity'],
        default: 0
    },
    images: [{
        type: String,
        required: [true, 'Please upload at least one image']
    }],
    keyFeatures: [{
        type: String
    }],
    technicalSpecs: {
        type: Map,
        of: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate discount before saving
productSchema.pre('save', function (next) {
    if (this.mrp && this.sellingPrice) {
        this.discount = Math.round(((this.mrp - this.sellingPrice) / this.mrp) * 100);
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);
