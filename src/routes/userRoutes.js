const express = require('express');
const { getUsers, deleteUser, updateUserRole } = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/', getUsers);
router.delete('/:id', deleteUser);
router.put('/:id/role', updateUserRole);

module.exports = router;
