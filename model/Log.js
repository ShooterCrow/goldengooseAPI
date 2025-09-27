const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    logId: {
        type: String,
        required: true
    },
    level: {
        type: String,
        enum: ['info', 'warn', 'error', 'critical'],
        default: 'info'
    },
    type: {
        type: String,
        enum: [
            'system',
            'subscriber_create',
            'subscriber_update',
            'subscriber_delete',
            'subscriber_bulk_delete',
            'subscriber_bulk_update',
            'offer_create',
            'offer_update',
            'offer_delete',
            'offer_status_toggle',
            'offer_access'
        ],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    details: {
        title: String,
        hasImage: Boolean,
        imageUpdated: Boolean,
        subscriberId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscriber'
        },
        email: String,
        name: String,
        source: String,
        hasPreferences: Boolean,
        changes: mongoose.Schema.Types.Mixed,
        updatedFields: [String],
        subscriberIds: [mongoose.Schema.Types.ObjectId],
        newStatus: String,
        deletedCount: Number,
        totalCount: Number,
        activeCount: Number,
        modifiedCount: Number,
        
        // Offer-related fields
        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Offer'
        },
        active: Boolean,
        hasGhanaLink: Boolean,
        hasKenyaLink: Boolean,
        hasNigeriaLink: Boolean,
        totalLinks: Number,
        wasActive: Boolean,
        hadLinks: {
            ghana: Boolean,
            kenya: Boolean,
            nigeria: Boolean
        },
        previousStatus: String,
        country: String,
        city: String,
        ip: String,
        userAgent: String
    }
}, {
    timestamps: true
});

// Index for efficient querying
logSchema.index({ timestamp: -1, type: 1, level: 1 });
logSchema.index({ type: 1, timestamp: -1 });
logSchema.index({ level: 1, timestamp: -1 });
logSchema.index({ 'details.subscriberId': 1, timestamp: -1 });
logSchema.index({ 'details.offerId': 1, timestamp: -1 });

const Log = mongoose.model('Log', logSchema);

module.exports = Log;