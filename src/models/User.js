const db = require('../database/connection');
const CryptoUtils = require('../utils/crypto');
const logger = require('../utils/logger');

class User {
    static async create(userData) {
        const { username, email, password } = userData;
        
        try {
            // Check if user already exists
            const existingUser = await this.findByUsernameOrEmail(username, email);
            if (existingUser) {
                throw new Error('User with this username or email already exists');
            }

            // Hash password
            const passwordHash = await CryptoUtils.hashPassword(password);

            // Insert user
            const result = await db.run(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                [username, email, passwordHash]
            );

            logger.info('User created successfully', { userId: result.id, username, email });
            return result.id;
        } catch (error) {
            logger.error('Error creating user', { error: error.message, username, email });
            throw error;
        }
    }

    static async findById(id) {
        try {
            return await db.get('SELECT * FROM users WHERE id = ?', [id]);
        } catch (error) {
            logger.error('Error finding user by ID', { error: error.message, id });
            throw error;
        }
    }

    static async findByUsername(username) {
        try {
            return await db.get('SELECT * FROM users WHERE username = ?', [username]);
        } catch (error) {
            logger.error('Error finding user by username', { error: error.message, username });
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            return await db.get('SELECT * FROM users WHERE email = ?', [email]);
        } catch (error) {
            logger.error('Error finding user by email', { error: error.message, email });
            throw error;
        }
    }

    static async findByUsernameOrEmail(username, email) {
        try {
            return await db.get(
                'SELECT * FROM users WHERE username = ? OR email = ?',
                [username, email]
            );
        } catch (error) {
            logger.error('Error finding user by username or email', { 
                error: error.message, 
                username, 
                email 
            });
            throw error;
        }
    }

    static async authenticate(username, password) {
        try {
            const user = await this.findByUsername(username);
            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Check if user is blocked
            if (user.is_blocked) {
                throw new Error('Account is blocked');
            }

            // Check if account is locked
            if (user.locked_until && new Date() < new Date(user.locked_until)) {
                throw new Error('Account is temporarily locked');
            }

            // Verify password
            const isValid = await CryptoUtils.comparePassword(password, user.password_hash);
            if (!isValid) {
                // Increment login attempts
                await this.incrementLoginAttempts(user.id);
                throw new Error('Invalid credentials');
            }

            // Reset login attempts and update last login
            await this.resetLoginAttempts(user.id);
            await this.updateLastLogin(user.id);

            logger.info('User authenticated successfully', { userId: user.id, username });
            return user;
        } catch (error) {
            logger.error('Authentication failed', { error: error.message, username });
            throw error;
        }
    }

    static async incrementLoginAttempts(userId) {
        try {
            const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
            const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 900000; // 15 minutes

            const user = await this.findById(userId);
            const newAttempts = (user.login_attempts || 0) + 1;
            
            let lockedUntil = null;
            if (newAttempts >= maxAttempts) {
                lockedUntil = new Date(Date.now() + lockoutTime).toISOString();
            }

            await db.run(
                'UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?',
                [newAttempts, lockedUntil, userId]
            );

            logger.warn('Login attempt incremented', { userId, attempts: newAttempts, lockedUntil });
        } catch (error) {
            logger.error('Error incrementing login attempts', { error: error.message, userId });
            throw error;
        }
    }

    static async resetLoginAttempts(userId) {
        try {
            await db.run(
                'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?',
                [userId]
            );
        } catch (error) {
            logger.error('Error resetting login attempts', { error: error.message, userId });
            throw error;
        }
    }

    static async updateLastLogin(userId) {
        try {
            await db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [userId]
            );
        } catch (error) {
            logger.error('Error updating last login', { error: error.message, userId });
            throw error;
        }
    }

    static async blockUser(userId, reason = null) {
        try {
            await db.run(
                'UPDATE users SET is_blocked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [userId]
            );

            logger.info('User blocked', { userId, reason });
        } catch (error) {
            logger.error('Error blocking user', { error: error.message, userId });
            throw error;
        }
    }

    static async unblockUser(userId) {
        try {
            await db.run(
                'UPDATE users SET is_blocked = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [userId]
            );

            logger.info('User unblocked', { userId });
        } catch (error) {
            logger.error('Error unblocking user', { error: error.message, userId });
            throw error;
        }
    }

    static async getAllUsers(limit = 50, offset = 0) {
        try {
            const users = await db.all(
                `SELECT id, username, email, is_blocked, created_at, last_login, 
                        login_attempts, locked_until
                 FROM users 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            const total = await db.get('SELECT COUNT(*) as count FROM users');
            
            return {
                users,
                total: total.count,
                limit,
                offset
            };
        } catch (error) {
            logger.error('Error getting all users', { error: error.message });
            throw error;
        }
    }

    static async searchUsers(query, limit = 50, offset = 0) {
        try {
            const searchPattern = `%${query}%`;
            const users = await db.all(
                `SELECT id, username, email, is_blocked, created_at, last_login, 
                        login_attempts, locked_until
                 FROM users 
                 WHERE username LIKE ? OR email LIKE ?
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [searchPattern, searchPattern, limit, offset]
            );

            const total = await db.get(
                'SELECT COUNT(*) as count FROM users WHERE username LIKE ? OR email LIKE ?',
                [searchPattern, searchPattern]
            );
            
            return {
                users,
                total: total.count,
                limit,
                offset,
                query
            };
        } catch (error) {
            logger.error('Error searching users', { error: error.message, query });
            throw error;
        }
    }

    static async getUserStats() {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN is_blocked = 1 THEN 1 END) as blocked_users,
                    COUNT(CASE WHEN last_login > datetime('now', '-30 days') THEN 1 END) as active_users,
                    COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as new_users_week
                FROM users
            `);

            return stats;
        } catch (error) {
            logger.error('Error getting user stats', { error: error.message });
            throw error;
        }
    }
}

module.exports = User;