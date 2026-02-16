const express = require('express');
const {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart
} = require('../controllers/cartController');

const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getCart)
    .post(addToCart);

router.route('/:itemId')
    .put(updateCartItem)
    .delete(removeFromCart);

module.exports = router;
