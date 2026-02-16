const Category = require('../models/categoryModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get all categories
// @route   GET /api/v1/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
    try {
        const categories = await Category.find();
        sendResponse(res, 200, true, 'Categories fetched successfully', categories);
    } catch (err) {
        next(err);
    }
};

// @desc    Get single category
// @route   GET /api/v1/categories/:id
// @access  Public
exports.getCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return sendResponse(res, 404, false, 'Category not found');
        }

        sendResponse(res, 200, true, 'Category fetched successfully', category);
    } catch (err) {
        next(err);
    }
};

// @desc    Create new category
// @route   POST /api/v1/categories
// @access  Private/Admin
exports.createCategory = async (req, res, next) => {
    try {
        const category = await Category.create(req.body);
        sendResponse(res, 201, true, 'Category created successfully', category);
    } catch (err) {
        next(err);
    }
};

// @desc    Update category
// @route   PUT /api/v1/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res, next) => {
    try {
        let category = await Category.findById(req.params.id);

        if (!category) {
            return sendResponse(res, 404, false, 'Category not found');
        }

        category = await Category.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        sendResponse(res, 200, true, 'Category updated successfully', category);
    } catch (err) {
        next(err);
    }
};

// @desc    Delete category
// @route   DELETE /api/v1/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return sendResponse(res, 404, false, 'Category not found');
        }

        await category.deleteOne();

        sendResponse(res, 200, true, 'Category deleted successfully', {});
    } catch (err) {
        next(err);
    }
};
