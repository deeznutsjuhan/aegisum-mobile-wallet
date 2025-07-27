const User = require('../models/User');
const Wallet = require('../models/Wallet');
const BlockedEntity = require('../models/BlockedEntity');
const db = require('../database/connection');
const CryptoUtils = require('../utils/crypto');
const { validate, schemas } = require('../utils/validation');
const logger = require('../utils/logger');
require('dotenv').config();

class AdminController {
    // Admin login
    static async login(req, res) {
        try {
            const validatedData = validate(schemas.adminLogin, req.body);
            const { username, password, twoFactorCode } = validatedData;

            // Check admin credentials
            const adminUsername = process.env.ADMIN_USERNAME;
            const adminPassword = process.env.ADMIN_PASSWORD;
            const admin2FASecret = process.env.ADMIN_2FA_SECRET;

            if (username !== adminUsername) {
                throw new Error('Invalid admin credentials');
            }

            const isValidPassword = await CryptoUtils.comparePassword(password, adminPassword);
            if (!isValidPassword) {
                throw new Error('Invalid admin credentials');
            }

            // Verify 2FA if provided
            if (admin2FASecret && twoFactorCode) {
                const is2FAValid = CryptoUtils.verify2FA(twoFactorCode, admin2FASecret);
                if (!is2FAValid) {
                    throw new Error('Invalid 2FA code');
                }
            }

            // Generate admin JWT token
            const token = CryptoUtils.generateToken({
                username: adminUsername,
                isAdmin: true
            });

            logger.info('Admin logged in successfully', { 
                username: adminUsername,
                ip: req.clientIP 
            });

            res.json({
                success: true,
                message: 'Admin login successful',
                data: {
                    username: adminUsername,
                    token,
                    requires2FA: !!admin2FASecret
                }
            });
        } catch (error) {
            logger.error('Admin login failed', { 
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

    // Generate 2FA secret for admin
    static async generate2FA(req, res) {
        try {
            const adminUsername = process.env.ADMIN_USERNAME;
            const secret = CryptoUtils.generate2FASecret(adminUsername);
            const qrCode = await CryptoUtils.generateQRCode(secret);

            res.json({
                success: true,
                data: {
                    secret: secret.base32,
                    qrCode,
                    manualEntryKey: secret.base32,
                    issuer: 'Aegisum Wallet Admin'
                }
            });
        } catch (error) {
            logger.error('2FA generation failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to generate 2FA secret'
            });
        }
    }

    // Get dashboard statistics
    static async getDashboardStats(req, res) {
        try {
            const [userStats, walletStats, blockedStats, transactionStats] = await Promise.all([
                User.getUserStats(),
                Wallet.getWalletStats(),
                BlockedEntity.getStats(),
                this.getTransactionStats()
            ]);

            res.json({
                success: true,
                data: {
                    users: userStats,
                    wallets: walletStats,
                    blocked: blockedStats,
                    transactions: transactionStats
                }
            });
        } catch (error) {
            logger.error('Get dashboard stats failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to get dashboard statistics'
            });
        }
    }

    // Get transaction statistics
    static async getTransactionStats() {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_transactions,
                    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_transactions,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
                    COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as transactions_24h,
                    SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) as total_volume
                FROM transaction_logs
            `);

            return stats;
        } catch (error) {
            logger.error('Error getting transaction stats', { error: error.message });
            return {
                total_transactions: 0,
                confirmed_transactions: 0,
                pending_transactions: 0,
                failed_transactions: 0,
                transactions_24h: 0,
                total_volume: 0
            };
        }
    }

    // Get all users with pagination
    static async getUsers(req, res) {
        try {
            const { limit = 50, offset = 0, search } = req.query;

            let result;
            if (search) {
                result = await User.searchUsers(search, parseInt(limit), parseInt(offset));
            } else {
                result = await User.getAllUsers(parseInt(limit), parseInt(offset));
            }

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('Get users failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to get users'
            });
        }
    }

    // Get user details with wallets and activity
    static async getUserDetails(req, res) {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const [wallets, transactions, ipActivity] = await Promise.all([
                Wallet.getWalletsByUser(userId, true),
                db.all(
                    'SELECT * FROM transaction_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
                    [userId]
                ),
                db.all(
                    'SELECT DISTINCT ip_address, COUNT(*) as count, MAX(created_at) as last_seen FROM ip_tracking WHERE user_id = ? GROUP BY ip_address ORDER BY last_seen DESC',
                    [userId]
                )
            ]);

            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        isBlocked: user.is_blocked,
                        createdAt: user.created_at,
                        lastLogin: user.last_login,
                        loginAttempts: user.login_attempts,
                        lockedUntil: user.locked_until
                    },
                    wallets,
                    recentTransactions: transactions,
                    ipActivity
                }
            });
        } catch (error) {
            logger.error('Get user details failed', { 
                error: error.message, 
                userId: req.params.userId 
            });

            res.status(500).json({
                success: false,
                message: 'Failed to get user details'
            });
        }
    }

    // Block/unblock user
    static async toggleUserBlock(req, res) {
        try {
            const { userId } = req.params;
            const { action, reason } = req.body; // action: 'block' or 'unblock'

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (action === 'block') {
                await User.blockUser(userId, reason);
                logger.info('User blocked by admin', { 
                    userId, 
                    username: user.username, 
                    reason,
                    adminUsername: req.admin.username 
                });
            } else if (action === 'unblock') {
                await User.unblockUser(userId);
                logger.info('User unblocked by admin', { 
                    userId, 
                    username: user.username,
                    adminUsername: req.admin.username 
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action. Use "block" or "unblock"'
                });
            }

            res.json({
                success: true,
                message: `User ${action}ed successfully`
            });
        } catch (error) {
            logger.error('Toggle user block failed', { 
                error: error.message, 
                userId: req.params.userId 
            });

            res.status(500).json({
                success: false,
                message: `Failed to ${req.body.action} user`
            });
        }
    }

    // Block entity (username, email, or IP)
    static async blockEntity(req, res) {
        try {
            const validatedData = validate(schemas.blockUser, req.body);
            const { type, value, reason } = validatedData;

            const entityId = await BlockedEntity.create({
                type,
                value,
                reason,
                blockedBy: req.admin.username
            });

            logger.info('Entity blocked by admin', { 
                entityId, 
                type, 
                value, 
                reason,
                adminUsername: req.admin.username 
            });

            res.json({
                success: true,
                message: `${type} blocked successfully`,
                data: { entityId, type, value }
            });
        } catch (error) {
            logger.error('Block entity failed', { 
                error: error.message, 
                body: req.body 
            });

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Unblock entity
    static async unblockEntity(req, res) {
        try {
            const { entityId } = req.params;

            await BlockedEntity.remove(entityId);

            logger.info('Entity unblocked by admin', { 
                entityId,
                adminUsername: req.admin.username 
            });

            res.json({
                success: true,
                message: 'Entity unblocked successfully'
            });
        } catch (error) {
            logger.error('Unblock entity failed', { 
                error: error.message, 
                entityId: req.params.entityId 
            });

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get blocked entities
    static async getBlockedEntities(req, res) {
        try {
            const { limit = 50, offset = 0, type, search } = req.query;

            let result;
            if (search) {
                result = await BlockedEntity.search(search, parseInt(limit), parseInt(offset));
            } else if (type) {
                result = await BlockedEntity.getByType(type, parseInt(limit), parseInt(offset));
            } else {
                result = await BlockedEntity.getAll(parseInt(limit), parseInt(offset));
            }

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('Get blocked entities failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to get blocked entities'
            });
        }
    }

    // Update fee settings
    static async updateFeeSettings(req, res) {
        try {
            const validatedData = validate(schemas.feeSettings, req.body);
            const { type, amount, address } = validatedData;

            // Update fee settings in database
            await Promise.all([
                db.run(
                    'UPDATE admin_settings SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                    [type, req.admin.username, 'withdrawal_fee_type']
                ),
                db.run(
                    'UPDATE admin_settings SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                    [amount.toString(), req.admin.username, 'withdrawal_fee_amount']
                ),
                db.run(
                    'UPDATE admin_settings SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                    [address, req.admin.username, 'fee_address']
                )
            ]);

            logger.info('Fee settings updated by admin', { 
                type, 
                amount, 
                address,
                adminUsername: req.admin.username 
            });

            res.json({
                success: true,
                message: 'Fee settings updated successfully',
                data: { type, amount, address }
            });
        } catch (error) {
            logger.error('Update fee settings failed', { 
                error: error.message, 
                body: req.body 
            });

            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get current fee settings
    static async getFeeSettings(req, res) {
        try {
            const settings = await db.all(
                'SELECT key, value, updated_by, updated_at FROM admin_settings WHERE key IN (?, ?, ?)',
                ['withdrawal_fee_type', 'withdrawal_fee_amount', 'fee_address']
            );

            const feeSettings = {};
            settings.forEach(setting => {
                if (setting.key === 'withdrawal_fee_type') {
                    feeSettings.type = setting.value;
                    feeSettings.typeUpdatedBy = setting.updated_by;
                    feeSettings.typeUpdatedAt = setting.updated_at;
                } else if (setting.key === 'withdrawal_fee_amount') {
                    feeSettings.amount = setting.value;
                    feeSettings.amountUpdatedBy = setting.updated_by;
                    feeSettings.amountUpdatedAt = setting.updated_at;
                } else if (setting.key === 'fee_address') {
                    feeSettings.address = setting.value;
                    feeSettings.addressUpdatedBy = setting.updated_by;
                    feeSettings.addressUpdatedAt = setting.updated_at;
                }
            });

            res.json({
                success: true,
                data: feeSettings
            });
        } catch (error) {
            logger.error('Get fee settings failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to get fee settings'
            });
        }
    }

    // Get transaction logs
    static async getTransactionLogs(req, res) {
        try {
            const { limit = 50, offset = 0, status, userId, search } = req.query;

            let query = `
                SELECT tl.*, u.username, w.label as wallet_label
                FROM transaction_logs tl
                LEFT JOIN users u ON tl.user_id = u.id
                LEFT JOIN wallets w ON tl.wallet_address = w.address
                WHERE 1=1
            `;
            const params = [];

            if (status) {
                query += ' AND tl.status = ?';
                params.push(status);
            }

            if (userId) {
                query += ' AND tl.user_id = ?';
                params.push(userId);
            }

            if (search) {
                query += ' AND (tl.txid LIKE ? OR tl.wallet_address LIKE ? OR u.username LIKE ?)';
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            query += ' ORDER BY tl.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const transactions = await db.all(query, params);

            // Get total count
            let countQuery = 'SELECT COUNT(*) as count FROM transaction_logs tl LEFT JOIN users u ON tl.user_id = u.id WHERE 1=1';
            const countParams = [];

            if (status) {
                countQuery += ' AND tl.status = ?';
                countParams.push(status);
            }

            if (userId) {
                countQuery += ' AND tl.user_id = ?';
                countParams.push(userId);
            }

            if (search) {
                countQuery += ' AND (tl.txid LIKE ? OR tl.wallet_address LIKE ? OR u.username LIKE ?)';
                const searchPattern = `%${search}%`;
                countParams.push(searchPattern, searchPattern, searchPattern);
            }

            const total = await db.get(countQuery, countParams);

            res.json({
                success: true,
                data: {
                    transactions,
                    total: total.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        } catch (error) {
            logger.error('Get transaction logs failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to get transaction logs'
            });
        }
    }

    // Get suspicious activity
    static async getSuspiciousActivity(req, res) {
        try {
            const { limit = 50, offset = 0 } = req.query;

            // Get IPs with multiple users
            const suspiciousIPs = await db.all(`
                SELECT 
                    ip_address,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(*) as total_requests,
                    GROUP_CONCAT(DISTINCT username) as usernames,
                    MAX(created_at) as last_activity
                FROM ip_tracking 
                WHERE user_id IS NOT NULL
                GROUP BY ip_address 
                HAVING unique_users >= 3
                ORDER BY unique_users DESC, last_activity DESC
                LIMIT ? OFFSET ?
            `, [parseInt(limit), parseInt(offset)]);

            // Get users with multiple IPs
            const suspiciousUsers = await db.all(`
                SELECT 
                    user_id,
                    username,
                    COUNT(DISTINCT ip_address) as unique_ips,
                    COUNT(*) as total_requests,
                    GROUP_CONCAT(DISTINCT ip_address) as ip_addresses,
                    MAX(created_at) as last_activity
                FROM ip_tracking 
                WHERE user_id IS NOT NULL
                GROUP BY user_id, username
                HAVING unique_ips >= 5
                ORDER BY unique_ips DESC, last_activity DESC
                LIMIT ? OFFSET ?
            `, [parseInt(limit), parseInt(offset)]);

            res.json({
                success: true,
                data: {
                    suspiciousIPs,
                    suspiciousUsers
                }
            });
        } catch (error) {
            logger.error('Get suspicious activity failed', { error: error.message });

            res.status(500).json({
                success: false,
                message: 'Failed to get suspicious activity'
            });
        }
    }
}

module.exports = AdminController;