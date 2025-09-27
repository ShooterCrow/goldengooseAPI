// models/offerModel.js
const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    links: {
      ghana: { type: String, required: false },
      kenya: { type: String, required: false },
      nigeria: { type: String, required: false },
    },
  },
  {
    timestamps: true,
  }
);

const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;
