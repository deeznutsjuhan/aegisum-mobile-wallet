const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('../database/connection');
const logger = require('../utils/logger');

// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs: windowMs,
        max: max,
        message: {
            success: false,
            message: message
        },
        standardHeaders: true,
        legacyHeaders: false,
        trustProxy: false, // Disable trust proxy for rate limiting
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            res.status(429).json({
                success: false,
                message: message
            });
        }
    });
};

// General API rate limit
const apiRateLimit = createRateLimit(
    parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per window
    'Too many requests from this IP, please try again later'
);

// Strict rate limit for authentication endpoints
const authRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts per window
    'Too many authentication attempts, please try again later'
);

// Transaction rate limit
const transactionRateLimit = createRateLimit(
    60 * 1000, // 1 minute
    10, // 10 transactions per minute
    'Too many transaction requests, please slow down'
);

// Admin rate limit
const adminRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    50, // 50 requests per window
    'Too many admin requests, please try again later'
);

// IP tracking middleware
const trackIP = async (req, res, next) => {
    try {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const action = `${req.method} ${req.path}`;
        
        // Get user info if authenticated
        let userId = null;
        let username = null;
        
        if (req.user) {
            userId = req.user.id;
            username = req.user.username;
        }

        // Log IP activity
        await db.run(
            'INSERT INTO ip_tracking (ip_address, user_id, username, action) VALUES (?, ?, ?, ?)',
            [ipAddress, userId, username, action]
        );

        // Add IP to request for other middleware
        req.clientIP = ipAddress;
        req.userAgent = userAgent;
        
        next();
    } catch (error) {
        logger.error('IP tracking error', { error: error.message });
        // Don't block the request if IP tracking fails
        next();
    }
};

// Security headers middleware
const securityHeaders = helmet({
    contentSecurityPolicy: false, // Temporarily disable CSP for testing
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',')
            : ['http://localhost:3000'];
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked request', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Remove potentially dangerous characters from string inputs
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                     .replace(/javascript:/gi, '')
                     .replace(/on\w+\s*=/gi, '');
        }
        if (typeof obj === 'object' && obj !== null) {
            for (let key in obj) {
                obj[key] = sanitize(obj[key]);
            }
        }
        return obj;
    };

    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    if (req.params) {
        req.params = sanitize(req.params);
    }

    next();
};

// Suspicious activity detection
const detectSuspiciousActivity = async (req, res, next) => {
    try {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
        const suspiciousThreshold = 5; // 5 different users from same IP

        // Check for multiple accounts from same IP
        const recentActivity = await db.all(`
            SELECT DISTINCT username, user_id 
            FROM ip_tracking 
            WHERE ip_address = ? 
            AND created_at > datetime('now', '-24 hours')
            AND username IS NOT NULL
        `, [ipAddress]);

        if (recentActivity.length >= suspiciousThreshold) {
            logger.warn('Suspicious activity detected', {
                ipAddress,
                uniqueUsers: recentActivity.length,
                users: recentActivity.map(u => u.username)
            });

            // Add to suspicious activity log
            req.suspiciousActivity = {
                type: 'multiple_accounts_same_ip',
                details: {
                    ipAddress,
                    uniqueUsers: recentActivity.length,
                    users: recentActivity.map(u => u.username)
                }
            };
        }

        next();
    } catch (error) {
        logger.error('Suspicious activity detection error', { error: error.message });
        next(); // Don't block request on error
    }
};

module.exports = {
    apiRateLimit,
    authRateLimit,
    transactionRateLimit,
    adminRateLimit,
    trackIP,
    securityHeaders,
    corsOptions,
    sanitizeInput,
    detectSuspiciousActivity
};