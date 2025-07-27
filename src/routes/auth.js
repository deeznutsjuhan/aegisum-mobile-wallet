const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { authRateLimit, trackIP, sanitizeInput } = require('../middleware/security');

const router = express.Router();

// Apply middleware to all routes
router.use(trackIP);
router.use(sanitizeInput);

// Public routes with rate limiting
router.post('/register', authRateLimit, AuthController.register);
router.post('/login', authRateLimit, AuthController.login);

// Protected routes
router.get('/profile', authenticateToken, AuthController.getProfile);
router.post('/refresh', authenticateToken, AuthController.refreshToken);
router.post('/logout', authenticateToken, AuthController.logout);

module.exports = router;