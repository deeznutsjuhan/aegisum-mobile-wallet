const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

// Import utilities and middleware
const logger = require('./utils/logger');
const db = require('./database/connection');
const { securityHeaders, corsOptions, apiRateLimit } = require('./middleware/security');

// Import routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const transactionRoutes = require('./routes/transaction');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for admin dashboard
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));

// API routes
app.use('/api', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/admin', adminRoutes);

// Admin dashboard route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Aegisum Mobile Wallet Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            info: '/api/info',
            auth: '/api/auth',
            wallet: '/api/wallet',
            transaction: '/api/transaction',
            admin: '/api/admin',
            dashboard: '/admin'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });

    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message
    });
});

// Cleanup old IP tracking data (runs daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
    try {
        logger.info('Starting daily cleanup task');
        
        // Delete IP tracking data older than 30 days
        const result = await db.run(
            'DELETE FROM ip_tracking WHERE created_at < datetime("now", "-30 days")'
        );
        
        logger.info('Daily cleanup completed', { deletedRows: result.changes });
    } catch (error) {
        logger.error('Daily cleanup failed', { error: error.message });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    try {
        await db.close();
        logger.info('Database connection closed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    
    try {
        await db.close();
        logger.info('Database connection closed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
});

// Start server
async function startServer() {
    try {
        // Connect to database
        await db.connect();
        logger.info('Database connected successfully');

        // Start HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Aegisum Mobile Wallet Backend started on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Admin dashboard: http://localhost:${PORT}/admin`);
        });

        // Handle server errors
        server.on('error', (error) => {
            logger.error('Server error', { error: error.message });
            process.exit(1);
        });

    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;