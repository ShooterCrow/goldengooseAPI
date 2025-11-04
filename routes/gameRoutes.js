// routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const verifyJWT = require('../middleware/verifyJWT');
const verifyAdmin = require('../middleware/verifyAdmin');

// Public routes
router.get('/', gameController.getAllGames);
router.get('/merchant/:merchant', gameController.getGamesByMerchant);
router.get('/trending', gameController.getTrendingGames);
router.get('/:id', gameController.getGame);

// Admin routes
router.post('/patch', gameController.batchCreateGames );
router.post('/', verifyJWT, verifyAdmin, gameController.createGame);
router.put('/:id', verifyJWT, verifyAdmin, gameController.updateGame);
router.delete('/:id', verifyJWT, verifyAdmin, gameController.deleteGame);
router.get('/stats/overview', verifyJWT, verifyAdmin, gameController.getGameStats);

module.exports = router;