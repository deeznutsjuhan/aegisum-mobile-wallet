const express = require('express');
const app = express();

app.use(express.json());

// Mock RPC responses
app.post('/', (req, res) => {
    const { method } = req.body;
    
    switch (method) {
        case 'getblockchaininfo':
            res.json({
                result: {
                    chain: "main",
                    blocks: 43977,
                    headers: 43977,
                    bestblockhash: "b3a9c5e1fd5c973432c16270182029f87f922ddffedfa3c22fe598a807be7976",
                    difficulty: 77274.23101835193,
                    verificationprogress: 1.0
                },
                error: null,
                id: req.body.id
            });
            break;
            
        case 'getnetworkinfo':
            res.json({
                result: {
                    version: 210300,
                    subversion: "/AegisumCore:0.21.3/",
                    protocolversion: 70024,
                    connections: 5,
                    networkactive: true
                },
                error: null,
                id: req.body.id
            });
            break;
            
        case 'getbalance':
            res.json({
                result: 100.50000000,
                error: null,
                id: req.body.id
            });
            break;
            
        default:
            res.json({
                result: null,
                error: { code: -32601, message: "Method not found" },
                id: req.body.id
            });
    }
});

app.listen(39940, '127.0.0.1', () => {
    console.log('Mock Aegisum RPC server running on port 39940');
});