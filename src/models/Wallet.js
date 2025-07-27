const db = require('../database/connection');
const logger = require('../utils/logger');

class Wallet {
    static async create(walletData) {
        const { userId, email, address, label } = walletData;
        
        try {
            // Check if address already exists
            const existingWallet = await this.findByAddress(address);
            if (existingWallet) {
                throw new Error('Wallet with this address already exists');
            }

            // Check max wallets per user
            const maxWallets = parseInt(process.env.MAX_WALLETS_PER_USER) || 5;
            const userWallets = await this.findByUserId(userId);
            if (userWallets.length >= maxWallets) {
                throw new Error(`Maximum ${maxWallets} wallets allowed per user`);
            }

            // Insert wallet
            const result = await db.run(
                'INSERT INTO wallets (user_id, email, address, label) VALUES (?, ?, ?, ?)',
                [userId, email, address, label]
            );

            logger.info('Wallet created successfully', { 
                walletId: result.id, 
                userId, 
                address, 
                email 
            });
            
            return result.id;
        } catch (error) {
            logger.error('Error creating wallet', { 
                error: error.message, 
                userId, 
                address, 
                email 
            });
            throw error;
        }
    }

    static async findById(id) {
        try {
            return await db.get('SELECT * FROM wallets WHERE id = ?', [id]);
        } catch (error) {
            logger.error('Error finding wallet by ID', { error: error.message, id });
            throw error;
        }
    }

    static async findByAddress(address) {
        try {
            return await db.get('SELECT * FROM wallets WHERE address = ?', [address]);
        } catch (error) {
            logger.error('Error finding wallet by address', { error: error.message, address });
            throw error;
        }
    }

    static async findByUserId(userId) {
        try {
            return await db.all(
                'SELECT * FROM wallets WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC',
                [userId]
            );
        } catch (error) {
            logger.error('Error finding wallets by user ID', { error: error.message, userId });
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            return await db.all(
                'SELECT * FROM wallets WHERE email = ? AND is_active = TRUE ORDER BY created_at DESC',
                [email]
            );
        } catch (error) {
            logger.error('Error finding wallets by email', { error: error.message, email });
            throw error;
        }
    }

    static async updateLabel(id, label) {
        try {
            await db.run(
                'UPDATE wallets SET label = ? WHERE id = ?',
                [label, id]
            );

            logger.info('Wallet label updated', { walletId: id, label });
        } catch (error) {
            logger.error('Error updating wallet label', { error: error.message, id, label });
            throw error;
        }
    }

    static async deactivate(id) {
        try {
            await db.run(
                'UPDATE wallets SET is_active = FALSE WHERE id = ?',
                [id]
            );

            logger.info('Wallet deactivated', { walletId: id });
        } catch (error) {
            logger.error('Error deactivating wallet', { error: error.message, id });
            throw error;
        }
    }

    static async activate(id) {
        try {
            await db.run(
                'UPDATE wallets SET is_active = TRUE WHERE id = ?',
                [id]
            );

            logger.info('Wallet activated', { walletId: id });
        } catch (error) {
            logger.error('Error activating wallet', { error: error.message, id });
            throw error;
        }
    }

    static async getAllWallets(limit = 50, offset = 0) {
        try {
            const wallets = await db.all(`
                SELECT w.*, u.username, u.email as user_email
                FROM wallets w
                JOIN users u ON w.user_id = u.id
                ORDER BY w.created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);

            const total = await db.get('SELECT COUNT(*) as count FROM wallets');
            
            return {
                wallets,
                total: total.count,
                limit,
                offset
            };
        } catch (error) {
            logger.error('Error getting all wallets', { error: error.message });
            throw error;
        }
    }

    static async searchWallets(query, limit = 50, offset = 0) {
        try {
            const searchPattern = `%${query}%`;
            const wallets = await db.all(`
                SELECT w.*, u.username, u.email as user_email
                FROM wallets w
                JOIN users u ON w.user_id = u.id
                WHERE w.address LIKE ? OR w.email LIKE ? OR w.label LIKE ? OR u.username LIKE ?
                ORDER BY w.created_at DESC
                LIMIT ? OFFSET ?
            `, [searchPattern, searchPattern, searchPattern, searchPattern, limit, offset]);

            const total = await db.get(`
                SELECT COUNT(*) as count 
                FROM wallets w
                JOIN users u ON w.user_id = u.id
                WHERE w.address LIKE ? OR w.email LIKE ? OR w.label LIKE ? OR u.username LIKE ?
            `, [searchPattern, searchPattern, searchPattern, searchPattern]);
            
            return {
                wallets,
                total: total.count,
                limit,
                offset,
                query
            };
        } catch (error) {
            logger.error('Error searching wallets', { error: error.message, query });
            throw error;
        }
    }

    static async getWalletStats() {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_wallets,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_wallets,
                    COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as new_wallets_week,
                    COUNT(DISTINCT user_id) as unique_users
                FROM wallets
            `);

            return stats;
        } catch (error) {
            logger.error('Error getting wallet stats', { error: error.message });
            throw error;
        }
    }

    static async getWalletsByUser(userId, includeInactive = false) {
        try {
            let query = 'SELECT * FROM wallets WHERE user_id = ?';
            const params = [userId];

            if (!includeInactive) {
                query += ' AND is_active = TRUE';
            }

            query += ' ORDER BY created_at DESC';

            return await db.all(query, params);
        } catch (error) {
            logger.error('Error getting wallets by user', { error: error.message, userId });
            throw error;
        }
    }

    static async validateOwnership(walletAddress, userId) {
        try {
            const wallet = await db.get(
                'SELECT * FROM wallets WHERE address = ? AND user_id = ? AND is_active = TRUE',
                [walletAddress, userId]
            );

            return wallet !== undefined;
        } catch (error) {
            logger.error('Error validating wallet ownership', { 
                error: error.message, 
                walletAddress, 
                userId 
            });
            throw error;
        }
    }
}

module.exports = Wallet;