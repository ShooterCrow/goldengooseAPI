// models/App.js
const mongoose = require('mongoose');

const appSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  merchant: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  logo: {
    type: String,
    required: true
  },
  offer: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  itemsLeft: {
    type: Number,
    required: true,
    min: 0
  },
  expiry: {
    type: String,
    required: true
  },
  usesToday: {
    type: String,
    required: true
  },
  usedToday: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  verified: {
    type: Boolean,
    required: true,
    default: false
  },
  details: {
    type: String,
    required: true
  },
  action: {
    actionLink: {
      type: String,
      required: true
    },
    actionProvider: {
      type: String,
      enum: ['og_ads', 'cpa_grip', 'cpa_lead', 'Other'],
      default: 'og_ads'
    }
  },
  badge: {
    type: String,
    enum: ['Music', 'Design', 'Streaming', 'Photo', 'Video', 'AI', 'Health', 'General', 'Productivity', 'Entertainment', 'Social'],
    default: 'General'
  }
}, {
  timestamps: true
});

// Index for better search performance
appSchema.index({ title: 'text', description: 'text', details: 'text' });
appSchema.index({ rating: -1 });
appSchema.index({ badge: 1 });
appSchema.index({ verified: 1 });
appSchema.index({ totalRatings: -1 });

module.exports = mongoose.model('App', appSchema);