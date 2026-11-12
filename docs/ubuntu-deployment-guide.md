# Ubuntu Server Deployment Guide

This guide provides instructions for deploying both the **NestJS Backend API** (Port 3001) and the **Next.js Web Portal** (Port 3000) to an **Ubuntu Server** (Ubuntu 20.04, 22.04, or 24.04 LTS).

Three deployment methods are available:
1. **Method 1: Standalone Package (Recommended for Air-Gapped / Production)** — Pre-built self-contained archive; requires **ZERO `npm install`** or build steps on Ubuntu.
2. **Method 2: Turnkey Script (Git Clone)** — Automated bash script that installs tools, builds the monorepo, and launches services.
3. **Method 3: Docker Compose** — Containerized deployment running API, Web, and Nginx.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │             Incoming Traffic           │
                      │        (HTTP :80 / HTTPS :443)         │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │              Nginx Proxy               │
                      │  (Port 80/443, SSL, Compression, Cache)│
                      └───────────┬────────────────┬───────────┘
                                  │                │
            /api/*, /uploads/*    │                │  /* (All pages & assets)
                                  ▼                ▼
            ┌───────────────────────────┐    ┌───────────────────────────┐
            │   NestJS Backend API      │    │    Next.js Web Portal     │
            │   Port 3001 (PM2 / Node)  │    │    Port 3000 (PM2 / Node) │
            └─────────────┬─────────────┘    └───────────────────────────┘
                          │
                          ▼
            ┌───────────────────────────┐
            │    MSSQL Database Server  │
            │    192.168.45.51:1433     │
            └───────────────────────────┘
```

---

## Method 1: Standalone Package (Recommended)

The standalone build produces a pre-compiled, self-contained distribution package. It includes all production `node_modules`, the compiled Next.js standalone runner, static assets, and the native Linux Prisma engine (`libquery_engine-debian-openssl-3.0.x.so.node`).

### Step 1: Generate the Standalone Package (on Dev Machine)
Run the packager script:
```bash
npm run package:ubuntu
```
This produces two distribution archives in the project root:
* `deploy-ubuntu.tar.gz` (~124 MB, preserves Linux executable permissions)
* `deploy-ubuntu.zip` (~132 MB)

### Step 2: Package Contents
```
deploy-ubuntu/
├── web/                  # Next.js Standalone Server (Port 3000)
│   ├── server.js         # Self-contained Node.js server
│   ├── node_modules/     # Minimal bundled dependencies
│   ├── public/           # Static assets, logos, icons
│   ├── .next/static/     # Compiled UI client chunks & CSS
│   └── start-web.sh      # Direct runner script
├── api/                  # NestJS Backend API (Port 3001)
│   ├── dist/             # Compiled backend code
│   ├── prisma-client/    # Linux query engine (OpenSSL 3.0.x)
│   ├── node_modules/     # Complete runtime production dependencies
│   ├── uploads/          # Directory for equipment photos & docs
│   ├── .env              # Environment config file
│   └── start-api.sh      # Direct runner script
├── nginx/
│   └── assets-management.conf  # Reverse proxy config for port 80
├── ecosystem.config.js   # PM2 configuration for background daemons
├── install.sh            # Automated one-click installer
├── start.sh              # Start both services
├── stop.sh               # Stop both services
└── README.md             # Administrator quick reference
```

### Step 3: Transfer Archive to Ubuntu Server
Copy `deploy-ubuntu.tar.gz` to your Ubuntu server using SCP, SFTP, USB, or shared network drive:
```bash
scp deploy-ubuntu.tar.gz administrator@192.168.65.50:/var/www/
```

### Step 4: Extract and Deploy on Ubuntu
On your Ubuntu machine, run:
```bash
# 1. Create target directory
sudo mkdir -p /var/www/assets-management
sudo chown -R $administrator:$administrator /var/www/assets-management

# 2. Extract archive
tar -xzf deploy-ubuntu.tar.gz -C /var/www/assets-management --strip-components=1
cd /var/www/assets-management
```

Option 1: Overwrite everything except your .env and uploads/
# 1. Ensure write permissions
sudo chown -R $USER:$USER /var/www/assets-management

# 2. Extract and overwrite files while preserving production .env and uploaded photos
sudo tar --overwrite --warning=no-unknown-keyword \
  --exclude="*.env" \
  --exclude="api/uploads/*" \
  -xzf deploy-ubuntu.tar.gz -C /var/www/assets-management --strip-components=1

# 3. Reload services with zero downtime
cd /var/www/assets-management
chmod +x *.sh api/*.sh web/*.sh
pm2 reload all --update-env

> [!NOTE]
> If you see `tar: Ignoring unknown extended header keyword 'LIBARCHIVE.xattr.com.apple.provenance'`, this is **harmless**. It is an informational message from Ubuntu's GNU tar ignoring macOS-specific extended attribute headers. All files, permissions, and directories are extracted normally.
> If you want to suppress the message, add `--warning=no-unknown-keyword`:
> `tar --warning=no-unknown-keyword -xzf deploy-ubuntu.tar.gz -C /var/www/assets-management --strip-components=1`

```bash
# 3. Configure Database Connection (.env)
nano .env
# Also verify/copy to api/.env
cp .env api/.env
```
Ensure your database string points to your internal enterprise MSSQL server (replace `192.168.45.51` with your actual SQL Server IP):
```env
DATABASE_URL="sqlserver://192.168.45.51:1433;database=AssetsManagement;user=cmaautocutter;password=Crystal@123;encrypt=true;trustServerCertificate=true"
NEXT_PUBLIC_API_URL=http://<YOUR_UBUNTU_IP>/api
```

> [!IMPORTANT]
> If Prisma displays `Can't reach database server at localhost:1433`:
> - Your Ubuntu machine does not run MSSQL locally. `DATABASE_URL` in `/var/www/assets-management/api/.env` must point to your network SQL server host (`192.168.45.51:1433`).
> - After editing `.env`, copy it to `api/`: `cp /var/www/assets-management/.env /var/www/assets-management/api/.env`.
> - Reload PM2 environment: `pm2 restart all --update-env`.

```bash
# 4. Run the one-click installer
chmod +x *.sh api/*.sh web/*.sh
./install.sh
```

**The installer automatically:**
1. Checks and installs Node.js 20 LTS and PM2 (if not already installed).
2. Deploys the Nginx reverse proxy configuration to `/etc/nginx/sites-available/assets-management`.
3. Enables port 80 routing (routing `/api/*` to NestJS and `/*` to Next.js).
4. Starts both services under PM2 with persistent boot startup (`pm2 startup`).

---

## Method 2: Turnkey Script (Git Clone)

If you have Git and want to build directly from source on the Ubuntu server:

```bash
# 1. Clone repository
sudo mkdir -p /var/www/assets-management
sudo chown -R $USER:$USER /var/www/assets-management
git clone <your-repo-url> /var/www/assets-management
cd /var/www/assets-management

# 2. Configure Environment (.env)
cp .env.example .env
nano .env

# 3. Run the automated script
chmod +x scripts/deploy-ubuntu.sh
./scripts/deploy-ubuntu.sh
```

The script will install all build dependencies, run `npm install`, compile Prisma, build the monorepo, configure Nginx, and launch PM2.

---

## Method 3: Docker Compose Deployment

If your team runs containers with Docker on Ubuntu:

```bash
cd /var/www/assets-management
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

To view logs:
```bash
docker compose -f docker-compose.prod.yml logs -f
```

To stop containers:
```bash
docker compose -f docker-compose.prod.yml down
```

---

## Setting Up HTTPS / SSL (Let's Encrypt)

If your Ubuntu server has a public domain name (e.g. `assets.crystalmartin.com`), install a free SSL certificate with Certbot:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d assets.crystalmartin.com
```

Certbot will automatically update the Nginx configuration to enable HTTPS on port 443 with auto-renewal.

---

## Mobile App Terminal Configuration

To connect the handheld barcode scanner APK to your Ubuntu server:
1. Open the Mobile App on the terminal.
2. On the Login screen or **Profile / Settings** screen, tap **"Configure Server Endpoint"**.
3. Select **Custom Endpoint** and enter:
   ```
   http://<YOUR_UBUNTU_SERVER_IP>/api/v1
   ```
   *(or `https://assets.crystalmartin.com/api/v1` if SSL is enabled)*
4. Tap **Save Endpoint**. The terminal will connect to your Ubuntu backend immediately.

---

## Operational & Maintenance Commands

### PM2 Process Commands
```bash
# View status and memory usage
pm2 status

# View live streaming logs
pm2 logs
pm2 logs assets-api
pm2 logs assets-web

# Restart services
pm2 restart all
pm2 reload all  # Zero-downtime graceful reload

# Stop services
./stop.sh

# Monitor real-time CPU & RAM
pm2 monit
```

### Pulling Updates & Re-deploying (Git Method)
```bash
cd /var/www/assets-management
git pull origin main
npm install
npm run db:generate
npm run build
pm2 reload ecosystem.config.js --update-env
```

### Nginx Commands
```bash
# Test Nginx syntax
sudo nginx -t

# Reload Nginx without dropping connections
sudo systemctl reload nginx

# Check Nginx status
sudo systemctl status nginx
```
