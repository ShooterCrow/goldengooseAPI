const express = require("express");
const router = express.Router();
const {
  createSubscriber,
  getSubscribers,
  getSubscriber,
  updateSubscriber,
  deleteSubscriber,
  deleteAllSubscribers,
  bulkUpdateStatus,
  getSubscriberStats,
} = require("../controllers/subscribersController");
const verifyJWT = require('../middleware/verifyJWT.js');
const verifyAdmin = require('../middleware/verifyAdmin');

// @route   POST /api/subscribers
// @desc    Create a new subscriber
router.post("/", createSubscriber);

router.use(verifyJWT);
// router.use(verifyAdmin);

// @route   GET /api/subscribers
// @desc    Get all subscribers (with filters, pagination, search, etc.)
router.get("/", getSubscribers);

// @route   GET /api/subscribers/stats
// @desc    Get subscriber statistics
router.get("/stats", getSubscriberStats);

// @route   GET /api/subscribers/:id
// @desc    Get single subscriber by ID
router.get("/:id", getSubscriber);

// @route   PUT /api/subscribers/:id
// @desc    Update subscriber
router.put("/:id", updateSubscriber);

// @route   DELETE /api/subscribers/:id
// @desc    Delete subscriber
router.delete("/", deleteSubscriber);

// @route   DELETE /api/subscribers
// @desc    Delete all subscribers (Admin only)
router.delete("/", deleteAllSubscribers);

// @route   PATCH /api/subscribers/bulk-status
// @desc    Bulk update subscribers status
router.patch("/bulk-status", bulkUpdateStatus);

module.exports = router;
