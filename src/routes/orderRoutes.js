const express = require('express');
const {
    createOrder,
    verifyPayment,
    getMyOrders,
    getAllOrders,
    updateOrderStatus
} = require('../controllers/orderController');

const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.post('/verify', verifyPayment);
router.get('/', getMyOrders);

router.get('/admin', authorize('admin'), getAllOrders);
router.put('/:id', authorize('admin'), updateOrderStatus);

module.exports = router;
