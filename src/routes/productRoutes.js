const express = require('express');
const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');

const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.route('/')
    .get(getProducts)
    .post(protect, authorize('admin'), upload.array('images', 5), createProduct);

router.route('/:id')
    .get(getProduct)
    .put(protect, authorize('admin'), upload.array('images', 5), updateProduct)
    .delete(protect, authorize('admin'), deleteProduct);

module.exports = router;
