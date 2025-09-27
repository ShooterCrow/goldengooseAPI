// models/subscriberModel.js
const mongoose = require("mongoose");

const subscriberSchema = new mongoose.Schema(
  {
    ipAddress: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String, // Changed from Number to String to handle international formats
    },
    ispProvider: {
      type: String,
      required: false,
    },
    subscribed: {
      type: Boolean,
      default: false,
    },
    email: {
      type: String,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please provide a valid email address",
      ],
    },
    country: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },
    region: {
      type: String,
      required: false,
    },
    lat_long: {
      type: String, // Storing as string to preserve precision
      required: false,
    },
    postal: {
      type: String,
      required: false,
    },
    timezone: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Add index for better query performance
subscriberSchema.index({ ipAddress: 1 });

const Subscriber = mongoose.model("Subscriber", subscriberSchema);

module.exports = Subscriber;