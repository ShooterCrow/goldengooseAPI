const { logEvents, errorLogger } = require('./logEvents');

const errorHandler = async (err, req, res, next) => {
    // Generate log ID and log the error
    const logId = await errorLogger(err, req);

    // Set default status code and message
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';

    // Determine error type and create response
    const errorResponse = {
        success: false,
        error: {
            message,
            type: err.name || 'ServerError',
            code: statusCode,
            logId
        }
    };

    // Add stack trace in development environment
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.stack = err.stack;
    }

    // Add validation errors if available
    if (err.errors) {
        errorResponse.error.details = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
    }

    // Log critical errors (500s) to console
    if (statusCode >= 500) {
        console.error('Critical Error:', {
            logId,
            message: err.message,
            stack: err.stack
        });
    }

    // Send response
    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;