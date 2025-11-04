// controllers/gameController.js
const Game = require("../model/Game");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { sanitizeInput } = require("../utils/sanitizeInput");

// @desc    Get all games (with optional filtering)
// @route   GET /api/games
// @access  Public
const getAllGames = asyncHandler(async (req, res) => {
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
    const games = await Game.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await Game.countDocuments(filter);

    res.json({
      success: true,
      data: games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get all games error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching games",
    });
  }
});

// @desc    Get single game
// @route   GET /api/games/:id
// @access  Public
const getGame = asyncHandler(async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    res.json({
      success: true,
      data: game,
    });
  } catch (error) {
    console.error("Get game error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid game ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while fetching game",
    });
  }
});

// @desc    Create new game
// @route   POST /api/games
// @access  Private/Admin
const createGame = asyncHandler(async (req, res) => {
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
    const existingGame = await Game.findOne({ title });
    if (existingGame) {
      return res.status(409).json({
        success: false,
        message: "Game with this title already exists",
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

    // Create game
    const game = new Game({
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

    const savedGame = await game.save();

    res.status(201).json({
      success: true,
      message: "Game created successfully",
      data: savedGame,
    });
  } catch (error) {
    console.error("Create game error:", error);
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
      message: "Server error while creating game",
    });
  }
});

const batchCreateGames = asyncHandler(async (req, res) => {
  try {
    const { games } = req.body;

    // Validate input is an array
    if (!Array.isArray(games) || games.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body must include a non-empty 'games' array",
      });
    }

    const results = {
      successful: [],
      failed: [],
    };

    // Extract titles for bulk duplicate check
    const titles = games
      .map(g => g?.title?.trim())
      .filter(Boolean);

    // Check for existing titles in database
    let existingTitles = new Set();
    if (titles.length > 0) {
      const existingGames = await Game.find({ 
        title: { $in: titles } 
      }).select('title');
      existingTitles = new Set(existingGames.map(g => g.title));
    }

    // Track titles within batch to prevent duplicates
    const batchTitles = new Set();

    // Process each game
    for (let index = 0; index < games.length; index++) {
      try {
        // Sanitize input data
        const sanitizedBody = sanitizeInput(games[index]);
        
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
          results.failed.push({
            index: index + 1,
            title: title || 'N/A',
            error: "Title, merchant, image, logo, offer, description, action, and actionLink are required",
          });
          continue;
        }

        // Normalize title
        const normalizedTitle = title.trim();

        // Check if title already exists in database
        if (existingTitles.has(normalizedTitle)) {
          results.failed.push({
            index: index + 1,
            title: normalizedTitle,
            error: "Game with this title already exists in database",
          });
          continue;
        }

        // Check for duplicate within batch
        if (batchTitles.has(normalizedTitle)) {
          results.failed.push({
            index: index + 1,
            title: normalizedTitle,
            error: "Duplicate title within batch",
          });
          continue;
        }

        // Add to batch tracking
        batchTitles.add(normalizedTitle);

        // Validate rating
        if (rating && (rating < 0 || rating > 5)) {
          results.failed.push({
            index: index + 1,
            title: normalizedTitle,
            error: "Rating must be between 0 and 5",
          });
          continue;
        }

        // Validate numerical fields
        if (itemsLeft !== undefined && itemsLeft < 0) {
          results.failed.push({
            index: index + 1,
            title: normalizedTitle,
            error: "Items left cannot be negative",
          });
          continue;
        }

        // Create game
        const game = new Game({
          title: normalizedTitle,
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

        const savedGame = await game.save();

        // Add to tracking
        existingTitles.add(normalizedTitle);

        results.successful.push({
          index: index + 1,
          title: normalizedTitle,
          data: savedGame,
        });

      } catch (error) {
        console.error(`Error processing game at index ${index}:`, error);
        
        if (error.name === "ValidationError") {
          const errors = Object.values(error.errors).map(val => val.message);
          results.failed.push({
            index: index + 1,
            title: games[index]?.title || 'N/A',
            error: "Validation error",
            details: errors,
          });
        } else {
          results.failed.push({
            index: index + 1,
            title: games[index]?.title || 'N/A',
            error: error.message || "Unknown error",
          });
        }
      }
    }

    // Determine response status
    const allSuccessful = results.failed.length === 0;
    const allFailed = results.successful.length === 0;
    const statusCode = allFailed ? 400 : allSuccessful ? 201 : 207;

    res.status(statusCode).json({
      success: !allFailed,
      message: `Batch creation complete: ${results.successful.length} successful, ${results.failed.length} failed`,
      summary: {
        total: games.length,
        successful: results.successful.length,
        failed: results.failed.length,
      },
      data: results.successful.map(r => r.data),
      ...(results.failed.length > 0 && { errors: results.failed }),
    });

  } catch (error) {
    console.error("Batch create games error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while batch creating games",
      error: error.message,
    });
  }
});

// @desc    Update game
// @route   PUT /api/games/:id
// @access  Private/Admin
const updateGame = asyncHandler(async (req, res) => {
  try {
    // Sanitize input data
    const sanitizedBody = sanitizeInput(req.body);
    
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    // Check if title is being changed and if it already exists
    if (sanitizedBody.title && sanitizedBody.title !== game.title) {
      const existingGame = await Game.findOne({ title: sanitizedBody.title });
      if (existingGame) {
        return res.status(409).json({
          success: false,
          message: "Game with this title already exists",
        });
      }
    }

    // Update game
    const updatedGame = await Game.findByIdAndUpdate(
      req.params.id,
      sanitizedBody,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Game updated successfully",
      data: updatedGame,
    });
  } catch (error) {
    console.error("Update game error:", error);
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
      message: "Server error while updating game",
    });
  }
});

// @desc    Delete game
// @route   DELETE /api/games/:id
// @access  Private/Admin
const deleteGame = asyncHandler(async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    await Game.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: "Game deleted successfully",
    });
  } catch (error) {
    console.error("Delete game error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting game",
    });
  }
});

// @desc    Get games by merchant
// @route   GET /api/games/merchant/:merchant
// @access  Public
const getGamesByMerchant = asyncHandler(async (req, res) => {
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
    const games = await Game.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const total = await Game.countDocuments(filter);

    res.json({
      success: true,
      data: games,
      merchant,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get games by merchant error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching games by merchant",
    });
  }
});

// @desc    Get trending games
// @route   GET /api/games/trending
// @access  Public
const getTrendingGames = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      minRating = 4.5,
      minUsage = 50
    } = req.query;

    const games = await Game.find({
      verified: true,
      rating: { $gte: Number(minRating) },
      usedToday: { $gte: Number(minUsage) }
    })
    .sort({ rating: -1, usedToday: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const total = await Game.countDocuments({
      verified: true,
      rating: { $gte: Number(minRating) },
      usedToday: { $gte: Number(minUsage) }
    });

    res.json({
      success: true,
      data: games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get trending games error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching trending games",
    });
  }
});

// @desc    Get games statistics
// @route   GET /api/games/stats/overview
// @access  Private/Admin
const getGameStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Game.aggregate([
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          totalRatings: { $sum: '$totalRatings' },
          avgRating: { $avg: '$rating' },
          totalUsedToday: { $sum: '$usedToday' },
          totalItemsLeft: { $sum: '$itemsLeft' },
          verifiedGames: { $sum: { $cond: ['$verified', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalGames: 1,
          totalRatings: 1,
          avgRating: { $round: ['$avgRating', 1] },
          totalUsedToday: 1,
          totalItemsLeft: 1,
          verifiedGames: 1,
          unverifiedGames: { $subtract: ['$totalGames', '$verifiedGames'] }
        }
      }
    ]);

    const merchantStats = await Game.aggregate([
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

    const badgeStats = await Game.aggregate([
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
    console.error("Get game stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching game statistics",
    });
  }
});

module.exports = {
  getAllGames,
  getGame,
  createGame,
  updateGame,
  deleteGame,
  getGamesByMerchant,
  getTrendingGames,
  getGameStats,
  batchCreateGames 
};