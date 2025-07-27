const Joi = require('joi');

const schemas = {
    // User registration
    userRegistration: Joi.object({
        username: Joi.string().alphanum().min(3).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
            .messages({
                'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
            })
    }),

    // User login
    userLogin: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    }),

    // Wallet creation
    walletCreation: Joi.object({
        email: Joi.string().email().required(),
        address: Joi.string().required(),
        label: Joi.string().max(100).optional()
    }),

    // Transaction broadcast
    transactionBroadcast: Joi.object({
        rawTransaction: Joi.string().required(),
        walletAddress: Joi.string().required()
    }),

    // Admin login
    adminLogin: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
        twoFactorCode: Joi.string().length(6).pattern(/^[0-9]+$/).optional()
    }),

    // Fee settings
    feeSettings: Joi.object({
        type: Joi.string().valid('flat', 'percentage').required(),
        amount: Joi.number().positive().required(),
        address: Joi.string().required()
    }),

    // Block user
    blockUser: Joi.object({
        type: Joi.string().valid('username', 'email', 'ip').required(),
        value: Joi.string().required(),
        reason: Joi.string().max(500).optional()
    })
};

const validate = (schema, data) => {
    const { error, value } = schema.validate(data);
    if (error) {
        throw new Error(error.details[0].message);
    }
    return value;
};

module.exports = {
    schemas,
    validate
};