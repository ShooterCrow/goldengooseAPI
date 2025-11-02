// routes/appRoutes.js
const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const verifyJWT = require('../middleware/verifyJWT');
const verifyAdmin = require('../middleware/verifyAdmin');

// Public routes
router.get('/', appController.getAllApps);
router.get('/verified', appController.getVerifiedApps);
router.get('/category/:badge', appController.getAppsByBadge);
router.get('/trending', appController.getTrendingApps);
router.get('/limited-stock', appController.getLimitedStockApps);
router.get('/:id', appController.getApp);

// Usage and rating routes (public but might want to protect later)
router.patch('/:id/use', appController.incrementAppUsage);
router.patch('/:id/rate', appController.updateAppRating);

// Admin routes
router.post('/', verifyJWT, verifyAdmin, appController.createApp);
router.put('/:id', verifyJWT, verifyAdmin, appController.updateApp);
router.delete('/:id', verifyJWT, verifyAdmin, appController.deleteApp);
router.get('/stats/overview', verifyJWT, verifyAdmin, appController.getAppStats);

module.exports = router;