// middleware/clickTracker.js
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js'); // npm install ua-parser-js

// Helper function to get device type from user agent
const getDeviceType = (userAgent) => {
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  
  if (device.type === 'mobile') return 'mobile';
  if (device.type === 'tablet') return 'tablet';
  if (device.type === 'console' || device.type === 'smarttv') return 'other';
  return 'desktop';
};

// Helper function to generate session ID
const generateSessionId = (req) => {
  return req.sessionID || 
         req.ip + 
         req.get('User-Agent')?.substring(0, 25) + 
         Date.now().toString(36);
};

// Main click tracking function
const trackClick = (modelName) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Get client IP address
      const ip = req.ip || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);

      // Get geolocation data
      const geo = geoip.lookup(ip);
      
      // Parse user agent
      const userAgent = req.get('User-Agent') || 'Unknown';
      const parser = new UAParser(userAgent);
      const browser = parser.getBrowser();
      const os = parser.getOS();

      // Prepare click data
      const clickData = {
        ip,
        country: geo?.country || 'Unknown',
        city: geo?.city || 'Unknown',
        region: geo?.region || 'Unknown',
        userAgent,
        referrer: req.get('Referer') || 'Direct',
        deviceType: getDeviceType(userAgent),
        browser: `${browser.name || 'Unknown'} ${browser.version || ''}`.trim(),
        os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
        sessionId: generateSessionId(req),
        userId: req.user?._id || null
      };

      // Check if this is a unique click (based on IP and session in last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const existingClick = await mongoose.model(modelName).findOne({
        _id: id,
        'clicks.ip': ip,
        'clicks.sessionId': clickData.sessionId,
        'clicks.date': { $gte: twentyFourHoursAgo }
      });

      clickData.isUnique = !existingClick;

      // Update the document with new click
      await mongoose.model(modelName).findByIdAndUpdate(id, {
        $push: { clicks: clickData },
        $inc: { 
          totalClicks: 1,
          ...(clickData.isUnique && { uniqueClicks: 1 })
        }
      });

      next();
    } catch (error) {
      console.error(`Click tracking error for ${modelName}:`, error);
      next(); // Don't block the request if tracking fails
    }
  };
};

// Batch click tracking for multiple items
const trackBatchClicks = (modelName) => {
  return async (req, res, next) => {
    try {
      const { ids } = req.body; // Array of item IDs
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return next();
      }

      const ip = req.ip;
      const sessionId = generateSessionId(req);
      const now = new Date();

      // Track clicks for all items in the batch
      const clickData = {
        ip,
        sessionId,
        date: now,
        // ... other click data similar to trackClick
      };

      // Update all documents at once
      await mongoose.model(modelName).updateMany(
        { _id: { $in: ids } },
        {
          $push: { clicks: clickData },
          $inc: { totalClicks: 1 }
        }
      );

      next();
    } catch (error) {
      console.error(`Batch click tracking error for ${modelName}:`, error);
      next();
    }
  };
};

module.exports = {
  trackClick,
  trackBatchClicks,
  getDeviceType,
  generateSessionId
};