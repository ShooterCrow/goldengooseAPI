// controllers/adminController.js
const App = require('../model/App');
const Coupon = require('../model/Coupon');
const Game = require('../model/Game');
const GiftCard = require('../model/Giftcard');
const User = require('../model/User');

const getDashboardStats = async (req, res) => {
  try {
    // Get counts for all models in parallel
    const [
      totalApps,
      activeApps,
      totalCoupons,
      activeCoupons,
      totalGames,
      activeGames,
      totalGiftCards,
      activeGiftCards,
      totalUsers,
      recentApps,
      recentCoupons,
      recentGames,
      recentGiftCards
    ] = await Promise.all([
      // App stats
      App.countDocuments(),
      App.countDocuments({ active: true }),
      
      // Coupon stats
      Coupon.countDocuments(),
      Coupon.countDocuments({ active: true }),
      
      // Game stats
      Game.countDocuments(),
      Game.countDocuments({ active: true }),
      
      // GiftCard stats
      GiftCard.countDocuments(),
      GiftCard.countDocuments({ active: true }),
      
      // User stats
      User.countDocuments(),
      
      // Recent items for activity feed
      App.find().sort({ createdAt: -1 }).limit(2).select('title description createdAt'),
      Coupon.find().sort({ createdAt: -1 }).limit(2).select('title description createdAt'),
      Game.find().sort({ createdAt: -1 }).limit(2).select('title description createdAt'),
      GiftCard.find().sort({ createdAt: -1 }).limit(2).select('title description createdAt')
    ]);

    // Calculate growth percentages (you might want to store historical data for accurate growth)
    // For now, using mock growth data - you can implement actual growth calculation later
    const growthData = {
      appGrowth: 8.2,
      couponGrowth: 15.7,
      gameGrowth: 3.4,
      giftCardGrowth: 12.1,
      userGrowth: 5.2,
      revenueGrowth: 8.3
    };

    // Generate recent activities
    const recentActivities = [
      ...recentApps.map(app => ({
        title: 'New App Added',
        description: `${app.title} was added to the platform`,
        time: formatTimeAgo(app.createdAt),
        timestamp: app.createdAt,
        type: 'app'
      })),
      ...recentCoupons.map(coupon => ({
        title: 'New Coupon Added',
        description: `${coupon.title} is now available`,
        time: formatTimeAgo(coupon.createdAt),
        timestamp: coupon.createdAt,
        type: 'coupon'
      })),
      ...recentGames.map(game => ({
        title: 'New Game Added',
        description: `${game.title} was added to the platform`,
        time: formatTimeAgo(game.createdAt),
        timestamp: game.createdAt,
        type: 'game'
      })),
      ...recentGiftCards.map(giftCard => ({
        title: 'New Gift Card Added',
        description: `${giftCard.title} is now available`,
        time: formatTimeAgo(giftCard.createdAt),
        timestamp: giftCard.createdAt,
        type: 'giftcard'
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6);

    // Platform-wide stats (you can add actual revenue/order tracking later)
    const platformStats = {
      totalRevenue: 45231, // This should come from your payment/order system
      totalOrders: 1234,   // This should come from your order system
      conversionRate: 3.2  // This should be calculated from your analytics
    };

    const stats = {
      // Item counts
      apps: {
        total: totalApps,
        active: activeApps,
        growth: growthData.appGrowth
      },
      coupons: {
        total: totalCoupons,
        active: activeCoupons,
        growth: growthData.couponGrowth
      },
      games: {
        total: totalGames,
        active: activeGames,
        growth: growthData.gameGrowth
      },
      giftCards: {
        total: totalGiftCards,
        active: activeGiftCards,
        growth: growthData.giftCardGrowth
      },
      
      // Platform stats
      platform: {
        totalUsers,
        totalRevenue: platformStats.totalRevenue,
        totalOrders: platformStats.totalOrders,
        conversionRate: platformStats.conversionRate,
        userGrowth: growthData.userGrowth,
        revenueGrowth: growthData.revenueGrowth,
        orderGrowth: -2.1, // Example data
        conversionGrowth: 0.5 // Example data
      },
      
      // Recent activities
      recentActivities
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Helper function to format time ago
const formatTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return `${Math.floor(diffInSeconds / 2592000)} months ago`;
};

// Get detailed stats for a specific entity type
const getDetailedStats = async (req, res) => {
  try {
    const { entity } = req.params;
    const { period = '30d' } = req.query; // 7d, 30d, 90d, 1y

    let Model;
    let stats = {};

    switch (entity) {
      case 'apps':
        Model = App;
        break;
      case 'coupons':
        Model = Coupon;
        break;
      case 'games':
        Model = Game;
        break;
      case 'giftcards':
        Model = GiftCard;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type'
        });
    }

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get creation stats over time
    const creationStats = await Model.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get category distribution (if applicable)
    const categoryStats = await Model.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get status distribution
    const statusStats = await Model.aggregate([
      {
        $group: {
          _id: "$active",
          count: { $sum: 1 }
        }
      }
    ]);

    stats = {
      creationTimeline: creationStats,
      categoryDistribution: categoryStats,
      statusDistribution: statusStats,
      total: await Model.countDocuments(),
      active: await Model.countDocuments({ active: true }),
      period: {
        start: startDate,
        end: endDate
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error(`Detailed stats error for ${req.params.entity}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch detailed statistics',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getDetailedStats
};