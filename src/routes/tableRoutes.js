const express = require('express');
const {
    getTables,
    getTable,
    createTable,
    updateTable,
    deleteTable
} = require('../controllers/tableController');

const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.route('/')
    .get(getTables)
    .post(protect, authorize('admin'), createTable);

router.route('/:id')
    .get(getTable)
    .put(protect, authorize('admin'), updateTable)
    .delete(protect, authorize('admin'), deleteTable);

module.exports = router;
