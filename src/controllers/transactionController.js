const aegisumRPC = require('../services/aegisumRPC');
const Wallet = require('../models/Wallet');
const db = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const logger = require('../utils/logger');

class TransactionController {
    // Broadcast a signed transaction
    static async broadcastTransaction(req, res) {
        try {
            const validatedData = validate(schemas.transactionBroadcast, req.body);
            const { rawTransaction, walletAddress } = validatedData;
            const userId = req.user.id;

            // Verify wallet ownership
            const isOwner = await Wallet.validateOwnership(walletAddress, userId);
            if (!isOwner) {
                return res.status(403).json({
                    success: false,
                    message: 'Wallet not found or access denied'
                });
            }

            // Decode transaction to get details
            const decodedTx = await aegisumRPC.decodeRawTransaction(rawTransaction);
            
            // Test transaction in mempool first
            const testResult = await aegisumRPC.testMempoolAccept([rawTransaction]);
            if (!testResult[0].allowed) {
                return res.status(400).json({
                    success: false,
                    message: `Transaction rejected: ${testResult[0]['reject-reason']}`
                });
            }

            // Calculate total output amount and fee
            let totalOutput = 0;
            for (const vout of decodedTx.vout) {
                totalOutput += vout.value;
            }

            // Get fee settings
            const feeSettings = await this.getFeeSettings();
            let additionalFee = 0;

            if (feeSettings.type === 'flat') {
                additionalFee = parseFloat(feeSettings.amount);
            } else if (feeSettings.type === 'percentage') {
                additionalFee = totalOutput * (parseFloat(feeSettings.amount) / 100);
            }

            // Log transaction attempt
            await db.run(`
                INSERT INTO transaction_logs 
                (user_id, wallet_address, txid, type, amount, fee, status, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId,
                walletAddress,
                decodedTx.txid,
                'send',
                totalOutput,
                additionalFee,
                'pending',
                req.clientIP,
                req.userAgent
            ]);

            // Broadcast transaction
            const txid = await aegisumRPC.sendRawTransaction(rawTransaction);

            // Update transaction log
            await db.run(
                'UPDATE transaction_logs SET status = ?, txid = ? WHERE txid = ? AND user_id = ?',
                ['confirmed', txid, decodedTx.txid, userId]
            );

            logger.info('Transaction broadcasted successfully', {
                txid,
                userId,
                walletAddress,
                amount: totalOutput,
                fee: additionalFee,
                ip: req.clientIP
            });

            res.json({
                success: true,
                message: 'Transaction broadcasted successfully',
                data: {
                    txid,
                    amount: totalOutput,
                    fee: additionalFee,
                    feeSettings: {
                        type: feeSettings.type,
                        amount: feeSettings.amount,
                        address: feeSettings.address
                    }
                }
            });
        } catch (error) {
            logger.error('Transaction broadcast failed', {
                error: error.message,
                userId: req.user?.id,
                walletAddress: req.body.walletAddress,
                ip: req.clientIP
            });

            // Update transaction log with error
            if (req.body.rawTransaction) {
                try {
                    const decodedTx = await aegisumRPC.decodeRawTransaction(req.body.rawTransaction);
                    await db.run(
                        'UPDATE transaction_logs SET status = ? WHERE txid = ? AND user_id = ?',
                        ['failed', decodedTx.txid, req.user.id]
                    );
                } catch (logError) {
                    // Ignore logging errors
                }
            }

            if (error.message.includes('insufficient fee')) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction fee too low'
                });
            }

            if (error.message.includes('dust')) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction output too small (dust)'
                });
            }

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get fee settings
    static async getFeeSettings() {
        try {
            const settings = await db.all(
                'SELECT key, value FROM admin_settings WHERE key IN (?, ?, ?)',
                ['withdrawal_fee_type', 'withdrawal_fee_amount', 'fee_address']
            );

            const feeSettings = {};
            settings.forEach(setting => {
                if (setting.key === 'withdrawal_fee_type') {
                    feeSettings.type = setting.value;
                } else if (setting.key === 'withdrawal_fee_amount') {
                    feeSettings.amount = setting.value;
                } else if (setting.key === 'fee_address') {
                    feeSettings.address = setting.value;
                }
            });

            return feeSettings;
        } catch (error) {
            logger.error('Error getting fee settings', { error: error.message });
            // Return default settings
            return {
                type: 'flat',
                amount: '1.0',
                address: ''
            };
        }
    }

    // Get current fee settings (public endpoint)
    static async getCurrentFeeSettings(req, res) {
        try {
            const feeSettings = await this.getFeeSettings();

            res.json({
                success: true,
                data: {
                    feeType: feeSettings.type,
                    feeAmount: feeSettings.amount,
                    feeAddress: feeSettings.address
                }
            });
        } catch (error) {
            logger.error('Get fee settings failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to get fee settings'
            });
        }
    }

    // Estimate transaction fee
    static async estimateFee(req, res) {
        try {
            const { confTarget = 3, estimateMode = 'CONSERVATIVE' } = req.query;

            const feeEstimate = await aegisumRPC.estimateSmartFee(
                parseInt(confTarget),
                estimateMode
            );

            // Get additional fee settings
            const additionalFeeSettings = await this.getFeeSettings();

            res.json({
                success: true,
                data: {
                    networkFee: {
                        feeRate: feeEstimate.feerate || null,
                        blocks: feeEstimate.blocks || null
                    },
                    additionalFee: {
                        type: additionalFeeSettings.type,
                        amount: additionalFeeSettings.amount,
                        address: additionalFeeSettings.address
                    }
                }
            });
        } catch (error) {
            logger.error('Fee estimation failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to estimate fee'
            });
        }
    }

    // Get transaction status
    static async getTransactionStatus(req, res) {
        try {
            const { txid } = req.params;
            const userId = req.user.id;

            // Check if user has access to this transaction
            const transactionLog = await db.get(
                'SELECT * FROM transaction_logs WHERE txid = ? AND user_id = ?',
                [txid, userId]
            );

            if (!transactionLog) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            try {
                // Get transaction details from blockchain
                const transaction = await aegisumRPC.getTransaction(txid);

                res.json({
                    success: true,
                    data: {
                        txid,
                        status: transaction.confirmations > 0 ? 'confirmed' : 'pending',
                        confirmations: transaction.confirmations,
                        amount: transaction.amount,
                        fee: transaction.fee || 0,
                        time: transaction.time,
                        blocktime: transaction.blocktime,
                        blockhash: transaction.blockhash
                    }
                });
            } catch (rpcError) {
                // Transaction might not be in wallet, return log status
                res.json({
                    success: true,
                    data: {
                        txid,
                        status: transactionLog.status,
                        amount: transactionLog.amount,
                        fee: transactionLog.fee,
                        createdAt: transactionLog.created_at
                    }
                });
            }
        } catch (error) {
            logger.error('Get transaction status failed', {
                error: error.message,
                txid: req.params.txid,
                userId: req.user?.id
            });

            res.status(500).json({
                success: false,
                message: 'Failed to get transaction status'
            });
        }
    }

    // Get user's transaction history
    static async getUserTransactionHistory(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 50, offset = 0, status } = req.query;

            let query = `
                SELECT tl.*, w.address as wallet_address, w.label as wallet_label
                FROM transaction_logs tl
                LEFT JOIN wallets w ON tl.wallet_address = w.address
                WHERE tl.user_id = ?
            `;
            const params = [userId];

            if (status) {
                query += ' AND tl.status = ?';
                params.push(status);
            }

            query += ' ORDER BY tl.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const transactions = await db.all(query, params);

            const total = await db.get(
                'SELECT COUNT(*) as count FROM transaction_logs WHERE user_id = ?',
                [userId]
            );

            res.json({
                success: true,
                data: {
                    transactions: transactions.map(tx => ({
                        txid: tx.txid,
                        type: tx.type,
                        amount: tx.amount,
                        fee: tx.fee,
                        status: tx.status,
                        walletAddress: tx.wallet_address,
                        walletLabel: tx.wallet_label,
                        createdAt: tx.created_at
                    })),
                    total: total.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        } catch (error) {
            logger.error('Get user transaction history failed', {
                error: error.message,
                userId: req.user?.id
            });

            res.status(500).json({
                success: false,
                message: 'Failed to get transaction history'
            });
        }
    }
}

module.exports = TransactionController;