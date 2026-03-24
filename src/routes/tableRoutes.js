const express = require('express');
const {
    getTables,
    createTable,
    updateTable,
    deleteTable
} = require('../controllers/tableController');

const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', getTables);

// Admin-only routes
router.post('/', protect, authorize('admin', 'staff'), createTable);
router.put('/:id', protect, authorize('admin', 'staff'), updateTable);
router.delete('/:id', protect, authorize('admin', 'staff'), deleteTable);

module.exports = router;
