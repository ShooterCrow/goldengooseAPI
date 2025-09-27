const mongoose = require('mongoose');
const { DatabaseError } = require('../utils/customErrors');
const { logEvents } = require('../middleware/logEvents');

const dbConnect = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URI, 
            // No Need for  useNewUrlParser and useUnifiedTopology options as they are default in mongoose 6+
        //     {
        //     useNewUrlParser: true,
        //     useUnifiedTopology: true
        // }
    );

        // Log successful connection
        await logEvents(
            'MongoDB connection established',
            'mongoLog.txt',
            'system',
            'info',
            { connectionTime: new Date() }
        );

        // Handle MongoDB specific events
        mongoose.connection.on('error', async (error) => {
            await logEvents(
                `MongoDB Error: ${error.message}`,
                'mongoLog.txt',
                'error',
                'critical',
                { errorDetails: error }
            );
            throw new DatabaseError('Database connection error');
        });

        mongoose.connection.on('disconnected', async () => {
            await logEvents(
                'MongoDB disconnected',
                'mongoLog.txt',
                'system',
                'warn',
                { disconnectionTime: new Date() }
            );
        });

        mongoose.connection.on('reconnected', async () => {
            await logEvents(
                'MongoDB reconnected',
                'mongoLog.txt',
                'system',
                'info',
                { reconnectionTime: new Date() }
            );
        });

        // Handle application termination
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            await logEvents(
                'MongoDB disconnected through app termination',
                'mongoLog.txt',
                'system',
                'info',
                { shutdownTime: new Date() }
            );
            process.exit(0);
        });

    } catch (error) {
        await logEvents(
            `MongoDB Connection Error: ${error.message}`,
            'mongoLog.txt',
            'error',
            'critical',
            { errorDetails: error }
        );
        throw new DatabaseError(error.message);
    }
};

module.exports = dbConnect;