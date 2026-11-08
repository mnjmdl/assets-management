#!/usr/bin/env bash
# =============================================================================
# Turnkey Ubuntu Deployment Script
# Crystal Martin Assets Management & Auditing System (API + Web)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   Crystal Martin Assets Management & Auditing System ${NC}"
echo -e "${BLUE}              Ubuntu Production Deployment          ${NC}"
echo -e "${BLUE}====================================================${NC}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "\n${YELLOW}Step 1: Checking System Dependencies...${NC}"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Node.js is not installed! Installing Node.js 20 LTS...${NC}"
    sudo apt-get update
    sudo apt-get install -y curl ca-certificates gnupg
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js detected: ${NODE_VERSION}${NC}"
fi

# Check Build Tools (required for native modules like bcrypt/sharp)
if ! command -v gcc >/dev/null 2>&1 || ! command -v make >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing build-essential for native C++ modules...${NC}"
    sudo apt-get update && sudo apt-get install -y build-essential python3
fi

# Check PM2
if ! command -v pm2 >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing PM2 Process Manager globally...${NC}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}✓ PM2 detected: $(pm2 -v)${NC}"
fi

# Check Nginx
if ! command -v nginx >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing Nginx Web Server...${NC}"
    sudo apt-get update && sudo apt-get install -y nginx
else
    echo -e "${GREEN}✓ Nginx detected: $(nginx -v 2>&1)${NC}"
fi

echo -e "\n${YELLOW}Step 2: Checking Environment Configuration...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}Copying .env.example to .env...${NC}"
        cp .env.example .env
        echo -e "${RED}⚠️  IMPORTANT: Please edit .env with your actual DATABASE_URL and secrets!${NC}"
    else
        echo -e "${RED}Error: .env file missing! Create .env before starting production services.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env configuration file exists.${NC}"
fi

echo -e "\n${YELLOW}Step 3: Installing Project Dependencies...${NC}"
npm install

echo -e "\n${YELLOW}Step 4: Generating Prisma Database Client...${NC}"
npm run db:generate

echo -e "\n${YELLOW}Step 5: Synchronizing Database Schema...${NC}"
npm run db:push || echo -e "${YELLOW}Warning: db:push failed (database might be offline or using manual migrations). Continuing...${NC}"

echo -e "\n${YELLOW}Step 6: Building Monorepo Packages (API + Web)...${NC}"
npm run build

echo -e "\n${YELLOW}Step 7: Configuring Nginx Reverse Proxy...${NC}"
NGINX_CONF_SRC="${PROJECT_DIR}/deploy/nginx/assets-management.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/assets-management"
NGINX_ENABLED="/etc/nginx/sites-enabled/assets-management"

if [ -f "$NGINX_CONF_SRC" ]; then
    echo -e "Deploying Nginx site config to ${NGINX_AVAILABLE}..."
    sudo cp "$NGINX_CONF_SRC" "$NGINX_AVAILABLE"
    
    if [ ! -L "$NGINX_ENABLED" ]; then
        sudo ln -s "$NGINX_AVAILABLE" "$NGINX_ENABLED"
    fi

    # Remove default Nginx welcome page if enabled to avoid conflict on port 80
    if [ -L "/etc/nginx/sites-enabled/default" ]; then
        echo -e "Disabling default Nginx welcome page..."
        sudo rm -f /etc/nginx/sites-enabled/default
    fi

    echo -e "Testing Nginx configuration syntax..."
    sudo nginx -t
    echo -e "Reloading Nginx service..."
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx successfully configured and reloaded.${NC}"
fi

echo -e "\n${YELLOW}Step 8: Starting / Reloading PM2 Application Services...${NC}"
if pm2 describe assets-api >/dev/null 2>&1 || pm2 describe assets-web >/dev/null 2>&1; then
    echo -e "Reloading active PM2 services with zero downtime..."
    pm2 reload ecosystem.config.js --update-env
else
    echo -e "Starting PM2 services..."
    pm2 start ecosystem.config.js
fi

# Save PM2 process list to persist across reboots
pm2 save

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   ✓ Deployment Completed Successfully!           ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Services running under PM2:"
pm2 status

echo -e "\nAccess URLs:"
echo -e "• Web Portal:        http://localhost/ (or http://<your-server-ip>/)"
echo -e "• REST API:          http://localhost/api/v1/ (or http://<your-server-ip>/api/v1/)"
echo -e "• Swagger API Docs:  http://localhost/api/docs/"
echo -e "\nUseful Commands:"
echo -e "• Check status:      pm2 status"
echo -e "• View logs:         pm2 logs"
echo -e "• Restart all:       pm2 restart all"
echo -e "• Monitor CPU/RAM:   pm2 monit"

