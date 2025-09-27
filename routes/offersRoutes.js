const express = require("express");
const router = express.Router();
const {
  createOffer,
  getOffers,
  getOffer,
  updateOffer,
  deleteOffer,
  toggleOfferStatus,
} = require("../controllers/offersController");

const verifyJWT = require('../middleware/verifyJWT.js');
const verifyAdmin = require('../middleware/verifyAdmin');

// @route   GET /api/offers
// @desc    Get all offers (with pagination, filters, etc.)
router.get("/", getOffers);

// @route   GET /api/offers/:offerId
// @desc    Get a single offer (with geolocation-based link resolution)
router.get("/:offerId", getOffer);


router.use(verifyJWT);
// router.use(verifyAdmin);

// @route   POST /api/offers
// @desc    Create a new offer
router.post("/", createOffer);

// @route   PUT /api/offers/:id
// @desc    Update an offer
router.put("/:id", updateOffer);

// @route   DELETE /api/offers/:id
// @desc    Delete an offer
router.delete("/:id", deleteOffer);

// @route   PATCH /api/offers/:id/toggle-status
// @desc    Toggle offer active/inactive
router.patch("/:id/toggle-status", toggleOfferStatus);

module.exports = router;
