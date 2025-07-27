#!/bin/bash

# Aegisum Mobile Wallet Backend Setup Script
# This script sets up the backend on Ubuntu server

set -e

echo "🚀 Starting Aegisum Mobile Wallet Backend Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
npm_version=$(npm --version)
print_status "Node.js version: $node_version"
print_status "npm version: $npm_version"

# Install PM2 globally
print_status "Installing PM2 process manager..."
sudo npm install -g pm2

# Install git if not present
if ! command -v git &> /dev/null; then
    print_status "Installing Git..."
    sudo apt install -y git
fi

# Create aegisum_backend user if it doesn't exist
if ! id "aegisum_backend" &>/dev/null; then
    print_status "Creating aegisum_backend user..."
    sudo useradd -m -s /bin/bash aegisum_backend
    sudo usermod -aG sudo aegisum_backend
    print_status "User 'aegisum_backend' created successfully"
else
    print_warning "User 'aegisum_backend' already exists"
fi

# Create application directory
APP_DIR="/home/aegisum_backend/aegisum-wallet-backend"
print_status "Creating application directory: $APP_DIR"
sudo mkdir -p $APP_DIR
sudo chown aegisum_backend:aegisum_backend $APP_DIR

# Switch to aegisum_backend user for the rest of the setup
print_status "Switching to aegisum_backend user..."

sudo -u aegisum_backend bash << 'EOF'
set -e

APP_DIR="/home/aegisum_backend/aegisum-wallet-backend"
cd $APP_DIR

# Clone or update repository
if [ -d ".git" ]; then
    echo "Repository already exists, pulling latest changes..."
    git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/Marko666nilson/Aegisum-Mobile-wallet.git .
fi

# Install dependencies
echo "Installing Node.js dependencies..."
npm install --production

# Create necessary directories
mkdir -p logs data

# Copy environment file
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before starting the server"
else
    echo ".env file already exists"
fi

# Copy PM2 ecosystem file
if [ ! -f "ecosystem.config.js" ]; then
    echo "Creating PM2 ecosystem configuration..."
    cp ecosystem.config.js.example ecosystem.config.js
else
    echo "PM2 ecosystem configuration already exists"
fi

# Run database migration
echo "Running database migration..."
npm run migrate

# Set up PM2 startup script
pm2 startup
echo "PM2 startup script configured"

echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit /home/aegisum_backend/aegisum-wallet-backend/.env with your configuration"
echo "2. Configure your Aegisum RPC settings"
echo "3. Set up admin credentials and 2FA"
echo "4. Start the application with: pm2 start ecosystem.config.js"
echo "5. Save PM2 configuration: pm2 save"
echo ""
echo "🔧 Configuration files:"
echo "   - Environment: /home/aegisum_backend/aegisum-wallet-backend/.env"
echo "   - PM2 Config: /home/aegisum_backend/aegisum-wallet-backend/ecosystem.config.js"
echo ""
echo "📊 Admin Dashboard: http://your-server-ip:3000/admin"
echo "📖 API Documentation: http://your-server-ip:3000/api/info"

EOF

# Install and configure nginx (optional)
read -p "Do you want to install and configure Nginx as reverse proxy? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Installing Nginx..."
    sudo apt install -y nginx
    
    # Create nginx configuration
    sudo tee /etc/nginx/sites-available/aegisum-backend > /dev/null << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Change this to your domain
    
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
EOF
    
    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/aegisum-backend /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    
    print_status "Nginx configured successfully"
    print_warning "Remember to update server_name in /etc/nginx/sites-available/aegisum-backend"
fi

# Install and configure UFW firewall
read -p "Do you want to configure UFW firewall? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Configuring UFW firewall..."
    sudo ufw --force enable
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 3000/tcp  # Application port
    sudo ufw allow 'Nginx Full'  # If nginx is installed
    sudo ufw status
    print_status "UFW firewall configured"
fi

print_status "🎉 Aegisum Mobile Wallet Backend setup completed!"
print_warning "Don't forget to:"
print_warning "1. Configure your .env file"
print_warning "2. Set up SSL certificates for production"
print_warning "3. Configure your Aegisum node RPC settings"
print_warning "4. Test the application before going live"

echo ""
echo "📚 For more information, visit: https://github.com/Marko666nilson/Aegisum-Mobile-wallet"