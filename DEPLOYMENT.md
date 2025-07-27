# Deployment Guide - Aegisum Mobile Wallet Backend

This guide provides detailed instructions for deploying the Aegisum Mobile Wallet Backend on an Ubuntu server.

## Prerequisites

- Ubuntu 18.04+ server (2GB RAM minimum, 4GB recommended)
- Root or sudo access
- Domain name (optional but recommended)
- Aegisum Core node running and synced
- Basic knowledge of Linux command line

## Step-by-Step Deployment

### 1. Server Preparation

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential
```

#### Create Dedicated User
```bash
# Create user for the application
sudo useradd -m -s /bin/bash aegisum_backend
sudo usermod -aG sudo aegisum_backend

# Set password (optional)
sudo passwd aegisum_backend

# Switch to the new user
sudo su - aegisum_backend
```

### 2. Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

### 3. Install PM2 Process Manager

```bash
sudo npm install -g pm2
pm2 --version
```

### 4. Clone and Setup Application

```bash
# Navigate to home directory
cd /home/aegisum_backend

# Clone repository
git clone https://github.com/Marko666nilson/Aegisum-Mobile-wallet.git aegisum-wallet-backend
cd aegisum-wallet-backend

# Install dependencies
npm install --production

# Create necessary directories
mkdir -p logs data backups
```

### 5. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

#### Environment Configuration (.env)

```env
# Server Configuration
PORT=3000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=24h

# Database
DATABASE_PATH=./data/aegisum_wallet.db

# Aegisum RPC Configuration
AEGISUM_RPC_HOST=127.0.0.1
AEGISUM_RPC_PORT=39940
AEGISUM_RPC_USER=your-rpc-username
AEGISUM_RPC_PASSWORD=your-rpc-password-from-aegisum-conf
AEGISUM_RPC_WALLET=wallet.dat

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$2b$12$hashed.password.here  # Use bcrypt hash
ADMIN_2FA_SECRET=  # Leave empty initially, set up later

# Fee Configuration
DEFAULT_WITHDRAWAL_FEE_TYPE=flat
DEFAULT_WITHDRAWAL_FEE_AMOUNT=1.0
FEE_ADDRESS=your-aegisum-address-for-collecting-fees

# Security
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/aegisum-backend.log

# CORS (add your domain)
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

#### Generate Admin Password Hash

```bash
# Install bcrypt tool
npm install -g bcrypt-cli

# Generate password hash
bcrypt-cli "YourSecureAdminPassword123!"

# Copy the hash to ADMIN_PASSWORD in .env
```

### 6. Configure Aegisum Node

Edit your Aegisum configuration file (`~/.aegisum/aegisum.conf`):

```conf
# RPC Configuration
server=1
rpcuser=your-rpc-username
rpcpassword=your-rpc-password
rpcallowip=127.0.0.1
rpcport=39940
rpcbind=127.0.0.1

# Wallet Configuration
wallet=wallet.dat

# Network Configuration
listen=1
maxconnections=50

# Logging
debug=0
```

Restart Aegisum node:
```bash
aegisum-cli stop
aegisumd -daemon
```

### 7. Initialize Database

```bash
# Run database migration
npm run migrate

# Verify database creation
ls -la data/
```

### 8. Configure PM2

```bash
# Copy PM2 configuration
cp ecosystem.config.js.example ecosystem.config.js

# Edit PM2 configuration if needed
nano ecosystem.config.js
```

#### PM2 Configuration (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'aegisum-backend',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### 9. Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs aegisum-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command
```

### 10. Configure Firewall

```bash
# Install and configure UFW
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow application port
sudo ufw allow 3000/tcp

# Allow HTTP/HTTPS (if using nginx)
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

### 11. Install and Configure Nginx (Recommended)

```bash
# Install Nginx
sudo apt install -y nginx

# Create configuration file
sudo nano /etc/nginx/sites-available/aegisum-backend
```

#### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=admin:10m rate=5r/s;
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Admin dashboard
    location /admin {
        limit_req zone=admin burst=10 nodelay;
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
    
    # Root and static files
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
    
    # Security - hide server version
    server_tokens off;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

Enable the site:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/aegisum-backend /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 12. SSL Certificate with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 13. Setup 2FA for Admin

```bash
# Access the application
curl http://localhost:3000/api/admin/2fa/generate

# Or visit in browser: http://your-domain.com/api/admin/2fa/generate
# Scan QR code with authenticator app
# Update ADMIN_2FA_SECRET in .env file
# Restart application: pm2 restart aegisum-backend
```

### 14. Setup Monitoring and Logging

#### Log Rotation
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/aegisum-backend
```

```
/home/aegisum_backend/aegisum-wallet-backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 aegisum_backend aegisum_backend
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### System Monitoring
```bash
# Install htop for monitoring
sudo apt install -y htop

# Monitor application
pm2 monit

# Check system resources
htop
```

### 15. Backup Strategy

#### Database Backup Script
```bash
# Create backup script
nano /home/aegisum_backend/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/aegisum_backend/backups"
DB_PATH="/home/aegisum_backend/aegisum-wallet-backend/data/aegisum_wallet.db"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
cp "$DB_PATH" "$BACKUP_DIR/aegisum_wallet_$DATE.db"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "aegisum_wallet_*.db" -mtime +30 -delete

echo "Backup completed: aegisum_wallet_$DATE.db"
```

```bash
# Make executable
chmod +x /home/aegisum_backend/backup.sh

# Add to crontab for daily backups
crontab -e
# Add line: 0 2 * * * /home/aegisum_backend/backup.sh
```

### 16. Testing Deployment

#### Health Check
```bash
# Test API health
curl http://localhost:3000/api/health

# Test admin dashboard
curl http://localhost:3000/admin

# Check logs
pm2 logs aegisum-backend --lines 50
```

#### Load Testing (Optional)
```bash
# Install Apache Bench
sudo apt install -y apache2-utils

# Test API endpoint
ab -n 100 -c 10 http://localhost:3000/api/info
```

## Post-Deployment Configuration

### 1. Admin Dashboard Setup

1. Visit `http://your-domain.com/admin`
2. Login with admin credentials
3. Configure fee settings
4. Review security settings
5. Test user management features

### 2. Fee Configuration

1. Access admin dashboard
2. Navigate to Fee Settings
3. Configure withdrawal fee type and amount
4. Set fee collection address
5. Test fee calculation

### 3. Security Hardening

#### Additional Security Measures
```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh

# Install fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban

# Configure automatic updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

## Maintenance Tasks

### Daily Tasks
- Check application status: `pm2 status`
- Review logs: `pm2 logs aegisum-backend --lines 100`
- Monitor disk space: `df -h`

### Weekly Tasks
- Update system packages: `sudo apt update && sudo apt upgrade`
- Review security logs
- Check backup integrity
- Monitor suspicious activity in admin dashboard

### Monthly Tasks
- Update Node.js and npm if needed
- Review and rotate logs
- Update SSL certificates (if not auto-renewed)
- Performance optimization review

## Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   pm2 logs aegisum-backend
   
   # Check configuration
   node -c src/server.js
   
   # Verify environment
   cat .env
   ```

2. **Database connection errors**
   ```bash
   # Check database file
   ls -la data/
   
   # Run migration again
   npm run migrate
   
   # Check permissions
   chmod 644 data/aegisum_wallet.db
   ```

3. **RPC connection failed**
   ```bash
   # Test RPC connection
   aegisum-cli getblockchaininfo
   
   # Check Aegisum node status
   ps aux | grep aegisum
   
   # Verify RPC settings
   cat ~/.aegisum/aegisum.conf
   ```

4. **High memory usage**
   ```bash
   # Check memory usage
   pm2 monit
   
   # Restart application
   pm2 restart aegisum-backend
   
   # Adjust memory limit in ecosystem.config.js
   ```

### Performance Issues

1. **Slow API responses**
   - Check Aegisum node sync status
   - Monitor database query performance
   - Review rate limiting settings

2. **High CPU usage**
   - Check for infinite loops in logs
   - Monitor concurrent connections
   - Consider scaling with PM2 cluster mode

## Scaling Considerations

### Horizontal Scaling
```bash
# Use PM2 cluster mode
pm2 start ecosystem.config.js --instances max

# Load balancing with Nginx
# Add upstream configuration to nginx
```

### Database Scaling
- Consider PostgreSQL for high-volume deployments
- Implement connection pooling
- Add database indexes for performance

### Monitoring and Alerting
- Implement health check endpoints
- Set up monitoring with tools like Prometheus
- Configure alerting for critical issues

## Security Checklist

- [ ] Strong admin password with 2FA enabled
- [ ] JWT secret is cryptographically secure
- [ ] Firewall configured properly
- [ ] SSL certificate installed and auto-renewing
- [ ] Regular security updates applied
- [ ] Log monitoring in place
- [ ] Backup strategy implemented
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] CORS properly configured

## Support

For deployment issues:
1. Check the troubleshooting section
2. Review application logs
3. Consult the GitHub repository issues
4. Contact support with detailed error information

Remember to keep your deployment secure and regularly updated!