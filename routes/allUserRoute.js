// routes/allUserRoutes.js
const express = require('express');
const router = express.Router();
const allUserController = require('../controllers/allUserController');
const verifyJWT = require('../middleware/verifyJWT');
const verifyAdmin = require('../middleware/verifyAdmin');

// Public routes
router.post('/interactions', allUserController.recordInteraction);

// Admin routes
router.get('/interactions', verifyJWT, verifyAdmin, allUserController.getAllInteractions);
router.get('/interactions/email/:email', verifyJWT, verifyAdmin, allUserController.getInteractionsByEmail);
router.get('/interactions/:id', verifyJWT, verifyAdmin, allUserController.getInteraction);
router.patch('/interactions/:id/status', verifyJWT, verifyAdmin, allUserController.updateInteractionStatus);
router.delete('/interactions/:id', verifyJWT, verifyAdmin, allUserController.deleteInteraction);
router.get('/analytics', verifyJWT, verifyAdmin, allUserController.getAnalytics);
router.get('/stats/overview', verifyJWT, verifyAdmin, allUserController.getInteractionStats);

module.exports = router;