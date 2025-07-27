const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlockedEntity = require('../models/BlockedEntity');
const logger = require('../utils/logger');
require('dotenv').config();

// Middleware to authenticate JWT tokens
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access token required' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user details
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token - user not found' 
            });
        }

        // Check if user is blocked
        if (user.is_blocked) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is blocked' 
            });
        }

        // Check if user is blocked by other criteria
        const ipAddress = req.ip || req.connection.remoteAddress;
        const isBlocked = await BlockedEntity.isUserBlocked(user.username, user.email, ipAddress);
        if (isBlocked) {
            const reasons = await BlockedEntity.getUserBlockingReasons(user.username, user.email, ipAddress);
            logger.warn('Blocked user attempted access', { 
                userId: user.id, 
                username: user.username, 
                ipAddress, 
                reasons 
            });
            
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied - account or IP is blocked',
                reasons: reasons.map(r => ({ type: r.type, reason: r.reason }))
            });
        }

        req.user = user;
        next();
    } catch (error) {
        logger.error('Authentication error', { error: error.message });
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired' 
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: 'Authentication failed' 
        });
    }
};

// Middleware for admin authentication
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin access token required' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if it's an admin token
        if (!decoded.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: 'Admin access required' 
            });
        }

        req.admin = {
            username: decoded.username,
            isAdmin: true
        };
        
        next();
    } catch (error) {
        logger.error('Admin authentication error', { error: error.message });
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid admin token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin token expired' 
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: 'Admin authentication failed' 
        });
    }
};

// Middleware to check if user can perform transactions
const checkTransactionPermission = async (req, res, next) => {
    try {
        const user = req.user;
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Check if user is blocked
        if (user.is_blocked) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is blocked - transactions not allowed' 
            });
        }

        // Check if IP is blocked
        const isIPBlocked = await BlockedEntity.isBlocked('ip', ipAddress);
        if (isIPBlocked) {
            logger.warn('Blocked IP attempted transaction', { 
                userId: user.id, 
                username: user.username, 
                ipAddress 
            });
            
            return res.status(403).json({ 
                success: false, 
                message: 'IP address is blocked - transactions not allowed' 
            });
        }

        next();
    } catch (error) {
        logger.error('Transaction permission check error', { error: error.message });
        return res.status(500).json({ 
            success: false, 
            message: 'Permission check failed' 
        });
    }
};

module.exports = {
    authenticateToken,
    authenticateAdmin,
    checkTransactionPermission
};