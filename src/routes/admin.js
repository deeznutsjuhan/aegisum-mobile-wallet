const express = require('express');
const AdminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/auth');
const { adminRateLimit, trackIP, sanitizeInput } = require('../middleware/security');

const router = express.Router();

// Apply middleware to all routes
router.use(trackIP);
router.use(sanitizeInput);
router.use(adminRateLimit);

// Public admin routes
router.post('/login', AdminController.login);
router.get('/2fa/generate', AdminController.generate2FA);

// Protected admin routes
router.use(authenticateAdmin);

// Dashboard
router.get('/dashboard/stats', AdminController.getDashboardStats);

// User management
router.get('/users', AdminController.getUsers);
router.get('/users/:userId', AdminController.getUserDetails);
router.post('/users/:userId/toggle-block', AdminController.toggleUserBlock);

// Entity blocking
router.post('/block', AdminController.blockEntity);
router.delete('/block/:entityId', AdminController.unblockEntity);
router.get('/blocked', AdminController.getBlockedEntities);

// Fee management
router.get('/fee-settings', AdminController.getFeeSettings);
router.put('/fee-settings', AdminController.updateFeeSettings);

// Transaction monitoring
router.get('/transactions', AdminController.getTransactionLogs);

// Security monitoring
router.get('/suspicious-activity', AdminController.getSuspiciousActivity);

module.exports = router;