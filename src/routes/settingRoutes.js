const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settingController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.route('/')
    .get(getSettings)
    .put(protect, authorize('admin', 'staff'), updateSettings);

module.exports = router;
