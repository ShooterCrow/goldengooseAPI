// models/ClickSchema.js
const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  country: {
    type: String,
    default: 'Unknown',
    trim: true
  },
  city: {
    type: String,
    default: 'Unknown',
    trim: true
  },
  region: {
    type: String,
    default: 'Unknown',
    trim: true
  },
  userAgent: {
    type: String,
    default: 'Unknown',
    trim: true
  },
  referrer: {
    type: String,
    default: 'Direct',
    trim: true
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'bot', 'unknown'],
    default: 'unknown'
  },
  browser: {
    type: String,
    default: 'Unknown'
  },
  os: {
    type: String,
    default: 'Unknown'
  },
  isUnique: {
    type: Boolean,
    default: true
  },
  sessionId: {
    type: String,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  timestamps: true
});

// Static methods for click analytics
clickSchema.statics.getClickStats = function(filters = {}) {
  const matchStage = {};
  
  if (filters.startDate) {
    matchStage.date = { $gte: new Date(filters.startDate) };
  }
  if (filters.endDate) {
    matchStage.date = { ...matchStage.date, $lte: new Date(filters.endDate) };
  }
  if (filters.country) {
    matchStage.country = filters.country;
  }
  if (filters.deviceType) {
    matchStage.deviceType = filters.deviceType;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalClicks: { $sum: 1 },
        uniqueClicks: { $sum: { $cond: ['$isUnique', 1, 0] } },
        countries: { $addToSet: '$country' },
        devices: { $addToSet: '$deviceType' }
      }
    },
    {
      $project: {
        totalClicks: 1,
        uniqueClicks: 1,
        uniqueCountries: { $size: '$countries' },
        uniqueDevices: { $size: '$devices' },
        clickThroughRate: {
          $multiply: [
            { $divide: [{ $sum: { $cond: ['$isUnique', 1, 0] } }, { $sum: 1 }] },
            100
          ]
        }
      }
    }
  ]);
};

clickSchema.statics.getDailyClicks = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        date: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
        },
        totalClicks: { $sum: 1 },
        uniqueClicks: { $sum: { $cond: ['$isUnique', 1, 0] } }
      }
    },
    {
      $sort: { '_id.date': 1 }
    },
    {
      $project: {
        date: '$_id.date',
        totalClicks: 1,
        uniqueClicks: 1
      }
    }
  ]);
};

clickSchema.statics.getGeoDistribution = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$country',
        totalClicks: { $sum: 1 },
        uniqueClicks: { $sum: { $cond: ['$isUnique', 1, 0] } }
      }
    },
    {
      $sort: { totalClicks: -1 }
    },
    {
      $project: {
        country: '$_id',
        totalClicks: 1,
        uniqueClicks: 1
      }
    }
  ]);
};

clickSchema.statics.getDeviceStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$deviceType',
        totalClicks: { $sum: 1 },
        uniqueClicks: { $sum: { $cond: ['$isUnique', 1, 0] } }
      }
    },
    {
      $sort: { totalClicks: -1 }
    },
    {
      $project: {
        deviceType: '$_id',
        totalClicks: 1,
        uniqueClicks: 1
      }
    }
  ]);
};

module.exports = clickSchema;