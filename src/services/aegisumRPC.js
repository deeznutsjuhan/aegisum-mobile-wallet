const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class AegisumRPC {
    constructor() {
        this.host = process.env.AEGISUM_RPC_HOST || '127.0.0.1';
        this.port = process.env.AEGISUM_RPC_PORT || '39940';
        this.username = process.env.AEGISUM_RPC_USER;
        this.password = process.env.AEGISUM_RPC_PASSWORD;
        this.wallet = process.env.AEGISUM_RPC_WALLET || 'wallet.dat';
        
        this.baseURL = `http://${this.host}:${this.port}`;
        this.auth = {
            username: this.username,
            password: this.password
        };
    }

    async call(method, params = []) {
        try {
            const response = await axios.post(this.baseURL, {
                jsonrpc: '2.0',
                id: Date.now(),
                method: method,
                params: params
            }, {
                auth: this.auth,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data.error) {
                throw new Error(`RPC Error: ${response.data.error.message}`);
            }

            logger.info(`RPC call successful: ${method}`, { method, params });
            return response.data.result;
        } catch (error) {
            logger.error(`RPC call failed: ${method}`, { 
                method, 
                params, 
                error: error.message 
            });
            throw error;
        }
    }

    // Blockchain information methods
    async getBlockchainInfo() {
        return await this.call('getblockchaininfo');
    }

    async getBlockCount() {
        return await this.call('getblockcount');
    }

    async getBestBlockHash() {
        return await this.call('getbestblockhash');
    }

    async getBlock(blockhash, verbosity = 1) {
        return await this.call('getblock', [blockhash, verbosity]);
    }

    async getDifficulty() {
        return await this.call('getdifficulty');
    }

    // Wallet methods
    async getBalance(account = '', minconf = 1, includeWatchonly = false) {
        return await this.call('getbalance', [account, minconf, includeWatchonly]);
    }

    async getNewAddress(label = '', addressType = 'bech32') {
        return await this.call('getnewaddress', [label, addressType]);
    }

    async validateAddress(address) {
        return await this.call('validateaddress', [address]);
    }

    async getAddressInfo(address) {
        return await this.call('getaddressinfo', [address]);
    }

    async getReceivedByAddress(address, minconf = 1) {
        return await this.call('getreceivedbyaddress', [address, minconf]);
    }

    // Transaction methods
    async getTransaction(txid, includeWatchonly = false, verbose = false) {
        return await this.call('gettransaction', [txid, includeWatchonly, verbose]);
    }

    async getRawTransaction(txid, verbose = false, blockhash = null) {
        const params = [txid, verbose];
        if (blockhash) params.push(blockhash);
        return await this.call('getrawtransaction', params);
    }

    async sendRawTransaction(hexstring, maxfeerate = null) {
        const params = [hexstring];
        if (maxfeerate !== null) params.push(maxfeerate);
        return await this.call('sendrawtransaction', params);
    }

    async decodeRawTransaction(hexstring, iswitness = null) {
        const params = [hexstring];
        if (iswitness !== null) params.push(iswitness);
        return await this.call('decoderawtransaction', params);
    }

    async testMempoolAccept(rawtxs, maxfeerate = null) {
        const params = [rawtxs];
        if (maxfeerate !== null) params.push(maxfeerate);
        return await this.call('testmempoolaccept', params);
    }

    // List transactions
    async listTransactions(label = '*', count = 10, skip = 0, includeWatchonly = false) {
        return await this.call('listtransactions', [label, count, skip, includeWatchonly]);
    }

    async listSinceBlock(blockhash = null, targetConfirmations = 1, includeWatchonly = false, includeRemoved = true) {
        const params = [];
        if (blockhash) params.push(blockhash);
        params.push(targetConfirmations, includeWatchonly, includeRemoved);
        return await this.call('listsinceblock', params);
    }

    // UTXO methods
    async listUnspent(minconf = 1, maxconf = 9999999, addresses = [], includeUnsafe = true, queryOptions = {}) {
        return await this.call('listunspent', [minconf, maxconf, addresses, includeUnsafe, queryOptions]);
    }

    async getTxOut(txid, n, includeMempool = true) {
        return await this.call('gettxout', [txid, n, includeMempool]);
    }

    // Fee estimation
    async estimateSmartFee(confTarget, estimateMode = 'CONSERVATIVE') {
        return await this.call('estimatesmartfee', [confTarget, estimateMode]);
    }

    // Network methods
    async getNetworkInfo() {
        return await this.call('getnetworkinfo');
    }

    async getPeerInfo() {
        return await this.call('getpeerinfo');
    }

    async getConnectionCount() {
        return await this.call('getconnectioncount');
    }

    // Mempool methods
    async getMempoolInfo() {
        return await this.call('getmempoolinfo');
    }

    async getRawMempool(verbose = false, mempoolSequence = false) {
        return await this.call('getrawmempool', [verbose, mempoolSequence]);
    }

    // Wallet info
    async getWalletInfo() {
        return await this.call('getwalletinfo');
    }

    async listWallets() {
        return await this.call('listwallets');
    }

    // Address management
    async importAddress(address, label = '', rescan = true, p2sh = false) {
        return await this.call('importaddress', [address, label, rescan, p2sh]);
    }

    async setLabel(address, label) {
        return await this.call('setlabel', [address, label]);
    }

    // Utility methods
    async ping() {
        try {
            await this.call('ping');
            return true;
        } catch (error) {
            return false;
        }
    }

    async getUptime() {
        return await this.call('uptime');
    }

    // Health check
    async healthCheck() {
        try {
            const [blockchainInfo, networkInfo, walletInfo] = await Promise.all([
                this.getBlockchainInfo(),
                this.getNetworkInfo(),
                this.getWalletInfo()
            ]);

            return {
                status: 'healthy',
                blockchain: {
                    chain: blockchainInfo.chain,
                    blocks: blockchainInfo.blocks,
                    headers: blockchainInfo.headers,
                    verificationProgress: blockchainInfo.verificationprogress
                },
                network: {
                    version: networkInfo.version,
                    subversion: networkInfo.subversion,
                    connections: networkInfo.connections
                },
                wallet: {
                    walletname: walletInfo.walletname,
                    balance: walletInfo.balance,
                    txcount: walletInfo.txcount
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = new AegisumRPC();