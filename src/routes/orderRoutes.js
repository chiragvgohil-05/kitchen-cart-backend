const express = require('express');
const {
    createOrder,
    verifyPayment,
    verifyStripePayment,
    getOrderInvoice,
    getMyOrders,
    getAllOrders,
    cancelMyOrder,
    updateOrderStatus,
    getRazorpayOrderForPendingOrder
} = require('../controllers/orderController');

const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.post('/verify', verifyPayment);
router.post('/verify/stripe', verifyStripePayment);
router.get('/:id/retry-payment', getRazorpayOrderForPendingOrder);
router.get('/:id/invoice', getOrderInvoice);
router.get('/', getMyOrders);
router.put('/:id/cancel', cancelMyOrder);

router.get('/admin', authorize('admin', 'staff'), getAllOrders);
router.put('/:id', authorize('admin', 'staff'), updateOrderStatus);

module.exports = router;
