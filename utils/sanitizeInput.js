const mongoSanitize = require("express-mongo-sanitize");

// Utility function to sanitize input
exports.sanitizeInput = (data) => {
  if (typeof data === "object" && data !== null) {
    return mongoSanitize.sanitize(data);
  }
  return data;
};