const mongoose = require('mongoose');

const offerCompletionSchema = new mongoose.Schema(
  {
    offer: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired', 'used'],
      default: 'pending',
    },
    isEmailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

offerCompletionSchema.index({ code: 1 });

const OfferCompletion = mongoose.model('OfferCompletion', offerCompletionSchema);

module.exports = OfferCompletion;