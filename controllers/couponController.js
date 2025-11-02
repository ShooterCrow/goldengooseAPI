// controllers/couponController.js
const Coupon = require("../model/Coupon");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { sanitizeInput } = require("../utils/sanitizeInput");

// @desc    Get all coupons (with optional filtering)
// @route   GET /api/coupons
// @access  Public
const getAllCoupons = asyncHandler(async (req, res) => {
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
        { details: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } }
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
    const coupons = await Coupon.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await Coupon.countDocuments(filter);

    res.json({
      success: true,
      data: coupons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get all coupons error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupons",
    });
  }
});

// @desc    Get single coupon
// @route   GET /api/coupons/:id
// @access  Public
const getCoupon = asyncHandler(async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error("Get coupon error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupon",
    });
  }
});

// @desc    Get coupon by code
// @route   GET /api/coupons/code/:code
// @access  Public
const getCouponByCode = asyncHandler(async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ code: req.params.code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error("Get coupon by code error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupon",
    });
  }
});

// @desc    Create new coupon
// @route   POST /api/coupons
// @access  Private/Admin
const createCoupon = asyncHandler(async (req, res) => {
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
    if (!title || !merchant || !image || !logo || !offer || !description || !code || !action || !action.actionLink) {
      return res.status(400).json({
        success: false,
        message: "Title, merchant, image, logo, offer, description, code, action, and actionLink are required",
      });
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(409).json({
        success: false,
        message: "Coupon with this code already exists",
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

    // Create coupon
    const coupon = new Coupon({
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
      code: code.toUpperCase(),
      badge: badge || null,
      action: action
    });

    const savedCoupon = await coupon.save();

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: savedCoupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
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
      message: "Server error while creating coupon",
    });
  }
});

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private/Admin
const updateCoupon = asyncHandler(async (req, res) => {
  try {
    // Sanitize input data
    const sanitizedBody = sanitizeInput(req.body);
    
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if code is being changed and if it already exists
    if (sanitizedBody.code && sanitizedBody.code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ code: sanitizedBody.code.toUpperCase() });
      if (existingCoupon) {
        return res.status(409).json({
          success: false,
          message: "Coupon with this code already exists",
        });
      }
      sanitizedBody.code = sanitizedBody.code.toUpperCase();
    }

    // Update coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      sanitizedBody,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Coupon updated successfully",
      data: updatedCoupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
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
      message: "Server error while updating coupon",
    });
  }
});

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
const deleteCoupon = asyncHandler(async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    await Coupon.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting coupon",
    });
  }
});

// @desc    Get verified coupons only
// @route   GET /api/coupons/verified
// @access  Public
const getVerifiedCoupons = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      minRating = 4.0,
      sortBy = "rating",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    let filter = {
      verified: true,
      rating: { $gte: Number(minRating) }
    };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const coupons = await Coupon.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await Coupon.countDocuments(filter);

    res.json({
      success: true,
      data: coupons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get verified coupons error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching verified coupons",
    });
  }
});

// @desc    Get coupons by merchant
// @route   GET /api/coupons/merchant/:merchant
// @access  Public
const getCouponsByMerchant = asyncHandler(async (req, res) => {
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
    const coupons = await Coupon.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await Coupon.countDocuments(filter);

    res.json({
      success: true,
      data: coupons,
      merchant,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get coupons by merchant error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupons by merchant",
    });
  }
});

// @desc    Increment coupon usage
// @route   PATCH /api/coupons/:id/use
// @access  Public
const incrementCouponUsage = asyncHandler(async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if items are available
    if (coupon.itemsLeft <= 0) {
      return res.status(400).json({
        success: false,
        message: "No items left for this coupon",
      });
    }

    // Update usage and items left
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { 
          usedToday: 1,
          itemsLeft: -1 
        }
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Coupon usage incremented successfully",
      data: updatedCoupon,
    });
  } catch (error) {
    console.error("Increment coupon usage error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating coupon usage",
    });
  }
});

// @desc    Validate coupon code
// @route   GET /api/coupons/validate/:code
// @access  Public
const validateCoupon = asyncHandler(async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ 
      code: req.params.code.toUpperCase(),
      verified: true
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired coupon code",
      });
    }

    // Check if coupon has items left
    if (coupon.itemsLeft <= 0) {
      return res.status(400).json({
        success: false,
        message: "This coupon has been fully redeemed",
      });
    }

    // Check if coupon has expired
    if (coupon.expiry !== "No expiration") {
      const expiryDate = new Date(coupon.expiry);
      if (expiryDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: "This coupon has expired",
        });
      }
    }

    res.json({
      success: true,
      message: "Coupon is valid",
      data: coupon,
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating coupon",
    });
  }
});

// @desc    Get coupons statistics
// @route   GET /api/coupons/stats/overview
// @access  Private/Admin
const getCouponStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Coupon.aggregate([
      {
        $group: {
          _id: null,
          totalCoupons: { $sum: 1 },
          totalRatings: { $sum: '$totalRatings' },
          avgRating: { $avg: '$rating' },
          totalUsedToday: { $sum: '$usedToday' },
          totalItemsLeft: { $sum: '$itemsLeft' },
          verifiedCoupons: { $sum: { $cond: ['$verified', 1, 0] } },
          totalRedeemable: { $sum: '$itemsLeft' }
        }
      },
      {
        $project: {
          _id: 0,
          totalCoupons: 1,
          totalRatings: 1,
          avgRating: { $round: ['$avgRating', 1] },
          totalUsedToday: 1,
          totalItemsLeft: 1,
          verifiedCoupons: 1,
          unverifiedCoupons: { $subtract: ['$totalCoupons', '$verifiedCoupons'] },
          totalRedeemable: 1
        }
      }
    ]);

    const merchantStats = await Coupon.aggregate([
      {
        $group: {
          _id: '$merchant',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          totalUsed: { $sum: '$usedToday' },
          totalAvailable: { $sum: '$itemsLeft' }
        }
      },
      {
        $project: {
          merchant: '$_id',
          count: 1,
          avgRating: { $round: ['$avgRating', 1] },
          totalUsed: 1,
          totalAvailable: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const badgeStats = await Coupon.aggregate([
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
    console.error("Get coupon stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupon statistics",
    });
  }
});

module.exports = {
  getAllCoupons,
  getCoupon,
  getCouponByCode,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getVerifiedCoupons,
  getCouponsByMerchant,
  incrementCouponUsage,
  validateCoupon,
  getCouponStats
};