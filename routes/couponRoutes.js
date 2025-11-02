// routes/couponRoutes.js
const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const verifyJWT = require('../middleware/verifyJWT');
const verifyAdmin = require('../middleware/verifyAdmin');

// Public routes
router.get('/', couponController.getAllCoupons);
router.get('/verified', couponController.getVerifiedCoupons);
router.get('/merchant/:merchant', couponController.getCouponsByMerchant);
router.get('/code/:code', couponController.getCouponByCode);
router.get('/validate/:code', couponController.validateCoupon);
router.get('/:id', couponController.getCoupon);

// Usage routes
router.patch('/:id/use', couponController.incrementCouponUsage);

// Admin routes
router.post('/', verifyJWT, verifyAdmin, couponController.createCoupon);
router.put('/:id', verifyJWT, verifyAdmin, couponController.updateCoupon);
router.delete('/:id', verifyJWT, verifyAdmin, couponController.deleteCoupon);
router.get('/stats/overview', verifyJWT, verifyAdmin, couponController.getCouponStats);

module.exports = router;