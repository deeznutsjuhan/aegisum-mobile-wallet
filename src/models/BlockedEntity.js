const db = require('../database/connection');
const logger = require('../utils/logger');

class BlockedEntity {
    static async create(entityData) {
        const { type, value, reason, blockedBy } = entityData;
        
        try {
            // Check if entity is already blocked
            const existing = await this.findByTypeAndValue(type, value);
            if (existing) {
                throw new Error(`${type} '${value}' is already blocked`);
            }

            // Insert blocked entity
            const result = await db.run(
                'INSERT INTO blocked_entities (type, value, reason, blocked_by) VALUES (?, ?, ?, ?)',
                [type, value, reason, blockedBy]
            );

            logger.info('Entity blocked successfully', { 
                id: result.id, 
                type, 
                value, 
                reason, 
                blockedBy 
            });
            
            return result.id;
        } catch (error) {
            logger.error('Error blocking entity', { 
                error: error.message, 
                type, 
                value, 
                reason 
            });
            throw error;
        }
    }

    static async findById(id) {
        try {
            return await db.get('SELECT * FROM blocked_entities WHERE id = ?', [id]);
        } catch (error) {
            logger.error('Error finding blocked entity by ID', { error: error.message, id });
            throw error;
        }
    }

    static async findByTypeAndValue(type, value) {
        try {
            return await db.get(
                'SELECT * FROM blocked_entities WHERE type = ? AND value = ?',
                [type, value]
            );
        } catch (error) {
            logger.error('Error finding blocked entity by type and value', { 
                error: error.message, 
                type, 
                value 
            });
            throw error;
        }
    }

    static async isBlocked(type, value) {
        try {
            const entity = await this.findByTypeAndValue(type, value);
            return entity !== undefined;
        } catch (error) {
            logger.error('Error checking if entity is blocked', { 
                error: error.message, 
                type, 
                value 
            });
            return false; // Default to not blocked on error
        }
    }

    static async remove(id) {
        try {
            const entity = await this.findById(id);
            if (!entity) {
                throw new Error('Blocked entity not found');
            }

            await db.run('DELETE FROM blocked_entities WHERE id = ?', [id]);

            logger.info('Entity unblocked successfully', { 
                id, 
                type: entity.type, 
                value: entity.value 
            });
        } catch (error) {
            logger.error('Error unblocking entity', { error: error.message, id });
            throw error;
        }
    }

    static async removeByTypeAndValue(type, value) {
        try {
            const entity = await this.findByTypeAndValue(type, value);
            if (!entity) {
                throw new Error(`${type} '${value}' is not blocked`);
            }

            await db.run(
                'DELETE FROM blocked_entities WHERE type = ? AND value = ?',
                [type, value]
            );

            logger.info('Entity unblocked successfully', { type, value });
        } catch (error) {
            logger.error('Error unblocking entity by type and value', { 
                error: error.message, 
                type, 
                value 
            });
            throw error;
        }
    }

    static async getAll(limit = 50, offset = 0) {
        try {
            const entities = await db.all(
                'SELECT * FROM blocked_entities ORDER BY created_at DESC LIMIT ? OFFSET ?',
                [limit, offset]
            );

            const total = await db.get('SELECT COUNT(*) as count FROM blocked_entities');
            
            return {
                entities,
                total: total.count,
                limit,
                offset
            };
        } catch (error) {
            logger.error('Error getting all blocked entities', { error: error.message });
            throw error;
        }
    }

    static async getByType(type, limit = 50, offset = 0) {
        try {
            const entities = await db.all(
                'SELECT * FROM blocked_entities WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
                [type, limit, offset]
            );

            const total = await db.get(
                'SELECT COUNT(*) as count FROM blocked_entities WHERE type = ?',
                [type]
            );
            
            return {
                entities,
                total: total.count,
                limit,
                offset,
                type
            };
        } catch (error) {
            logger.error('Error getting blocked entities by type', { 
                error: error.message, 
                type 
            });
            throw error;
        }
    }

    static async search(query, limit = 50, offset = 0) {
        try {
            const searchPattern = `%${query}%`;
            const entities = await db.all(
                `SELECT * FROM blocked_entities 
                 WHERE value LIKE ? OR reason LIKE ? OR blocked_by LIKE ?
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [searchPattern, searchPattern, searchPattern, limit, offset]
            );

            const total = await db.get(
                `SELECT COUNT(*) as count FROM blocked_entities 
                 WHERE value LIKE ? OR reason LIKE ? OR blocked_by LIKE ?`,
                [searchPattern, searchPattern, searchPattern]
            );
            
            return {
                entities,
                total: total.count,
                limit,
                offset,
                query
            };
        } catch (error) {
            logger.error('Error searching blocked entities', { 
                error: error.message, 
                query 
            });
            throw error;
        }
    }

    static async getStats() {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_blocked,
                    COUNT(CASE WHEN type = 'username' THEN 1 END) as blocked_usernames,
                    COUNT(CASE WHEN type = 'email' THEN 1 END) as blocked_emails,
                    COUNT(CASE WHEN type = 'ip' THEN 1 END) as blocked_ips,
                    COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as blocked_this_week
                FROM blocked_entities
            `);

            return stats;
        } catch (error) {
            logger.error('Error getting blocked entity stats', { error: error.message });
            throw error;
        }
    }

    // Check if user is blocked by any criteria
    static async isUserBlocked(username, email, ipAddress) {
        try {
            const blockedCount = await db.get(`
                SELECT COUNT(*) as count FROM blocked_entities 
                WHERE (type = 'username' AND value = ?) 
                   OR (type = 'email' AND value = ?) 
                   OR (type = 'ip' AND value = ?)
            `, [username, email, ipAddress]);

            return blockedCount.count > 0;
        } catch (error) {
            logger.error('Error checking if user is blocked', { 
                error: error.message, 
                username, 
                email, 
                ipAddress 
            });
            return false; // Default to not blocked on error
        }
    }

    // Get blocking reasons for a user
    static async getUserBlockingReasons(username, email, ipAddress) {
        try {
            const reasons = await db.all(`
                SELECT type, value, reason, created_at FROM blocked_entities 
                WHERE (type = 'username' AND value = ?) 
                   OR (type = 'email' AND value = ?) 
                   OR (type = 'ip' AND value = ?)
                ORDER BY created_at DESC
            `, [username, email, ipAddress]);

            return reasons;
        } catch (error) {
            logger.error('Error getting user blocking reasons', { 
                error: error.message, 
                username, 
                email, 
                ipAddress 
            });
            return [];
        }
    }
}

module.exports = BlockedEntity;