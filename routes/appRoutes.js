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
router.get('/:id', appController.getApp); // Click tracking middleware

// Click tracking routes
router.post('/:id/track-click', appController.updateAppClicks); // Alternative explicit tracking
router.get('/:id/analytics/clicks', verifyJWT, verifyAdmin, appController.getAppClickAnalytics);
router.get('/analytics/clicks', verifyJWT, verifyAdmin, appController.getAppsClickStats);

// Usage and rating routes (public but might want to protect later)
router.patch('/:id/use', appController.incrementAppUsage);
router.patch('/:id/rate', appController.updateAppRating);

// Admin routes
router.post('/', verifyJWT, verifyAdmin, appController.createApp);
router.put('/:id', verifyJWT, verifyAdmin, appController.updateApp);
router.delete('/:id', verifyJWT, verifyAdmin, appController.deleteApp);
router.get('/stats/overview', verifyJWT, verifyAdmin, appController.getAppStats);

module.exports = router;