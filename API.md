# Aegisum Mobile Wallet Backend API Documentation

## Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this format:

```json
{
  "success": true|false,
  "message": "Response message",
  "data": {
    // Response data
  }
}
```

## Error Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Transactions: 10 requests per minute
- Admin: 50 requests per 15 minutes

## Endpoints

### System Endpoints

#### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "message": "Aegisum Mobile Wallet Backend is running",
  "data": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0",
    "rpc": {
      "status": "healthy",
      "blockchain": {
        "chain": "main",
        "blocks": 123456,
        "headers": 123456
      }
    }
  }
}
```

#### API Information
```http
GET /api/info
```

#### Blockchain Information
```http
GET /api/blockchain/info
```

---

### Authentication Endpoints

#### User Registration
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### User Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "lastLogin": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get User Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastLogin": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer <token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

---

### Wallet Management Endpoints

#### Create Wallet
```http
POST /api/wallet
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "wallet@example.com",
  "address": "aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "label": "My Main Wallet"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet created successfully",
  "data": {
    "walletId": 1,
    "address": "aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "email": "wallet@example.com",
    "label": "My Main Wallet"
  }
}
```

#### Get User Wallets
```http
GET /api/wallet
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wallets": [
      {
        "id": 1,
        "address": "aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        "email": "wallet@example.com",
        "label": "My Main Wallet",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Get Wallet Balance
```http
GET /api/wallet/:address/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "balance": "10.50000000",
    "confirmed": "10.50000000"
  }
}
```

#### Get Transaction History
```http
GET /api/wallet/:address/transactions?limit=50&skip=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "transactions": [
      {
        "txid": "abc123...",
        "amount": 5.0,
        "confirmations": 6,
        "time": 1640995200,
        "category": "receive",
        "fee": 0,
        "blockhash": "def456...",
        "blockindex": 1,
        "blocktime": 1640995200
      }
    ]
  }
}
```

#### Get Transaction Details
```http
GET /api/wallet/transaction/:txid
Authorization: Bearer <token>
```

#### Update Wallet Label
```http
PUT /api/wallet/:address/label
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "label": "Updated Wallet Name"
}
```

#### Deactivate Wallet
```http
DELETE /api/wallet/:address
Authorization: Bearer <token>
```

#### Validate Address
```http
GET /api/wallet/validate/:address
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "isValid": true,
    "type": "witness_v0_keyhash",
    "scriptType": "witness_v0_keyhash"
  }
}
```

---

### Transaction Endpoints

#### Broadcast Transaction
```http
POST /api/transaction/broadcast
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "rawTransaction": "0200000001abc123...",
  "walletAddress": "aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction broadcasted successfully",
  "data": {
    "txid": "def456...",
    "amount": 5.0,
    "fee": 1.0,
    "feeSettings": {
      "type": "flat",
      "amount": "1.0",
      "address": "aegs1fee..."
    }
  }
}
```

#### Get Fee Settings
```http
GET /api/transaction/fee-settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feeType": "flat",
    "feeAmount": "1.0",
    "feeAddress": "aegs1fee..."
  }
}
```

#### Estimate Fee
```http
GET /api/transaction/estimate-fee?confTarget=3&estimateMode=CONSERVATIVE
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "networkFee": {
      "feeRate": 0.00001,
      "blocks": 3
    },
    "additionalFee": {
      "type": "flat",
      "amount": "1.0",
      "address": "aegs1fee..."
    }
  }
}
```

#### Get Transaction Status
```http
GET /api/transaction/:txid/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txid": "abc123...",
    "status": "confirmed",
    "confirmations": 6,
    "amount": 5.0,
    "fee": 0.0001,
    "time": 1640995200,
    "blocktime": 1640995200,
    "blockhash": "def456..."
  }
}
```

#### Get User Transaction History
```http
GET /api/transaction/history?limit=50&offset=0&status=confirmed
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "txid": "abc123...",
        "type": "send",
        "amount": 5.0,
        "fee": 1.0,
        "status": "confirmed",
        "walletAddress": "aegs1...",
        "walletLabel": "My Wallet",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Admin Endpoints

#### Admin Login
```http
POST /api/admin/login
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin_password",
  "twoFactorCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "username": "admin",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "requires2FA": true
  }
}
```

#### Generate 2FA Secret
```http
GET /api/admin/2fa/generate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "manualEntryKey": "JBSWY3DPEHPK3PXP",
    "issuer": "Aegisum Wallet Admin"
  }
}
```

#### Dashboard Statistics
```http
GET /api/admin/dashboard/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total_users": 100,
      "blocked_users": 5,
      "active_users": 80,
      "new_users_week": 10
    },
    "wallets": {
      "total_wallets": 150,
      "active_wallets": 140,
      "new_wallets_week": 15,
      "unique_users": 95
    },
    "blocked": {
      "total_blocked": 8,
      "blocked_usernames": 3,
      "blocked_emails": 2,
      "blocked_ips": 3,
      "blocked_this_week": 2
    },
    "transactions": {
      "total_transactions": 500,
      "confirmed_transactions": 480,
      "pending_transactions": 15,
      "failed_transactions": 5,
      "transactions_24h": 25,
      "total_volume": 1000.5
    }
  }
}
```

#### Get Users
```http
GET /api/admin/users?limit=50&offset=0&search=john
Authorization: Bearer <admin-token>
```

#### Get User Details
```http
GET /api/admin/users/:userId
Authorization: Bearer <admin-token>
```

#### Block/Unblock User
```http
POST /api/admin/users/:userId/toggle-block
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "action": "block",
  "reason": "Suspicious activity detected"
}
```

#### Block Entity
```http
POST /api/admin/block
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "type": "ip",
  "value": "192.168.1.100",
  "reason": "Multiple account creation attempts"
}
```

#### Unblock Entity
```http
DELETE /api/admin/block/:entityId
Authorization: Bearer <admin-token>
```

#### Get Blocked Entities
```http
GET /api/admin/blocked?limit=50&offset=0&type=ip&search=192.168
Authorization: Bearer <admin-token>
```

#### Update Fee Settings
```http
PUT /api/admin/fee-settings
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "type": "percentage",
  "amount": 2.5,
  "address": "aegs1fee..."
}
```

#### Get Fee Settings
```http
GET /api/admin/fee-settings
Authorization: Bearer <admin-token>
```

#### Get Transaction Logs
```http
GET /api/admin/transactions?limit=50&offset=0&status=confirmed&userId=1&search=abc123
Authorization: Bearer <admin-token>
```

#### Get Suspicious Activity
```http
GET /api/admin/suspicious-activity?limit=50&offset=0
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suspiciousIPs": [
      {
        "ip_address": "192.168.1.100",
        "unique_users": 5,
        "total_requests": 100,
        "usernames": "user1,user2,user3,user4,user5",
        "last_activity": "2024-01-01T00:00:00.000Z"
      }
    ],
    "suspiciousUsers": [
      {
        "user_id": 1,
        "username": "suspicious_user",
        "unique_ips": 10,
        "total_requests": 200,
        "ip_addresses": "192.168.1.1,192.168.1.2,...",
        "last_activity": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

## Error Responses

### Validation Error
```json
{
  "success": false,
  "message": "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
}
```

### Authentication Error
```json
{
  "success": false,
  "message": "Invalid token"
}
```

### Rate Limit Error
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later"
}
```

### Blocked User Error
```json
{
  "success": false,
  "message": "Access denied - account or IP is blocked",
  "reasons": [
    {
      "type": "ip",
      "reason": "Multiple account creation attempts"
    }
  ]
}
```

---

## SDK Examples

### JavaScript/Node.js

```javascript
class AegisumWalletAPI {
  constructor(baseURL, token = null) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    this.token = data.data.token;
    return data;
  }

  async createWallet(email, address, label) {
    return this.request('/wallet', {
      method: 'POST',
      body: JSON.stringify({ email, address, label })
    });
  }

  async getBalance(address) {
    return this.request(`/wallet/${address}/balance`);
  }

  async broadcastTransaction(rawTransaction, walletAddress) {
    return this.request('/transaction/broadcast', {
      method: 'POST',
      body: JSON.stringify({ rawTransaction, walletAddress })
    });
  }
}

// Usage
const api = new AegisumWalletAPI('https://your-domain.com/api');

try {
  await api.login('username', 'password');
  const balance = await api.getBalance('aegs1...');
  console.log('Balance:', balance.data.balance);
} catch (error) {
  console.error('API Error:', error.message);
}
```

### Python

```python
import requests
import json

class AegisumWalletAPI:
    def __init__(self, base_url, token=None):
        self.base_url = base_url
        self.token = token
        self.session = requests.Session()
    
    def request(self, endpoint, method='GET', data=None):
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        response = self.session.request(
            method=method,
            url=url,
            headers=headers,
            data=json.dumps(data) if data else None
        )
        
        result = response.json()
        
        if not response.ok:
            raise Exception(result.get('message', 'Request failed'))
        
        return result
    
    def login(self, username, password):
        data = self.request('/auth/login', 'POST', {
            'username': username,
            'password': password
        })
        self.token = data['data']['token']
        return data
    
    def get_balance(self, address):
        return self.request(f'/wallet/{address}/balance')

# Usage
api = AegisumWalletAPI('https://your-domain.com/api')

try:
    api.login('username', 'password')
    balance = api.get_balance('aegs1...')
    print(f"Balance: {balance['data']['balance']}")
except Exception as e:
    print(f"API Error: {e}")
```

---

## Webhooks (Future Enhancement)

The API is designed to support webhooks for real-time notifications:

- Transaction confirmations
- New user registrations
- Suspicious activity alerts
- System health notifications

---

## Testing

Use the provided test endpoints to verify your integration:

```bash
# Health check
curl https://your-domain.com/api/health

# API info
curl https://your-domain.com/api/info

# Test authentication
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

---

## Support

For API support:
- GitHub Issues: https://github.com/Marko666nilson/Aegisum-Mobile-wallet/issues
- Documentation: https://github.com/Marko666nilson/Aegisum-Mobile-wallet/wiki
- Email: support@aegisum.co.za (if available)