const express = require('express');
const TransactionController = require('../controllers/transactionController');
const { authenticateToken, checkTransactionPermission } = require('../middleware/auth');
const { transactionRateLimit, trackIP, sanitizeInput } = require('../middleware/security');

const router = express.Router();

// Apply middleware to all routes
router.use(trackIP);
router.use(sanitizeInput);
router.use(authenticateToken);

// Public transaction routes (with authentication)
router.get('/fee-settings', TransactionController.getCurrentFeeSettings);
router.get('/estimate-fee', TransactionController.estimateFee);

// Transaction history
router.get('/history', TransactionController.getUserTransactionHistory);
router.get('/:txid/status', TransactionController.getTransactionStatus);

// Transaction broadcast (with additional permission check and rate limiting)
router.post('/broadcast', 
    transactionRateLimit, 
    checkTransactionPermission, 
    TransactionController.broadcastTransaction
);

module.exports = router;