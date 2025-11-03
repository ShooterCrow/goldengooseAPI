// controllers/appController.js
const App = require("../model/App");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { sanitizeInput } = require("../utils/sanitizeInput");
const UAParser = require('ua-parser-js');

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

// Track app click and update counts
const updateAppClicks = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get client IP address
    const ip = req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);

    // Get geolocation data (you might want to use geoip-lite here)
    const geo = req.geo || {}; // This would come from your geoip middleware
    const country = geo.country || 'Unknown';
    const city = geo.city || 'Unknown';
    const region = geo.region || 'Unknown';

    // Get user agent and device info
    const userAgent = req.get('User-Agent') || 'Unknown';
    const referrer = req.get('Referer') || 'Direct';
    
    // Parse user agent for device type
    const deviceType = getDeviceType(userAgent);
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();

    // Prepare click data using the reusable click schema structure
    const clickData = {
      ip,
      country,
      city,
      region,
      userAgent,
      referrer,
      deviceType,
      browser: `${browser.name || 'Unknown'} ${browser.version || ''}`.trim(),
      os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
      sessionId: generateSessionId(req),
      userId: req.user?._id || null,
      isUnique: true // We'll check uniqueness below
    };

    // Check if this is a unique click (based on IP and session in last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const existingClick = await App.findOne({
      _id: id,
      'clicks.ip': ip,
      'clicks.sessionId': clickData.sessionId,
      'clicks.date': { $gte: twentyFourHoursAgo }
    });

    clickData.isUnique = !existingClick;

    // Update the app with new click
    const updatedApp = await App.findByIdAndUpdate(
      id,
      {
        $push: { clicks: clickData },
        $inc: { 
          totalClicks: 1,
          ...(clickData.isUnique && { uniqueClicks: 1 })
        },
        $set: { lastClicked: new Date() }
      },
      { new: true, runValidators: true }
    );

    if (!updatedApp) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Return minimal response for tracking
    res.json({
      success: true,
      data: {
        appId: updatedApp._id,
        totalClicks: updatedApp.totalClicks,
        uniqueClicks: updatedApp.uniqueClicks,
        isUnique: clickData.isUnique
      }
    });

  } catch (error) {
    console.error('App click tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track app click',
      error: error.message
    });
  }
};

// Get app click analytics
const getAppClickAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30, groupBy = 'day' } = req.query;

    const app = await App.findById(id);
    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get daily click statistics
    const dailyClicks = await App.aggregate([
      { $match: { _id: app._id } },
      { $unwind: '$clicks' },
      { $match: { 'clicks.date': { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { 
              format: groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m-%d-%H', 
              date: '$clicks.date' 
            }
          },
          totalClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: ['$clicks.isUnique', 1, 0] } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          totalClicks: 1,
          uniqueClicks: 1
        }
      }
    ]);

    // Get geographic distribution
    const geoDistribution = await App.aggregate([
      { $match: { _id: app._id } },
      { $unwind: '$clicks' },
      { $match: { 'clicks.date': { $gte: startDate } } },
      {
        $group: {
          _id: '$clicks.country',
          totalClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: ['$clicks.isUnique', 1, 0] } }
        }
      },
      { $sort: { totalClicks: -1 } },
      {
        $project: {
          country: '$_id',
          totalClicks: 1,
          uniqueClicks: 1
        }
      }
    ]);

    // Get device statistics
    const deviceStats = await App.aggregate([
      { $match: { _id: app._id } },
      { $unwind: '$clicks' },
      { $match: { 'clicks.date': { $gte: startDate } } },
      {
        $group: {
          _id: '$clicks.deviceType',
          totalClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: ['$clicks.isUnique', 1, 0] } }
        }
      },
      { $sort: { totalClicks: -1 } },
      {
        $project: {
          deviceType: '$_id',
          totalClicks: 1,
          uniqueClicks: 1
        }
      }
    ]);

    // Get referrer statistics
    const referrerStats = await App.aggregate([
      { $match: { _id: app._id } },
      { $unwind: '$clicks' },
      { $match: { 'clicks.date': { $gte: startDate } } },
      {
        $group: {
          _id: '$clicks.referrer',
          totalClicks: { $sum: 1 },
          uniqueClicks: { $sum: { $cond: ['$clicks.isUnique', 1, 0] } }
        }
      },
      { $sort: { totalClicks: -1 } },
      { $limit: 10 },
      {
        $project: {
          referrer: '$_id',
          totalClicks: 1,
          uniqueClicks: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        app: {
          _id: app._id,
          title: app.title,
          totalClicks: app.totalClicks,
          uniqueClicks: app.uniqueClicks,
          clickThroughRate: app.totalClicks > 0 ? 
            ((app.uniqueClicks / app.totalClicks) * 100).toFixed(2) : 0
        },
        dailyClicks,
        geoDistribution,
        deviceStats,
        referrerStats,
        period: {
          start: startDate,
          end: new Date(),
          days: parseInt(days)
        }
      }
    });

  } catch (error) {
    console.error('App click analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch app click analytics',
      error: error.message
    });
  }
};

// Get multiple apps click statistics
const getAppsClickStats = async (req, res) => {
  try {
    const { appIds, days = 30 } = req.query;
    
    let matchStage = {};
    if (appIds) {
      const ids = Array.isArray(appIds) ? appIds : appIds.split(',');
      matchStage._id = { $in: ids };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const appsStats = await App.aggregate([
      { $match: matchStage },
      {
        $project: {
          title: 1,
          developer: 1,
          category: 1,
          platform: 1,
          totalClicks: 1,
          uniqueClicks: 1,
          recentClicks: {
            $size: {
              $filter: {
                input: '$clicks',
                as: 'click',
                cond: { $gte: ['$$click.date', startDate] }
              }
            }
          },
          clickThroughRate: {
            $cond: {
              if: { $gt: ['$totalClicks', 0] },
              then: { $multiply: [{ $divide: ['$uniqueClicks', '$totalClicks'] }, 100] },
              else: 0
            }
          },
          lastClicked: 1
        }
      },
      { $sort: { recentClicks: -1, totalClicks: -1 } }
    ]);

    res.json({
      success: true,
      data: appsStats
    });

  } catch (error) {
    console.error('Apps click stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch apps click statistics',
      error: error.message
    });
  }
};

// Helper functions (you can move these to a separate utils file)
const getDeviceType = (userAgent) => {
  const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const tabletRegex = /Tablet|iPad|Android(?!.*Mobile)/i;
  
  if (tabletRegex.test(userAgent)) return 'tablet';
  if (mobileRegex.test(userAgent)) return 'mobile';
  return 'desktop';
};

const generateSessionId = (req) => {
  return req.sessionID || 
         req.ip + 
         req.get('User-Agent')?.substring(0, 25) + 
         Date.now().toString(36);
};

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
  getAppStats,
  updateAppClicks,
  getAppClickAnalytics,
  getAppsClickStats
};