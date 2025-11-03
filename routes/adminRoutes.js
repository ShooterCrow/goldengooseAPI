// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyJWT = require('../middleware/verifyJWT');
const verifyAdmin = require('../middleware/verifyAdmin');

// Apply JWT and Admin verification to all admin routes
router.use(verifyJWT);
// router.use(verifyAdmin);

// @route   GET /api/admin/dashboard/stats
// @desc    Get comprehensive dashboard statistics
// @access  Private/Admin
router.get('/dashboard/stats', adminController.getDashboardStats);

// @route   GET /api/admin/stats/:entity
// @desc    Get detailed statistics for specific entity (apps, coupons, games, giftcards)
// @access  Private/Admin
router.get('/stats/:entity', adminController.getDetailedStats);

module.exports = router;