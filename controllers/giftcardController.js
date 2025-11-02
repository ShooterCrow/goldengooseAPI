// controllers/giftCardController.js
const GiftCard = require("../model/Giftcard");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { sanitizeInput } = require("../utils/sanitizeInput");

// @desc    Get all gift cards (with optional filtering)
// @route   GET /api/giftcards
// @access  Public
const getAllGiftCards = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      merchant,
      minRating,
      maxRating,
      minItemsLeft,
      maxItemsLeft,
      verified,
      badge,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    let filter = {};
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } }
      ];
    }
    
    if (merchant) {
      filter.merchant = { $regex: merchant, $options: "i" };
    }
    
    if (minRating !== undefined || maxRating !== undefined) {
      filter.rating = {};
      if (minRating !== undefined) filter.rating.$gte = Number(minRating);
      if (maxRating !== undefined) filter.rating.$lte = Number(maxRating);
    }

    if (minItemsLeft !== undefined || maxItemsLeft !== undefined) {
      filter.itemsLeft = {};
      if (minItemsLeft !== undefined) filter.itemsLeft.$gte = Number(minItemsLeft);
      if (maxItemsLeft !== undefined) filter.itemsLeft.$lte = Number(maxItemsLeft);
    }

    if (verified !== undefined) {
      filter.verified = verified === "true";
    }

    if (badge) {
      filter.badge = badge;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const giftCards = await GiftCard.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await GiftCard.countDocuments(filter);

    res.json({
      success: true,
      data: giftCards,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get all gift cards error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching gift cards",
    });
  }
});

// @desc    Get single gift card
// @route   GET /api/giftcards/:id
// @access  Public
const getGiftCard = asyncHandler(async (req, res) => {
  try {
    const giftCard = await GiftCard.findById(req.params.id);

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: "Gift card not found",
      });
    }

    res.json({
      success: true,
      data: giftCard,
    });
  } catch (error) {
    console.error("Get gift card error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid gift card ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while fetching gift card",
    });
  }
});

// @desc    Create new gift card
// @route   POST /api/giftcards
// @access  Private/Admin
const createGiftCard = asyncHandler(async (req, res) => {
  try {
    // Sanitize input data
    const sanitizedBody = sanitizeInput(req.body);
    
    const {
      title,
      merchant,
      image,
      logo,
      offer,
      description,
      rating,
      totalRatings,
      itemsLeft,
      expiry,
      usesToday,
      usedToday,
      verified,
      details,
      code,
      badge,
      action
    } = sanitizedBody;

    // Validation
    if (!title || !merchant || !image || !logo || !offer || !description || !action || !action.actionLink) {
      return res.status(400).json({
        success: false,
        message: "Title, merchant, image, logo, offer, description, action, and actionLink are required",
      });
    }

    // Check if title already exists
    const existingGiftCard = await GiftCard.findOne({ title });
    if (existingGiftCard) {
      return res.status(409).json({
        success: false,
        message: "Gift card with this title already exists",
      });
    }

    // Validate rating
    if (rating && (rating < 0 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5",
      });
    }

    // Validate numerical fields
    if (itemsLeft !== undefined && itemsLeft < 0) {
      return res.status(400).json({
        success: false,
        message: "Items left cannot be negative",
      });
    }

    // Create gift card
    const giftCard = new GiftCard({
      title,
      merchant,
      image,
      logo,
      offer,
      description,
      rating: rating || 0,
      totalRatings: totalRatings || 0,
      itemsLeft: itemsLeft || 0,
      expiry: expiry || "No expiration",
      usesToday: usesToday || "0",
      usedToday: usedToday || 0,
      verified: verified || false,
      details: details || description,
      code: code || "",
      badge: badge || null,
      action: action
    });

    const savedGiftCard = await giftCard.save();

    res.status(201).json({
      success: true,
      message: "Gift card created successfully",
      data: savedGiftCard,
    });
  } catch (error) {
    console.error("Create gift card error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while creating gift card",
    });
  }
});

// @desc    Update gift card
// @route   PUT /api/giftcards/:id
// @access  Private/Admin
const updateGiftCard = asyncHandler(async (req, res) => {
  try {
    // Sanitize input data
    const sanitizedBody = sanitizeInput(req.body);
    
    const giftCard = await GiftCard.findById(req.params.id);

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: "Gift card not found",
      });
    }

    // Check if title is being changed and if it already exists
    if (sanitizedBody.title && sanitizedBody.title !== giftCard.title) {
      const existingGiftCard = await GiftCard.findOne({ title: sanitizedBody.title });
      if (existingGiftCard) {
        return res.status(409).json({
          success: false,
          message: "Gift card with this title already exists",
        });
      }
    }

    // Update gift card
    const updatedGiftCard = await GiftCard.findByIdAndUpdate(
      req.params.id,
      sanitizedBody,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Gift card updated successfully",
      data: updatedGiftCard,
    });
  } catch (error) {
    console.error("Update gift card error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while updating gift card",
    });
  }
});

// @desc    Delete gift card
// @route   DELETE /api/giftcards/:id
// @access  Private/Admin
const deleteGiftCard = asyncHandler(async (req, res) => {
  try {
    const giftCard = await GiftCard.findById(req.params.id);

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        message: "Gift card not found",
      });
    }

    await GiftCard.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: "Gift card deleted successfully",
    });
  } catch (error) {
    console.error("Delete gift card error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting gift card",
    });
  }
});

// @desc    Get gift cards by merchant
// @route   GET /api/giftcards/merchant/:merchant
// @access  Public
const getGiftCardsByMerchant = asyncHandler(async (req, res) => {
  try {
    const { merchant } = req.params;
    const {
      page = 1,
      limit = 10,
      verified = true,
      sortBy = "rating",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    let filter = { 
      merchant: { $regex: merchant, $options: "i" }
    };
    
    if (verified) {
      filter.verified = true;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const giftCards = await GiftCard.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await GiftCard.countDocuments(filter);

    res.json({
      success: true,
      data: giftCards,
      merchant,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get gift cards by merchant error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching gift cards by merchant",
    });
  }
});

// @desc    Get popular gift cards
// @route   GET /api/giftcards/popular
// @access  Public
const getPopularGiftCards = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      minRating = 4.5,
      minUsage = 30
    } = req.query;

    const giftCards = await GiftCard.find({
      verified: true,
      rating: { $gte: Number(minRating) },
      usedToday: { $gte: Number(minUsage) }
    })
    .sort({ rating: -1, usedToday: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await GiftCard.countDocuments({
      verified: true,
      rating: { $gte: Number(minRating) },
      usedToday: { $gte: Number(minUsage) }
    });

    res.json({
      success: true,
      data: giftCards,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get popular gift cards error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching popular gift cards",
    });
  }
});

// @desc    Get gift cards statistics
// @route   GET /api/giftcards/stats/overview
// @access  Private/Admin
const getGiftCardStats = asyncHandler(async (req, res) => {
  try {
    const stats = await GiftCard.aggregate([
      {
        $group: {
          _id: null,
          totalGiftCards: { $sum: 1 },
          totalRatings: { $sum: '$totalRatings' },
          avgRating: { $avg: '$rating' },
          totalUsedToday: { $sum: '$usedToday' },
          totalItemsLeft: { $sum: '$itemsLeft' },
          verifiedGiftCards: { $sum: { $cond: ['$verified', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalGiftCards: 1,
          totalRatings: 1,
          avgRating: { $round: ['$avgRating', 1] },
          totalUsedToday: 1,
          totalItemsLeft: 1,
          verifiedGiftCards: 1,
          unverifiedGiftCards: { $subtract: ['$totalGiftCards', '$verifiedGiftCards'] }
        }
      }
    ]);

    const merchantStats = await GiftCard.aggregate([
      {
        $group: {
          _id: '$merchant',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          totalUsed: { $sum: '$usedToday' }
        }
      },
      {
        $project: {
          merchant: '$_id',
          count: 1,
          avgRating: { $round: ['$avgRating', 1] },
          totalUsed: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const badgeStats = await GiftCard.aggregate([
      {
        $match: { badge: { $ne: null } }
      },
      {
        $group: {
          _id: '$badge',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      },
      {
        $project: {
          badge: '$_id',
          count: 1,
          avgRating: { $round: ['$avgRating', 1] },
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        merchants: merchantStats.slice(0, 10),
        badges: badgeStats
      }
    });
  } catch (error) {
    console.error("Get gift card stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching gift card statistics",
    });
  }
});

module.exports = {
  getAllGiftCards,
  getGiftCard,
  createGiftCard,
  updateGiftCard,
  deleteGiftCard,
  getGiftCardsByMerchant,
  getPopularGiftCards,
  getGiftCardStats
};