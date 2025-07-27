const Wallet = require('../models/Wallet');
const aegisumRPC = require('../services/aegisumRPC');
const { validate, schemas } = require('../utils/validation');
const logger = require('../utils/logger');

class WalletController {
    // Create a new wallet
    static async createWallet(req, res) {
        try {
            const validatedData = validate(schemas.walletCreation, req.body);
            const userId = req.user.id;

            // Validate the address with Aegisum RPC
            const addressValidation = await aegisumRPC.validateAddress(validatedData.address);
            if (!addressValidation.isvalid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Aegisum address'
                });
            }

            const walletData = {
                userId,
                email: validatedData.email,
                address: validatedData.address,
                label: validatedData.label || 'My Wallet'
            };

            const walletId = await Wallet.create(walletData);

            logger.info('Wallet created successfully', { 
                walletId, 
                userId, 
                address: validatedData.address,
                ip: req.clientIP 
            });

            res.status(201).json({
                success: true,
                message: 'Wallet created successfully',
                data: {
                    walletId,
                    address: validatedData.address,
                    email: validatedData.email,
                    label: validatedData.label
                }
            });
        } catch (error) {
            logger.error('Wallet creation failed', { 
                error: error.message, 
                userId: req.user?.id,
                body: req.body,
                ip: req.clientIP 
            });

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get user's wallets
    static async getUserWallets(req, res) {
        try {
            const userId = req.user.id;
            const wallets = await Wallet.findByUserId(userId);

            res.json({
                success: true,
                data: {
                    wallets: wallets.map(wallet => ({
                        id: wallet.id,
                        address: wallet.address,
                        email: wallet.email,
                        label: wallet.label,
                        isActive: wallet.is_active,
                        createdAt: wallet.created_at
                    }))
                }
            });
        } catch (error) {
            logger.error('Get user wallets failed', { 
                error: error.message, 
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to get wallets'
            });
        }
    }

    // Get wallet balance
    static async getBalance(req, res) {
        try {
            const { address } = req.params;
            const userId = req.user.id;

            // Verify wallet ownership
            const isOwner = await Wallet.validateOwnership(address, userId);
            if (!isOwner) {
                return res.status(403).json({
                    success: false,
                    message: 'Wallet not found or access denied'
                });
            }

            // Get balance from Aegisum RPC
            const balance = await aegisumRPC.getReceivedByAddress(address);

            res.json({
                success: true,
                data: {
                    address,
                    balance: balance.toString(),
                    confirmed: balance.toString() // For now, treating all as confirmed
                }
            });
        } catch (error) {
            logger.error('Get balance failed', { 
                error: error.message, 
                address: req.params.address,
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to get balance'
            });
        }
    }

    // Get transaction history
    static async getTransactionHistory(req, res) {
        try {
            const { address } = req.params;
            const userId = req.user.id;
            const { limit = 50, skip = 0 } = req.query;

            // Verify wallet ownership
            const isOwner = await Wallet.validateOwnership(address, userId);
            if (!isOwner) {
                return res.status(403).json({
                    success: false,
                    message: 'Wallet not found or access denied'
                });
            }

            // Get transactions from Aegisum RPC
            const transactions = await aegisumRPC.listTransactions('*', parseInt(limit), parseInt(skip));

            // Filter transactions for this address
            const addressTransactions = transactions.filter(tx => 
                tx.address === address || 
                (tx.details && tx.details.some(detail => detail.address === address))
            );

            res.json({
                success: true,
                data: {
                    address,
                    transactions: addressTransactions.map(tx => ({
                        txid: tx.txid,
                        amount: tx.amount,
                        confirmations: tx.confirmations,
                        time: tx.time,
                        category: tx.category,
                        fee: tx.fee || 0,
                        blockhash: tx.blockhash,
                        blockindex: tx.blockindex,
                        blocktime: tx.blocktime
                    }))
                }
            });
        } catch (error) {
            logger.error('Get transaction history failed', { 
                error: error.message, 
                address: req.params.address,
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to get transaction history'
            });
        }
    }

    // Get transaction details
    static async getTransaction(req, res) {
        try {
            const { txid } = req.params;
            const userId = req.user.id;

            // Get transaction from Aegisum RPC
            const transaction = await aegisumRPC.getTransaction(txid, false, true);

            // Check if user has any wallet involved in this transaction
            const userWallets = await Wallet.findByUserId(userId);
            const userAddresses = userWallets.map(w => w.address);
            
            let hasAccess = false;
            if (transaction.details) {
                hasAccess = transaction.details.some(detail => 
                    userAddresses.includes(detail.address)
                );
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Transaction not found or access denied'
                });
            }

            res.json({
                success: true,
                data: {
                    txid: transaction.txid,
                    amount: transaction.amount,
                    fee: transaction.fee || 0,
                    confirmations: transaction.confirmations,
                    time: transaction.time,
                    blocktime: transaction.blocktime,
                    blockhash: transaction.blockhash,
                    blockindex: transaction.blockindex,
                    details: transaction.details,
                    hex: transaction.hex
                }
            });
        } catch (error) {
            logger.error('Get transaction failed', { 
                error: error.message, 
                txid: req.params.txid,
                userId: req.user?.id 
            });

            if (error.message.includes('Invalid or non-wallet transaction id')) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to get transaction'
            });
        }
    }

    // Update wallet label
    static async updateWalletLabel(req, res) {
        try {
            const { address } = req.params;
            const { label } = req.body;
            const userId = req.user.id;

            if (!label || label.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Label is required'
                });
            }

            // Find wallet and verify ownership
            const wallet = await Wallet.findByAddress(address);
            if (!wallet || wallet.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Wallet not found or access denied'
                });
            }

            await Wallet.updateLabel(wallet.id, label.trim());

            logger.info('Wallet label updated', { 
                walletId: wallet.id, 
                address, 
                label: label.trim(),
                userId 
            });

            res.json({
                success: true,
                message: 'Wallet label updated successfully',
                data: {
                    address,
                    label: label.trim()
                }
            });
        } catch (error) {
            logger.error('Update wallet label failed', { 
                error: error.message, 
                address: req.params.address,
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to update wallet label'
            });
        }
    }

    // Deactivate wallet
    static async deactivateWallet(req, res) {
        try {
            const { address } = req.params;
            const userId = req.user.id;

            // Find wallet and verify ownership
            const wallet = await Wallet.findByAddress(address);
            if (!wallet || wallet.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Wallet not found or access denied'
                });
            }

            await Wallet.deactivate(wallet.id);

            logger.info('Wallet deactivated', { 
                walletId: wallet.id, 
                address, 
                userId 
            });

            res.json({
                success: true,
                message: 'Wallet deactivated successfully'
            });
        } catch (error) {
            logger.error('Deactivate wallet failed', { 
                error: error.message, 
                address: req.params.address,
                userId: req.user?.id 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to deactivate wallet'
            });
        }
    }

    // Validate address
    static async validateAddress(req, res) {
        try {
            const { address } = req.params;

            const validation = await aegisumRPC.validateAddress(address);

            res.json({
                success: true,
                data: {
                    address,
                    isValid: validation.isvalid,
                    type: validation.type || null,
                    scriptType: validation.script_type || null
                }
            });
        } catch (error) {
            logger.error('Address validation failed', { 
                error: error.message, 
                address: req.params.address 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to validate address'
            });
        }
    }
}

module.exports = WalletController;