// models/GiftCard.js
const mongoose = require("mongoose");
const clickSchema = require("./clickSchema");

const giftCardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    merchant: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      required: true,
    },
    offer: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    itemsLeft: {
      type: Number,
      required: true,
      min: 0,
    },
    expiry: {
      type: String,
      required: true,
    },
    usesToday: {
      type: String,
      required: true,
    },
    usedToday: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    verified: {
      type: Boolean,
      required: true,
      default: false,
    },
    details: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      trim: true,
    },
    badge: {
      type: String,
      enum: ["Popular", "Best Seller", "Gaming", "Top Rated", null],
      default: null,
    },
    action: {
      actionLink: {
        type: String,
        required: true,
      },
      actionProvider: {
        type: String,
        enum: ["og_ads", "cpa_grip", "cpa_lead", "Other"],
        default: "og_ads",
      },
    },
    clicks: [clickSchema],
    totalClicks: {
      type: Number,
      default: 0,
    },
    uniqueClicks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
giftCardSchema.index({ title: "text", description: "text", details: "text" });
giftCardSchema.index({ rating: -1 });
giftCardSchema.index({ badge: 1 });
giftCardSchema.index({ verified: 1 });
giftCardSchema.index({ totalRatings: -1 });

module.exports = mongoose.model("GiftCard", giftCardSchema);
