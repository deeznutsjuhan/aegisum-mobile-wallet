# Aegisum Mobile Wallet Backend

A comprehensive backend API for the Aegisum blockchain mobile wallet application, built with Node.js and Express.js.

## Features

### 🔐 User Account Management
- User registration and authentication with JWT tokens
- Multiple wallets per user, each linked to different email addresses
- Secure login with rate limiting and account lockout protection
- User blocking/unblocking by username, email, or IP address

### ⛓️ Blockchain Integration
- Full integration with Aegisum RPC commands (Litecoin-compatible)
- Balance checking and transaction history retrieval
- Transaction broadcasting with validation
- Address validation and wallet management

### 💰 Transaction Fee Management
- Configurable withdrawal fees (flat amount or percentage)
- Admin-controlled fee settings with collection address
- Real-time fee calculation and display

### 🛡️ Security & Abuse Prevention
- IP address tracking and suspicious activity detection
- Rate limiting on all endpoints
- Input sanitization and validation
- Comprehensive logging and monitoring
- Non-custodial design (no private key storage)

### 📊 Admin Dashboard
- Web-based admin interface with 2FA support
- User management and blocking controls
- Transaction monitoring and fee configuration
- Security analytics and suspicious activity detection
- Real-time statistics and reporting

## Architecture

```
├── src/
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Authentication, security, validation
│   ├── models/         # Database models
│   ├── routes/         # API route definitions
│   ├── services/       # External service integrations (RPC)
│   ├── utils/          # Utility functions
│   └── database/       # Database schema and connection
├── public/             # Static files for admin dashboard
└── logs/              # Application logs
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Wallet Management
- `POST /api/wallet` - Create new wallet
- `GET /api/wallet` - Get user's wallets
- `GET /api/wallet/:address/balance` - Get wallet balance
- `GET /api/wallet/:address/transactions` - Get transaction history
- `PUT /api/wallet/:address/label` - Update wallet label
- `DELETE /api/wallet/:address` - Deactivate wallet

### Transactions
- `POST /api/transaction/broadcast` - Broadcast signed transaction
- `GET /api/transaction/fee-settings` - Get current fee settings
- `GET /api/transaction/estimate-fee` - Estimate transaction fee
- `GET /api/transaction/history` - Get user transaction history
- `GET /api/transaction/:txid/status` - Get transaction status

### Admin Panel
- `POST /api/admin/login` - Admin login with 2FA
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/users` - User management
- `POST /api/admin/block` - Block entities
- `PUT /api/admin/fee-settings` - Update fee settings
- `GET /api/admin/transactions` - Transaction monitoring
- `GET /api/admin/suspicious-activity` - Security analytics

## Installation & Deployment

### Prerequisites
- Ubuntu 18.04+ server
- Node.js 18.x or higher
- Aegisum Core node with RPC enabled
- Git

### Quick Setup

1. **Run the automated setup script:**
```bash
curl -fsSL https://raw.githubusercontent.com/Marko666nilson/Aegisum-Mobile-wallet/main/setup.sh | bash
```

2. **Manual setup:**
```bash
# Create user
sudo useradd -m -s /bin/bash aegisum_backend
sudo usermod -aG sudo aegisum_backend

# Switch to user
sudo su - aegisum_backend

# Clone repository
git clone https://github.com/Marko666nilson/Aegisum-Mobile-wallet.git
cd Aegisum-Mobile-wallet

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Edit configuration

# Run database migration
npm run migrate

# Start with PM2
npm install -g pm2
cp ecosystem.config.js.example ecosystem.config.js
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Configuration

Edit the `.env` file with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Aegisum RPC Configuration
AEGISUM_RPC_HOST=127.0.0.1
AEGISUM_RPC_PORT=39940
AEGISUM_RPC_USER=your-rpc-username
AEGISUM_RPC_PASSWORD=your-rpc-password

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password
ADMIN_2FA_SECRET=your-2fa-secret-key

# Fee Configuration
DEFAULT_WITHDRAWAL_FEE_TYPE=flat
DEFAULT_WITHDRAWAL_FEE_AMOUNT=1.0
FEE_ADDRESS=your-fee-collection-address
```

### Aegisum Node Configuration

Add to your `aegisum.conf`:

```conf
# RPC Configuration
server=1
rpcuser=your-rpc-username
rpcpassword=your-rpc-password
rpcallowip=127.0.0.1
rpcport=39940

# Wallet Configuration
wallet=wallet.dat
```

### Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Features

### Authentication & Authorization
- JWT-based authentication with configurable expiration
- Rate limiting on authentication endpoints
- Account lockout after failed login attempts
- Admin 2FA support with TOTP

### Input Validation & Sanitization
- Joi schema validation for all inputs
- XSS protection and input sanitization
- SQL injection prevention
- CORS configuration

### Monitoring & Logging
- Comprehensive request logging
- IP address tracking
- Suspicious activity detection
- Transaction monitoring

### Network Security
- Helmet.js security headers
- Rate limiting per endpoint type
- IP-based blocking
- HTTPS enforcement (with reverse proxy)

## Database Schema

The application uses SQLite by default with the following tables:

- `users` - User accounts and authentication
- `wallets` - User wallet addresses and metadata
- `blocked_entities` - Blocked usernames, emails, and IPs
- `transaction_logs` - Transaction history and monitoring
- `admin_settings` - Configuration settings
- `ip_tracking` - IP address activity tracking

## Admin Dashboard

Access the admin dashboard at `http://your-server:3000/admin`

Features:
- Real-time statistics and monitoring
- User management with search and filtering
- Transaction log analysis
- Fee configuration
- Security monitoring and suspicious activity detection
- Entity blocking/unblocking

### Setting up 2FA for Admin

1. Access `/api/admin/2fa/generate` to get QR code
2. Scan with authenticator app (Google Authenticator, Authy, etc.)
3. Update `ADMIN_2FA_SECRET` in `.env` file
4. Restart the application

## API Usage Examples

### User Registration
```javascript
const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'john_doe',
        email: 'john@example.com',
        password: 'SecurePassword123!'
    })
});
```

### Create Wallet
```javascript
const response = await fetch('/api/wallet', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        email: 'wallet@example.com',
        address: 'aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        label: 'My Main Wallet'
    })
});
```

### Broadcast Transaction
```javascript
const response = await fetch('/api/transaction/broadcast', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        rawTransaction: '0200000001...',
        walletAddress: 'aegs1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    })
});
```

## Monitoring & Maintenance

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs aegisum-backend

# Restart application
pm2 restart aegisum-backend

# Monitor resources
pm2 monit
```

### Log Files
- Application logs: `./logs/aegisum-backend.log`
- Error logs: `./logs/error.log`
- PM2 logs: `./logs/pm2-*.log`

### Database Maintenance
```bash
# Backup database
cp ./data/aegisum_wallet.db ./backups/backup-$(date +%Y%m%d).db

# View database
sqlite3 ./data/aegisum_wallet.db
```

## Troubleshooting

### Common Issues

1. **RPC Connection Failed**
   - Check Aegisum node is running
   - Verify RPC credentials in `.env`
   - Ensure RPC port is accessible

2. **Database Errors**
   - Run migration: `npm run migrate`
   - Check file permissions
   - Verify disk space

3. **Authentication Issues**
   - Check JWT_SECRET configuration
   - Verify token expiration settings
   - Clear browser cache/localStorage

4. **High Memory Usage**
   - Adjust PM2 max_memory_restart
   - Monitor for memory leaks
   - Check log file sizes

### Performance Optimization

1. **Database Optimization**
   - Regular cleanup of old IP tracking data
   - Index optimization for large datasets
   - Consider PostgreSQL for high-volume deployments

2. **Caching**
   - Implement Redis for session storage
   - Cache blockchain data where appropriate
   - Use CDN for static assets

3. **Load Balancing**
   - Use PM2 cluster mode
   - Implement nginx load balancing
   - Database connection pooling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- GitHub Issues: https://github.com/Marko666nilson/Aegisum-Mobile-wallet/issues
- Documentation: https://github.com/Marko666nilson/Aegisum-Mobile-wallet/wiki

## Changelog

### v1.0.0
- Initial release
- Complete backend API implementation
- Admin dashboard
- Security features
- Deployment automation