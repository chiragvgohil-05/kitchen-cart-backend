const Wishlist = require('../models/wishlistModel');
const Product = require('../models/productModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get user wishlist
// @route   GET /api/v1/wishlist
// @access  Private
exports.getWishlist = async (req, res, next) => {
    try {
        let wishlist = await Wishlist.findOne({ user: req.user.id }).populate('products');

        if (!wishlist) {
            wishlist = await Wishlist.create({ user: req.user.id, products: [] });
        }

        sendResponse(res, 200, true, 'Wishlist fetched successfully', wishlist);
    } catch (err) {
        next(err);
    }
};

// @desc    Add item to wishlist
// @route   POST /api/v1/wishlist
// @access  Private
exports.addToWishlist = async (req, res, next) => {
    try {
        const { productId } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return sendResponse(res, 404, false, 'Product not found');
        }

        let wishlist = await Wishlist.findOne({ user: req.user.id });

        if (!wishlist) {
            wishlist = await Wishlist.create({
                user: req.user.id,
                products: [productId]
            });
        } else {
            // Check if already in wishlist
            if (!wishlist.products.includes(productId)) {
                wishlist.products.push(productId);
                await wishlist.save();
            }
        }

        const populatedWishlist = await Wishlist.findById(wishlist._id).populate('products');
        sendResponse(res, 200, true, 'Item added to wishlist', populatedWishlist);
    } catch (err) {
        next(err);
    }
};

// @desc    Remove item from wishlist
// @route   DELETE /api/v1/wishlist/:productId
// @access  Private
exports.removeFromWishlist = async (req, res, next) => {
    try {
        const wishlist = await Wishlist.findOne({ user: req.user.id });

        if (!wishlist) {
             return sendResponse(res, 404, false, 'Wishlist not found');
        }

        wishlist.products = wishlist.products.filter(
            id => id.toString() !== req.params.productId
        );
        await wishlist.save();

        const populatedWishlist = await Wishlist.findById(wishlist._id).populate('products');
        sendResponse(res, 200, true, 'Item removed from wishlist', populatedWishlist);
    } catch (err) {
        next(err);
    }
};
