const express = require('express');
const aegisumRPC = require('../services/aegisumRPC');
const logger = require('../utils/logger');

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const rpcHealth = await aegisumRPC.healthCheck();
        
        res.json({
            success: true,
            message: 'Aegisum Mobile Wallet Backend is running',
            data: {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                rpc: rpcHealth
            }
        });
    } catch (error) {
        logger.error('Health check failed', { error: error.message });
        
        res.status(503).json({
            success: false,
            message: 'Service unhealthy',
            data: {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                error: error.message
            }
        });
    }
});

// API info endpoint
router.get('/info', (req, res) => {
    res.json({
        success: true,
        data: {
            name: 'Aegisum Mobile Wallet Backend',
            version: '1.0.0',
            description: 'Backend API for Aegisum Mobile Wallet Application',
            endpoints: {
                auth: '/api/auth',
                wallet: '/api/wallet',
                transaction: '/api/transaction',
                admin: '/api/admin'
            },
            documentation: 'https://github.com/Marko666nilson/Aegisum-Mobile-wallet'
        }
    });
});

// Blockchain info endpoint
router.get('/blockchain/info', async (req, res) => {
    try {
        const [blockchainInfo, networkInfo] = await Promise.all([
            aegisumRPC.getBlockchainInfo(),
            aegisumRPC.getNetworkInfo()
        ]);

        res.json({
            success: true,
            data: {
                blockchain: {
                    chain: blockchainInfo.chain,
                    blocks: blockchainInfo.blocks,
                    headers: blockchainInfo.headers,
                    bestblockhash: blockchainInfo.bestblockhash,
                    difficulty: blockchainInfo.difficulty,
                    verificationprogress: blockchainInfo.verificationprogress
                },
                network: {
                    version: networkInfo.version,
                    subversion: networkInfo.subversion,
                    protocolversion: networkInfo.protocolversion,
                    connections: networkInfo.connections,
                    networkactive: networkInfo.networkactive
                }
            }
        });
    } catch (error) {
        logger.error('Blockchain info failed', { error: error.message });
        
        res.status(500).json({
            success: false,
            message: 'Failed to get blockchain information'
        });
    }
});

module.exports = router;