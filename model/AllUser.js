const mongoose = require("mongoose");

const allUserSchema = new mongoose.Schema(
  {
    // Type of allUser
    type: {
      type: String,
      required: true,
      enum: [
        "app_download",
        "gift_card",
        "coupon",
        "game_redeem",
        "coupon",
        "page_view",
        "other",
      ],
    },

    // User information
    userAgent: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
    },
    phoneNumber: {
      type: Number,
      required: false,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
    },
    region: {
      type: String,
      default: null,
    },
    timezone: {
      type: String,
      default: null,
    },

    // Device information
    deviceType: {
      type: String,
      enum: ["mobile", "tablet", "desktop", "unknown"],
      default: "unknown",
    },
    browser: {
      type: String,
      default: null,
    },
    operatingSystem: {
      type: String,
      default: null,
    },
    platform: {
      type: String,
      default: null,
    },

    // AllUser details
    offerTitle: {
      type: String,
      default: null,
      required: true,
    },
    actionLink: {
      type: String,
      default: null,
    },

    // Status tracking
    status: {
      type: String,
      enum: ["initiated", "completed", "failed", "cancelled"],
      default: "initiated",
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
allUserSchema.index({ type: 1, createdAt: -1 });
allUserSchema.index({ ipAddress: 1 });
allUserSchema.index({ country: 1 });

// Pre-save middleware to update updatedAt
allUserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get allUsers by type and date range
allUserSchema.statics.getByTypeAndDateRange = function (
  type,
  startDate,
  endDate
) {
  return this.find({
    type: type,
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });
};

// Virtual for formatted date
allUserSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString();
});

const AllUser = mongoose.model("AllUser", allUserSchema);

module.exports = AllUser;
