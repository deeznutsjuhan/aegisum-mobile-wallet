const User = require('../models/User');
const CryptoUtils = require('../utils/crypto');
const { validate, schemas } = require('../utils/validation');
const logger = require('../utils/logger');

class AuthController {
    // User registration
    static async register(req, res) {
        try {
            const validatedData = validate(schemas.userRegistration, req.body);
            
            const userId = await User.create(validatedData);
            
            // Generate JWT token
            const token = CryptoUtils.generateToken({
                userId: userId,
                username: validatedData.username
            });

            logger.info('User registered successfully', { 
                userId, 
                username: validatedData.username,
                ip: req.clientIP 
            });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    userId,
                    username: validatedData.username,
                    email: validatedData.email,
                    token
                }
            });
        } catch (error) {
            logger.error('Registration failed', { 
                error: error.message, 
                body: req.body,
                ip: req.clientIP 
            });

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // User login
    static async login(req, res) {
        try {
            const validatedData = validate(schemas.userLogin, req.body);
            
            const user = await User.authenticate(validatedData.username, validatedData.password);
            
            // Generate JWT token
            const token = CryptoUtils.generateToken({
                userId: user.id,
                username: user.username
            });

            logger.info('User logged in successfully', { 
                userId: user.id, 
                username: user.username,
                ip: req.clientIP 
            });

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    userId: user.id,
                    username: user.username,
                    email: user.email,
                    token,
                    lastLogin: user.last_login
                }
            });
        } catch (error) {
            logger.error('Login failed', { 
                error: error.message, 
                username: req.body.username,
                ip: req.clientIP 
            });

            res.status(401).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get current user profile
    static async getProfile(req, res) {
        try {
            const user = req.user;

            res.json({
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    createdAt: user.created_at,
                    lastLogin: user.last_login
                }
            });
        } catch (error) {
            logger.error('Get profile failed', { 
                error: error.message, 
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to get profile'
            });
        }
    }

    // Refresh token
    static async refreshToken(req, res) {
        try {
            const user = req.user;
            
            // Generate new JWT token
            const token = CryptoUtils.generateToken({
                userId: user.id,
                username: user.username
            });

            logger.info('Token refreshed', { 
                userId: user.id, 
                username: user.username 
            });

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    token
                }
            });
        } catch (error) {
            logger.error('Token refresh failed', { 
                error: error.message, 
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to refresh token'
            });
        }
    }

    // Logout (client-side token invalidation)
    static async logout(req, res) {
        try {
            logger.info('User logged out', { 
                userId: req.user.id, 
                username: req.user.username,
                ip: req.clientIP 
            });

            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            logger.error('Logout failed', { 
                error: error.message, 
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    }
}

module.exports = AuthController;