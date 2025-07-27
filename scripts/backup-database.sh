#!/bin/bash

# Aegisum Wallet Database Backup Script
# This script creates a backup of the SQLite database

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DB_PATH="$PROJECT_DIR/data/aegisum_wallet.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="aegisum_wallet_$DATE.db"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  Aegisum Wallet Database Backup${NC}"
echo "=================================="

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database file not found: $DB_PATH${NC}"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
echo -e "${YELLOW}📋 Creating backup...${NC}"
cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $BACKUP_SIZE"
    echo "   Path: $BACKUP_DIR/$BACKUP_FILE"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Clean up old backups (keep last 30 days)
echo -e "${YELLOW}🧹 Cleaning up old backups...${NC}"
find "$BACKUP_DIR" -name "aegisum_wallet_*.db" -mtime +30 -delete 2>/dev/null || true

# Show backup directory contents
echo -e "${YELLOW}📁 Current backups:${NC}"
ls -lh "$BACKUP_DIR"/aegisum_wallet_*.db 2>/dev/null | tail -5 || echo "   No backups found"

echo -e "${GREEN}🎉 Backup process completed!${NC}"