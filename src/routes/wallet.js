const express = require('express');
const WalletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/auth');
const { apiRateLimit, trackIP, sanitizeInput } = require('../middleware/security');

const router = express.Router();

// Apply middleware to all routes
router.use(trackIP);
router.use(sanitizeInput);
router.use(apiRateLimit);
router.use(authenticateToken);

// Wallet management routes
router.post('/', WalletController.createWallet);
router.get('/', WalletController.getUserWallets);
router.get('/:address/balance', WalletController.getBalance);
router.get('/:address/transactions', WalletController.getTransactionHistory);
router.get('/transaction/:txid', WalletController.getTransaction);
router.put('/:address/label', WalletController.updateWalletLabel);
router.delete('/:address', WalletController.deactivateWallet);

// Utility routes
router.get('/validate/:address', WalletController.validateAddress);

module.exports = router;