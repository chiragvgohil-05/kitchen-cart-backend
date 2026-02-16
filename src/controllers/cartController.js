const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const sendResponse = require('../utils/responseHandler');

// @desc    Get user cart
// @route   GET /api/v1/cart
// @access  Private
exports.getCart = async (req, res, next) => {
    try {
        let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

        if (!cart) {
            cart = await Cart.create({ user: req.user.id, items: [] });
        }

        sendResponse(res, 200, true, 'Cart fetched successfully', cart);
    } catch (err) {
        next(err);
    }
};

// @desc    Add item to cart
// @route   POST /api/v1/cart
// @access  Private
exports.addToCart = async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;
        const qty = parseInt(quantity) || 1;

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return sendResponse(res, 404, false, 'Product not found');
        }

        let cart = await Cart.findOne({ user: req.user.id });

        if (!cart) {
            cart = await Cart.create({
                user: req.user.id,
                items: [{ product: productId, quantity: qty }]
            });
        } else {
            // Check if product already in cart
            const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);

            if (itemIndex > -1) {
                // Update quantity
                cart.items[itemIndex].quantity += qty;
            } else {
                // Add new item
                cart.items.push({ product: productId, quantity: qty });
            }
            await cart.save();
        }

        const populatedCart = await Cart.findById(cart._id).populate('items.product');
        sendResponse(res, 200, true, 'Item added to cart', populatedCart);
    } catch (err) {
        next(err);
    }
};

// @desc    Update cart item quantity
// @route   PUT /api/v1/cart/:itemId
// @access  Private
exports.updateCartItem = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        
        const cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
            return sendResponse(res, 404, false, 'Cart not found');
        }

        const item = cart.items.id(req.params.itemId);
        if (!item) {
            return sendResponse(res, 404, false, 'Item not found in cart');
        }

        item.quantity = quantity;
        await cart.save();

        const populatedCart = await Cart.findById(cart._id).populate('items.product');
        sendResponse(res, 200, true, 'Cart updated', populatedCart);
    } catch (err) {
        next(err);
    }
};

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/:itemId
// @access  Private
exports.removeFromCart = async (req, res, next) => {
    try {
        const cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
             return sendResponse(res, 404, false, 'Cart not found');
        }

        cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
        await cart.save();

        const populatedCart = await Cart.findById(cart._id).populate('items.product');
        sendResponse(res, 200, true, 'Item removed from cart', populatedCart);
    } catch (err) {
        next(err);
    }
};
