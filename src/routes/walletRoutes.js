const express = require('express');
const {
    getMyWalletBalance,
    getMyWalletTransactions,
    getAdminWalletTransactions,
    adjustWalletBalanceByAdmin
} = require('../controllers/walletController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/balance', getMyWalletBalance);
router.get('/transactions', getMyWalletTransactions);

router.get('/admin/transactions', authorize('admin'), getAdminWalletTransactions);
router.post('/admin/adjust', authorize('admin'), adjustWalletBalanceByAdmin);

module.exports = router;
