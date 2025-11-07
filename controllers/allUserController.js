// controllers/allUserController.js
const AllUser = require("../model/AllUser");
const asyncHandler = require("express-async-handler");
const geoip = require("geoip-lite");
const { sanitizeInput } = require("../utils/sanitizeInput");

// @desc    Record a new user interaction
// @route   POST /api/all-users/interactions
// @access  Public
const recordInteraction = asyncHandler(async (req, res) => {
  try {
    const {
      type = "other",
      offerTitle,
      actionLink = "default",
      email,
      status = 'initiated',
      errorMessage = null
    } = req.body;

    // Extract IP address with proper handling
    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress = forwarded ? forwarded.split(",")[0] : req.connection.remoteAddress || req.socket.remoteAddress || "0.0.0.0";

    // Get geolocation data
    const geo = geoip.lookup(ipAddress);
    const country = geo?.country || "Unknown";
    const city = geo?.city || "Unknown";
    const region = geo?.region || "Unknown";
    const timezone = geo?.timezone || "Unknown";

    // Get user agent
    const userAgent = req.get("User-Agent") || "Unknown";

    // Extract device information from user agent
    const deviceInfo = extractDeviceInfo(userAgent);

    // Sanitize input data
    const sanitizedData = sanitizeInput({
      type,
      userAgent,
      ipAddress,
      country,
      city,
      region,
      timezone,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      platform: deviceInfo.platform,
      offerTitle,
      actionLink,
      email,
      status,
      errorMessage
    });

    // Validation
    if (!type || !ipAddress || !userAgent) {
      return res.status(421).json({
        success: false,
        message: "Type, IP address, and user agent are required",
      });
    }

    // Validate type enum
    const validTypes = ["app_download", "gift_card", "coupon", "game_redeem", "page_view", "other"];
    if (!validTypes.includes(type)) {
      return res.status(422).json({
        success: false,
        message: "Invalid interaction type",
      });
    }

    // Validate email format if provided
    if (email && !isValidEmail(email)) {
      return res.status(423).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Create interaction
    const interaction = new AllUser(sanitizedData);
    const savedInteraction = await interaction.save();

    res.status(201).json({
      success: true,
      message: "Interaction recorded successfully",
      data: {
        interactionId: savedInteraction._id,
        type: savedInteraction.type,
        offerTitle: savedInteraction.offerTitle,
        email: savedInteraction.email,
        status: savedInteraction.status,
        geo: {
          ip: ipAddress,
          country,
          city,
          region,
          timezone
        },
        device: {
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          operatingSystem: deviceInfo.operatingSystem
        }
      },
    });

  } catch (error) {
    console.error("Record interaction error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while recording interaction",
    });
  }
});

// @desc    Get all interactions with filtering and pagination
// @route   GET /api/all-users/interactions
// @access  Private/Admin
const getAllInteractions = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      country,
      deviceType,
      email,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    let filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (country) filter.country = country;
    if (deviceType) filter.deviceType = deviceType;
    if (email) filter.email = { $regex: email, $options: "i" };

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const interactions = await AllUser.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('type offerTitle email status ipAddress country deviceType browser operatingSystem createdAt')
      .exec();

    // Get total count for pagination
    const total = await AllUser.countDocuments(filter);

    res.json({
      success: true,
      data: interactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get all interactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching interactions",
    });
  }
});

// @desc    Get single interaction
// @route   GET /api/all-users/interactions/:id
// @access  Private/Admin
const getInteraction = asyncHandler(async (req, res) => {
  try {
    const interaction = await AllUser.findById(req.params.id);

    if (!interaction) {
      return res.status(404).json({
        success: false,
        message: "Interaction not found",
      });
    }

    res.json({
      success: true,
      data: interaction,
    });
  } catch (error) {
    console.error("Get interaction error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid interaction ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while fetching interaction",
    });
  }
});

// @desc    Update interaction status
// @route   PATCH /api/all-users/interactions/:id/status
// @access  Private/Admin
const updateInteractionStatus = asyncHandler(async (req, res) => {
  try {
    const { status, errorMessage, email } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = ["initiated", "completed", "failed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const updateData = {
      status,
      ...(errorMessage && { errorMessage }),
      ...(email && { email }),
      updatedAt: new Date()
    };

    const interaction = await AllUser.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!interaction) {
      return res.status(404).json({
        success: false,
        message: "Interaction not found",
      });
    }

    res.json({
      success: true,
      message: "Interaction updated successfully",
      data: {
        interactionId: interaction._id,
        status: interaction.status,
        email: interaction.email,
        errorMessage: interaction.errorMessage,
        updatedAt: interaction.updatedAt
      },
    });
  } catch (error) {
    console.error("Update interaction status error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while updating interaction",
    });
  }
});

// @desc    Get interactions by email
// @route   GET /api/all-users/interactions/email/:email
// @access  Private/Admin
const getInteractionsByEmail = asyncHandler(async (req, res) => {
  try {
    const { email } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const filter = { email };

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const interactions = await AllUser.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('type offerTitle status ipAddress country deviceType createdAt')
      .exec();

    // Get total count for pagination
    const total = await AllUser.countDocuments(filter);

    res.json({
      success: true,
      data: interactions,
      email,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get interactions by email error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching interactions by email",
    });
  }
});

// @desc    Get interactions analytics
// @route   GET /api/all-users/analytics
// @access  Private/Admin
const getAnalytics = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const filter = dateFilter.$gte || dateFilter.$lte ? { createdAt: dateFilter } : {};

    // Get total interactions
    const totalInteractions = await AllUser.countDocuments(filter);

    // Get interactions by type
    const interactionsByType = await AllUser.aggregate([
      { $match: filter },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get interactions by status
    const interactionsByStatus = await AllUser.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // Get interactions by country
    const interactionsByCountry = await AllUser.aggregate([
      { $match: { ...filter, country: { $ne: null } } },
      { 
        $group: { 
          _id: "$country", 
          count: { $sum: 1 }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Get interactions by device type
    const interactionsByDevice = await AllUser.aggregate([
      { $match: filter },
      { $group: { _id: "$deviceType", count: { $sum: 1 } } }
    ]);

    // Get email statistics
    const emailStats = await AllUser.aggregate([
      { $match: { ...filter, email: { $ne: null } } },
      { 
        $group: { 
          _id: "$email", 
          count: { $sum: 1 },
          types: { $addToSet: "$type" }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get time-based analytics
    let dateFormat = "%Y-%m-%d";
    if (groupBy === "hour") dateFormat = "%Y-%m-%d %H:00";
    else if (groupBy === "month") dateFormat = "%Y-%m";

    const timeBasedInteractions = await AllUser.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalInteractions,
        interactionsByType,
        interactionsByStatus,
        interactionsByCountry,
        interactionsByDevice,
        topEmails: emailStats,
        timeBasedInteractions
      }
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching analytics",
    });
  }
});

// @desc    Get interactions statistics
// @route   GET /api/all-users/stats/overview
// @access  Private/Admin
const getInteractionStats = asyncHandler(async (req, res) => {
  try {
    const stats = await AllUser.aggregate([
      {
        $group: {
          _id: null,
          totalInteractions: { $sum: 1 },
          completedInteractions: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          failedInteractions: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          uniqueCountries: { $addToSet: "$country" },
          uniqueIPs: { $addToSet: "$ipAddress" },
          usersWithEmail: { $addToSet: { $cond: [{ $ne: ["$email", null] }, "$email", null] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalInteractions: 1,
          completedInteractions: 1,
          failedInteractions: 1,
          pendingInteractions: { $subtract: ["$totalInteractions", { $add: ["$completedInteractions", "$failedInteractions"] }] },
          uniqueCountries: { $size: "$uniqueCountries" },
          uniqueIPs: { $size: "$uniqueIPs" },
          usersWithEmail: { $size: { $filter: { input: "$usersWithEmail", as: "email", cond: { $ne: ["$$email", null] } } } },
          successRate: {
            $cond: {
              if: { $gt: ["$totalInteractions", 0] },
              then: { $multiply: [{ $divide: ["$completedInteractions", "$totalInteractions"] }, 100] },
              else: 0
            }
          }
        }
      }
    ]);

    const typeStats = await AllUser.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          usersWithEmail: { $sum: { $cond: [{ $ne: ["$email", null] }, 1, 0] } }
        }
      },
      {
        $project: {
          type: "$_id",
          count: 1,
          completed: 1,
          failed: 1,
          usersWithEmail: 1,
          successRate: {
            $cond: {
              if: { $gt: ["$count", 0] },
              then: { $multiply: [{ $divide: ["$completed", "$count"] }, 100] },
              else: 0
            }
          },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    const deviceStats = await AllUser.aggregate([
      {
        $group: {
          _id: "$deviceType",
          count: { $sum: 1 },
          uniqueIPs: { $addToSet: "$ipAddress" }
        }
      },
      {
        $project: {
          deviceType: "$_id",
          count: 1,
          uniqueUsers: { $size: "$uniqueIPs" },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        types: typeStats,
        devices: deviceStats,
      },
    });
  } catch (error) {
    console.error("Get interaction stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching interaction statistics",
    });
  }
});

// @desc    Delete interaction
// @route   DELETE /api/all-users/interactions/:id
// @access  Private/Admin
const deleteInteraction = asyncHandler(async (req, res) => {
  try {
    const interaction = await AllUser.findById(req.params.id);

    if (!interaction) {
      return res.status(404).json({
        success: false,
        message: "Interaction not found",
      });
    }

    await AllUser.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Interaction deleted successfully",
    });
  } catch (error) {
    console.error("Delete interaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting interaction",
    });
  }
});

// Helper function to extract device information from user agent
const extractDeviceInfo = (userAgent) => {
  const deviceInfo = {
    deviceType: "unknown",
    browser: "unknown",
    operatingSystem: "unknown",
    platform: "unknown"
  };

  try {
    if (!userAgent) return deviceInfo;

    // Simple device type detection
    if (/mobile/i.test(userAgent)) {
      deviceInfo.deviceType = "mobile";
    } else if (/tablet/i.test(userAgent)) {
      deviceInfo.deviceType = "tablet";
    } else if (/desktop/i.test(userAgent)) {
      deviceInfo.deviceType = "desktop";
    }

    // Browser detection
    if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) {
      deviceInfo.browser = "Chrome";
    } else if (/firefox/i.test(userAgent)) {
      deviceInfo.browser = "Firefox";
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      deviceInfo.browser = "Safari";
    } else if (/edg/i.test(userAgent)) {
      deviceInfo.browser = "Edge";
    }

    // OS detection
    if (/windows/i.test(userAgent)) {
      deviceInfo.operatingSystem = "Windows";
    } else if (/macintosh|mac os/i.test(userAgent)) {
      deviceInfo.operatingSystem = "macOS";
    } else if (/linux/i.test(userAgent)) {
      deviceInfo.operatingSystem = "Linux";
    } else if (/android/i.test(userAgent)) {
      deviceInfo.operatingSystem = "Android";
    } else if (/ios|iphone|ipad/i.test(userAgent)) {
      deviceInfo.operatingSystem = "iOS";
    }

    // Platform detection
    deviceInfo.platform = deviceInfo.operatingSystem;

  } catch (error) {
    console.error("Error extracting device info:", error);
  }

  return deviceInfo;
};

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  recordInteraction,
  getAllInteractions,
  getInteraction,
  updateInteractionStatus,
  getInteractionsByEmail,
  getAnalytics,
  getInteractionStats,
  deleteInteraction
};