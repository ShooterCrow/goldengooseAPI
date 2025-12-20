// models/settingsModel.js
const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Modloot",
    },
    emailSender: {
      type: String,
      enum: ["resend", "mailerlite"],
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

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
