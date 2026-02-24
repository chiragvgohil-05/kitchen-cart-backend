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
    const mrp = Number(this.mrp);
    const sellingPrice = Number(this.sellingPrice);

    if (!Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
        this.discount = 0;
        return next();
    }

    const discount = ((mrp - sellingPrice) / mrp) * 100;
    this.discount = Math.max(0, Math.round(discount));

    next();
});

module.exports = mongoose.model('Product', productSchema);
