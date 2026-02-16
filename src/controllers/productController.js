const Product = require('../models/productModel');
const sendResponse = require('../utils/responseHandler');
const { productSchema, updateProductSchema } = require('../validations/productValidation');

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = async (req, res, next) => {
    try {
        let query;

        // Copy req.query
        const reqQuery = { ...req.query };

        // Fields to exclude
        const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
        removeFields.forEach(param => delete reqQuery[param]);

        // Create query string
        let queryStr = JSON.stringify(reqQuery);

        // Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        // Search by name
        let searchObj = {};
        if (req.query.search) {
            searchObj = {
                name: { $regex: req.query.search, $options: 'i' }
            };
        }

        // Finding resource
        query = Product.find({ ...JSON.parse(queryStr), ...searchObj }).populate('category', 'name');

        // Select Fields
        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }

        // Sort
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = await Product.countDocuments({ ...JSON.parse(queryStr), ...searchObj });

        query = query.skip(startIndex).limit(limit);

        // Executing query
        const products = await query;

        // Pagination result
        const pagination = {};

        if (endIndex < total) {
            pagination.next = {
                page: page + 1,
                limit
            };
        }

        if (startIndex > 0) {
            pagination.prev = {
                page: page - 1,
                limit
            };
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
        // Validate request body
        const { error } = productSchema.validate(req.body);
        if (error) {
            return sendResponse(res, 400, false, 'Validation Error', null, error.details[0].message);
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

        // Validate request body
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
