// controllers/appController.js
const App = require("../model/App");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { sanitizeInput } = require("../utils/sanitizeInput");

// @desc    Get all apps (with optional filtering)
// @route   GET /api/apps
// @access  Public
const getAllApps = asyncHandler(async (req, res) => {
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
      sortOrder = "desc",
      activeOnly = true
    } = req.query;

    // Build filter object
    let filter = {};
    
    if (activeOnly) {
      filter.isActive = true;
    }
    
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
    const apps = await App.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await App.countDocuments(filter);

    res.json({
      success: true,
      data: apps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get all apps error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching apps",
    });
  }
});

// @desc    Get single app
// @route   GET /api/apps/:id
// @access  Public
const getApp = asyncHandler(async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found",
      });
    }

    res.json({
      success: true,
      data: app,
    });
  } catch (error) {
    console.error("Get app error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid app ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while fetching app",
    });
  }
});

// @desc    Create new app
// @route   POST /api/apps
// @access  Private/Admin
const createApp = asyncHandler(async (req, res) => {
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
    const existingApp = await App.findOne({ title });
    if (existingApp) {
      return res.status(409).json({
        success: false,
        message: "App with this title already exists",
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

    if (usedToday !== undefined && usedToday < 0) {
      return res.status(400).json({
        success: false,
        message: "Used today cannot be negative",
      });
    }

    // Create app
    const app = new App({
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

    const savedApp = await app.save();

    res.status(201).json({
      success: true,
      message: "App created successfully",
      data: savedApp,
    });
  } catch (error) {
    console.error("Create app error:", error);
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
      message: "Server error while creating app",
    });
  }
});

// @desc    Update app
// @route   PUT /api/apps/:id
// @access  Private/Admin
const updateApp = asyncHandler(async (req, res) => {
  try {
    // Sanitize input data
    const sanitizedBody = sanitizeInput(req.body);
    
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found",
      });
    }

    // Check if title is being changed and if it already exists
    if (sanitizedBody.title && sanitizedBody.title !== app.title) {
      const existingApp = await App.findOne({ title: sanitizedBody.title });
      if (existingApp) {
        return res.status(409).json({
          success: false,
          message: "App with this title already exists",
        });
      }
    }

    // Validate rating if provided
    if (sanitizedBody.rating !== undefined && (sanitizedBody.rating < 0 || sanitizedBody.rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5",
      });
    }

    // Update app
    const updatedApp = await App.findByIdAndUpdate(
      req.params.id,
      sanitizedBody,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "App updated successfully",
      data: updatedApp,
    });
  } catch (error) {
    console.error("Update app error:", error);
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
      message: "Server error while updating app",
    });
  }
});

// @desc    Delete app
// @route   DELETE /api/apps/:id
// @access  Private/Admin
const deleteApp = asyncHandler(async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found",
      });
    }

    await App.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: "App deleted successfully",
    });
  } catch (error) {
    console.error("Delete app error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting app",
    });
  }
});

// @desc    Get verified apps only
// @route   GET /api/apps/verified
// @access  Public
const getVerifiedApps = asyncHandler(async (req, res) => {
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
        { description: { $regex: search, $options: "i" } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const apps = await App.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await App.countDocuments(filter);

    res.json({
      success: true,
      data: apps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get verified apps error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching verified apps",
    });
  }
});

// @desc    Get apps by category/badge
// @route   GET /api/apps/category/:badge
// @access  Public
const getAppsByBadge = asyncHandler(async (req, res) => {
  try {
    const { badge } = req.params;
    const {
      page = 1,
      limit = 10,
      verified = true,
      sortBy = "rating",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    let filter = { badge };
    
    if (verified) {
      filter.verified = true;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const apps = await App.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await App.countDocuments(filter);

    res.json({
      success: true,
      data: apps,
      badge,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get apps by badge error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching apps by category",
    });
  }
});

// @desc    Increment app usage
// @route   PATCH /api/apps/:id/use
// @access  Public
const incrementAppUsage = asyncHandler(async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found",
      });
    }

    // Check if items are available
    if (app.itemsLeft <= 0) {
      return res.status(400).json({
        success: false,
        message: "No items left for this app",
      });
    }

    // Update usage and items left
    const updatedApp = await App.findByIdAndUpdate(
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
      message: "App usage incremented successfully",
      data: updatedApp,
    });
  } catch (error) {
    console.error("Increment app usage error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating app usage",
    });
  }
});

// @desc    Update app rating
// @route   PATCH /api/apps/:id/rate
// @access  Public
const updateAppRating = asyncHandler(async (req, res) => {
  try {
    const { rating } = req.body;
    
    if (!rating || rating < 0 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5"
      });
    }

    const app = await App.findById(req.params.id);
    
    if (!app) {
      return res.status(404).json({
        success: false,
        message: "App not found"
      });
    }

    // Calculate new average rating
    const newTotalRatings = app.totalRatings + 1;
    const newRating = ((app.rating * app.totalRatings) + rating) / newTotalRatings;

    const updatedApp = await App.findByIdAndUpdate(
      req.params.id,
      {
        rating: parseFloat(newRating.toFixed(1)),
        totalRatings: newTotalRatings
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      message: "App rating updated successfully",
      data: updatedApp,
    });
  } catch (error) {
    console.error("Update app rating error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating app rating",
    });
  }
});

// @desc    Get trending apps
// @route   GET /api/apps/trending
// @access  Public
const getTrendingApps = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      minRating = 4.5,
      minUsage = 50
    } = req.query;

    const apps = await App.find({
      verified: true,
      rating: { $gte: Number(minRating) },
      usedToday: { $gte: Number(minUsage) }
    })
    .sort({ rating: -1, usedToday: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await App.countDocuments({
      verified: true,
      rating: { $gte: Number(minRating) },
      usedToday: { $gte: Number(minUsage) }
    });

    res.json({
      success: true,
      data: apps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get trending apps error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching trending apps",
    });
  }
});

// @desc    Get apps with limited stock
// @route   GET /api/apps/limited-stock
// @access  Public
const getLimitedStockApps = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      maxItemsLeft = 5
    } = req.query;

    const apps = await App.find({
      verified: true,
      itemsLeft: { $lte: Number(maxItemsLeft) },
      itemsLeft: { $gt: 0 }
    })
    .sort({ itemsLeft: 1, rating: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await App.countDocuments({
      verified: true,
      itemsLeft: { $lte: Number(maxItemsLeft) },
      itemsLeft: { $gt: 0 }
    });

    res.json({
      success: true,
      data: apps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get limited stock apps error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching limited stock apps",
    });
  }
});

// @desc    Get apps statistics
// @route   GET /api/apps/stats/overview
// @access  Private/Admin
const getAppStats = asyncHandler(async (req, res) => {
  try {
    const stats = await App.aggregate([
      {
        $group: {
          _id: null,
          totalApps: { $sum: 1 },
          totalRatings: { $sum: '$totalRatings' },
          avgRating: { $avg: '$rating' },
          totalUsedToday: { $sum: '$usedToday' },
          totalItemsLeft: { $sum: '$itemsLeft' },
          verifiedApps: { $sum: { $cond: ['$verified', 1, 0] } },
          totalItemsAvailable: { $sum: '$itemsLeft' }
        }
      },
      {
        $project: {
          _id: 0,
          totalApps: 1,
          totalRatings: 1,
          avgRating: { $round: ['$avgRating', 1] },
          totalUsedToday: 1,
          totalItemsLeft: 1,
          verifiedApps: 1,
          unverifiedApps: { $subtract: ['$totalApps', '$verifiedApps'] },
          totalItemsAvailable: 1
        }
      }
    ]);

    const badgeStats = await App.aggregate([
      {
        $group: {
          _id: '$badge',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          totalUsed: { $sum: '$usedToday' }
        }
      },
      {
        $project: {
          badge: '$_id',
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

    const merchantStats = await App.aggregate([
      {
        $group: {
          _id: '$merchant',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      },
      {
        $project: {
          merchant: '$_id',
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
        badges: badgeStats,
        merchants: merchantStats.slice(0, 10) // Top 10 merchants
      }
    });
  } catch (error) {
    console.error("Get app stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching app statistics",
    });
  }
});

module.exports = {
  getAllApps,
  getApp,
  createApp,
  updateApp,
  deleteApp,
  getVerifiedApps,
  getAppsByBadge,
  incrementAppUsage,
  updateAppRating,
  getTrendingApps,
  getLimitedStockApps,
  getAppStats
};