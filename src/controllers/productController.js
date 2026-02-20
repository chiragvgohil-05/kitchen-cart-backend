const Product = require('../models/productModel');
const sendResponse = require('../utils/responseHandler');
const { productSchema, updateProductSchema } = require('../validations/productValidation');

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = async (req, res, next) => {
    try {
        let query;
        const reqQuery = { ...req.query };
        const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
        removeFields.forEach(param => delete reqQuery[param]);

        let queryStr = JSON.stringify(reqQuery);
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        let searchObj = {};
        if (req.query.search) {
            searchObj = {
                name: { $regex: req.query.search, $options: 'i' }
            };
        }

        query = Product.find({ ...JSON.parse(queryStr), ...searchObj }).populate('category', 'name');

        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }

        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = await Product.countDocuments({ ...JSON.parse(queryStr), ...searchObj });

        query = query.skip(startIndex).limit(limit);
        const products = await query;

        const pagination = {};
        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }
        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        sendResponse(res, 200, true, 'Products fetched successfully', {
            count: products.length,
            total,
            pagination,
            products
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).populate('category', 'name');
        if (!product) {
            return sendResponse(res, 404, false, 'Product not found');
        }
        sendResponse(res, 200, true, 'Product fetched successfully', product);
    } catch (err) {
        next(err);
    }
};

// @desc    Create new product
// @route   POST /api/v1/products
// @access  Private/Admin
exports.createProduct = async (req, res, next) => {
    try {
        if (req.files && req.files.length > 0) {
            req.body.images = req.files.map(file => `/public/uploads/products/${file.filename}`);
        }

        // Parse keyFeatures and technicalSpecs if they come as strings (common with FormData)
        if (typeof req.body.keyFeatures === 'string') {
            try { req.body.keyFeatures = JSON.parse(req.body.keyFeatures); } catch (e) { req.body.keyFeatures = [req.body.keyFeatures]; }
        }
        if (typeof req.body.technicalSpecs === 'string') {
            try { req.body.technicalSpecs = JSON.parse(req.body.technicalSpecs); } catch (e) { req.body.technicalSpecs = {}; }
        }

        const { error } = productSchema.validate(req.body);
        if (error) {
            return sendResponse(res, 400, false, 'Validation Error', null, error.details[0].message);
        }

        if (!req.body.images || req.body.images.length === 0) {
            return sendResponse(res, 400, false, 'Please upload at least one image');
        }

        const product = await Product.create(req.body);
        sendResponse(res, 201, true, 'Product created successfully', product);
    } catch (err) {
        next(err);
    }
};

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) {
            return sendResponse(res, 404, false, 'Product not found');
        }

        // Handle Images
        let images = [];
        if (req.body.existingImages) {
            images = Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages];
        }
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => `/public/uploads/products/${file.filename}`);
            images = [...images, ...newImages];
        }
        req.body.images = images;

        // Parse JSON fields
        if (typeof req.body.keyFeatures === 'string') {
            try { req.body.keyFeatures = JSON.parse(req.body.keyFeatures); } catch (e) { }
        }
        if (typeof req.body.technicalSpecs === 'string') {
            try { req.body.technicalSpecs = JSON.parse(req.body.technicalSpecs); } catch (e) { }
        }

        const { error } = updateProductSchema.validate(req.body);
        if (error) {
            return sendResponse(res, 400, false, 'Validation Error', null, error.details[0].message);
        }

        product = await Product.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        sendResponse(res, 200, true, 'Product updated successfully', product);
    } catch (err) {
        next(err);
    }
};

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return sendResponse(res, 404, false, 'Product not found');
        }
        await product.deleteOne();
        sendResponse(res, 200, true, 'Product deleted successfully', {});
    } catch (err) {
        next(err);
    }
};
