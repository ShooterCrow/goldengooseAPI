// routes/giftCardRoutes.js
const express = require('express');
const router = express.Router();
const giftcardController = require('../controllers/giftcardController');
const verifyJWT = require('../middleware/verifyJWT');
const verifyAdmin = require('../middleware/verifyAdmin');

// Public routes
router.get('/', giftcardController.getAllGiftCards);
router.get('/merchant/:merchant', giftcardController.getGiftCardsByMerchant);
router.get('/popular', giftcardController.getPopularGiftCards);
router.get('/:id', giftcardController.getGiftCard);

// Admin routes
router.post('/', verifyJWT, verifyAdmin, giftcardController.createGiftCard);
router.put('/:id', verifyJWT, verifyAdmin, giftcardController.updateGiftCard);
router.delete('/:id', verifyJWT, verifyAdmin, giftcardController.deleteGiftCard);
router.get('/stats/overview', verifyJWT, verifyAdmin, giftcardController.getGiftCardStats);

module.exports = router;