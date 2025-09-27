const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const fsPromises = require("fs/promises");
const { format } = require("date-fns");
const Log = require('../model/Log');

const logEvents = async (message, logFileName, type = 'system', level = 'info', details = {}) => {
    const dateTime = format(new Date(), 'yyyyMMdd\tHH:mm:ss');
    const logId = uuidv4();
    const logItem = `${dateTime}\t${logId}\t${message}\n`;

    try {
        // File logging
        const logsFolderPath = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsFolderPath)) {
            await fsPromises.mkdir(logsFolderPath);
        }
        await fsPromises.appendFile(path.join(logsFolderPath, logFileName), logItem);

        // MongoDB logging - Updated for our model
        await Log.create({
            logId,
            type,
            level,
            message,
            details
        });
    } catch (err) {
        console.error('Error writing to logs:', err);
    }
};

const errorLogger = async (err, req) => {
    const logId = uuidv4();
    const errorDetails = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        title: err.name,
        source: `${req.method} ${req.path}`,
        hasPreferences: false, // Default for errors
        changes: {
            method: req.method,
            url: req.path,
            origin: req.headers.origin,
            errorName: err.name,
            errorStack: err.stack,
            statusCode: err.statusCode || 500,
            requestBody: req.body,
            requestQuery: req.query
        }
    };

    const logMessage = `${err.name}: ${err.message}`;
    
    // Map error types to our log types (use closest match)
    const getErrorLogType = (err) => {
        if (err.name?.includes('Subscriber')) return 'subscriber_update'; // Generic subscriber error
        if (err.name?.includes('Offer')) return 'offer_update'; // Generic offer error
        return 'offer_update'; // Default fallback
    };

    // Log to both file and MongoDB
    await logEvents(
        `${logMessage}\t${req.method}\t${req.url}\t${req.ip}`,
        'errorLog.txt',
        getErrorLogType(err),
        err.statusCode >= 500 ? 'critical' : 'error',
        errorDetails
    );

    // For critical errors, log full details to separate file
    if (err.statusCode >= 500) {
        const detailedLog = JSON.stringify({ logId, ...errorDetails }, null, 2);
        await logEvents(detailedLog, 'criticalErrors.txt', getErrorLogType(err), 'critical', errorDetails);
    }

    return logId;
};

const requestLogger = async (req, res, next) => {
    const logId = uuidv4();
    const requestDetails = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        source: req.headers.origin || 'direct',
        title: `${req.method} ${req.url}`,
        hasPreferences: false,
        changes: {
            method: req.method,
            url: req.url,
            origin: req.headers.origin,
            requestBody: req.body,
            requestQuery: req.query
        }
    };

    // Determine log type based on request path
    const getRequestLogType = (req) => {
        if (req.url.includes('/subscriber')) return 'subscriber_update';
        if (req.url.includes('/offer')) return 'offer_update';
        return 'offer_update'; // Default
    };

    await logEvents(
        `${req.method}\t${req.url}\t${req.headers.origin || 'direct'}\t${req.ip}`,
        'reqLog.txt',
        getRequestLogType(req),
        'info',
        requestDetails
    );
    
    next();
};

// Subscriber-specific logging helper
const logSubscriberActivity = async (type, message, details = {}) => {
    const logId = uuidv4();
    
    await Log.create({
        logId,
        type,
        level: 'info',
        message,
        details: {
            subscriberId: details.subscriberId || null,
            email: details.email || '',
            name: details.name || '',
            source: details.source || '',
            hasPreferences: details.hasPreferences || false,
            changes: details.changes || {},
            updatedFields: details.updatedFields || [],
            subscriberIds: details.subscriberIds || [],
            newStatus: details.newStatus || '',
            deletedCount: details.deletedCount || 0,
            totalCount: details.totalCount || 0,
            activeCount: details.activeCount || 0,
            modifiedCount: details.modifiedCount || 0,
            ...details
        }
    });
};

// Offer-specific logging helper
const logOfferActivity = async (type, message, details = {}) => {
    const logId = uuidv4();
    
    await Log.create({
        logId,
        type,
        level: 'info',
        message,
        details: {
            offerId: details.offerId || null,
            title: details.title || '',
            active: details.active || false,
            hasGhanaLink: details.hasGhanaLink || false,
            hasKenyaLink: details.hasKenyaLink || false,
            hasNigeriaLink: details.hasNigeriaLink || false,
            totalLinks: details.totalLinks || 0,
            wasActive: details.wasActive || false,
            hadLinks: details.hadLinks || {},
            previousStatus: details.previousStatus || '',
            country: details.country || '',
            city: details.city || '',
            ip: details.ip || '',
            userAgent: details.userAgent || '',
            changes: details.changes || {},
            updatedFields: details.updatedFields || [],
            ...details
        }
    });
};

// Cleanup old logs periodically (keeps last 30 days)
const cleanupOldLogs = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        await Log.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
        console.log('Old logs cleaned up successfully');
    } catch (err) {
        console.error('Error cleaning up old logs:', err);
    }
};

// Run cleanup daily
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

module.exports = { 
    logEvents, 
    errorLogger, 
    requestLogger,
    logSubscriberActivity,
    logOfferActivity
};