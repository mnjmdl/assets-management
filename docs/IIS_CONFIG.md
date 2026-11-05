# 🏢 IIS Production Hosting & Configuration Guide

Complete step-by-step enterprise deployment guide for hosting the **Crystal Martin Assets Management Platform** (Next.js Web Portal + NestJS Backend API) on Windows Server using **Microsoft Internet Information Services (IIS)**.

---

## 🏛️ System Architecture Overview

```
                      INTERNET / INTRANET
                               │
           https://app.bd.crystal-martin.com:8443
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   IIS WEB SERVER (Windows)                  │
│                                                             │
│  1. Terminates SSL (Crystal Martin Certificate)             │
│  2. URL Rewrite + ARR Reverse Proxy                         │
│     ├── "/"               ──► http://127.0.0.1:3000 (Web)   │
│     └── "/api" or "/v1"   ──► http://127.0.0.1:3001 (API)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       PORT 3000 (Local)               PORT 3001 (Local)
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     Next.js Web Portal      │ │     NestJS Backend API      │
│   (Standalone server.js)    │ │        (dist/main.js)       │
│    Managed by PM2 / Bat     │ │    Managed by PM2 / Bat     │
└─────────────────────────────┘ └──────────────┬──────────────┘
                                               │
                                               ▼
                                      SQL SERVER DATABASE
                                   192.168.45.51:1433 (MSSQL)
```

---

## 📦 Prerequisites: Standalone Zero-Dependency Package

The deployment uses a pre-bundled standalone package (`deploy-iis.zip`) created by:

```bash
npm run package:standalone
```

> [!TIP]
> This package requires **ZERO `npm install`** and **zero compilation** on the production server. Everything (Node modules, Next.js standalone runtime, and Windows Prisma native DLL) is pre-packaged.

---

## STEP 1: Install Required IIS Modules (One-Time)

Log in to the Windows Server as Administrator:

1. **Install URL Rewrite 2.1**:
   - Download & Install: [Microsoft URL Rewrite 2.1 for IIS (x64)](https://www.iis.net/downloads/microsoft/url-rewrite)
2. **Install Application Request Routing (ARR) 3.0**:
   - Download & Install: [Microsoft Application Request Routing 3.0 for IIS (x64)](https://www.iis.net/downloads/microsoft/application-request-routing)

---

## STEP 2: Enable the Proxy Feature in IIS

ARR installs with the proxy feature disabled by default. You **must** enable it:

1. Open **IIS Manager** (`inetmgr`).
2. In the left **Connections** tree, click the **root server name** (the very top item).
3. In the middle pane, double-click **Application Request Routing Cache**.
4. In the right **Actions** pane, click **Server Proxy Settings...**.
5. Check the box: **`Enable proxy`**.
6. In the right pane, click **Apply**.

---

## STEP 3: Place the Standalone Application Folders

Extract `deploy-iis.zip` to your target directory (e.g. `D:\Soft\deploy-iis\deploy\`):

```text
D:\Soft\deploy-iis\deploy\
├── 📁 web\
│   ├── server.js
│   ├── .next\
│   ├── public\
│   ├── node_modules\
│   ├── web.config
│   └── start-web.bat
│
└── 📁 api\
    ├── dist\
    ├── node_modules\
    ├── prisma-client\
    ├── .env
    └── start-api.bat
```

### Verify Production Environment Variables (`api\.env`)
Open `D:\Soft\deploy-iis\deploy\api\.env` on the server and ensure the database and port settings are correct:

```env
NODE_ENV=production
DATABASE_URL="sqlserver://192.168.45.51:1433;database=AssetsManagement;user=cmaautocutter;password=Crystal@123;encrypt=true;trustServerCertificate=true"
API_PORT=3001
PORT=3001
JWT_SECRET=your-production-secret-key
```

---

## STEP 4: Configure the Reverse-Proxy `web.config`

Ensure `D:\Soft\deploy-iis\deploy\web\web.config` contains this reverse-proxy configuration:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- 1. Route Swagger docs & Direct API calls (/api/v1/*) directly to NestJS (Port 3001) -->
                <rule name="DirectAPIToNestJS" stopProcessing="true">
                    <match url="^api/(v1/.*|docs.*)" />
                    <action type="Rewrite" url="http://127.0.0.1:3001/{R:0}" />
                </rule>

                <!-- 2. Route all other requests (Next.js web pages and Next.js /api proxy handler) to Next.js (Port 3000) -->
                <rule name="ReverseProxyToWeb" stopProcessing="true">
                    <match url="(.*)" />
                    <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
                </rule>
            </rules>
        </rewrite>
        <!-- Security & Protocol Headers -->
        <httpProtocol>
            <customHeaders>
                <add name="X-Forwarded-Proto" value="https" />
            </customHeaders>
        </httpProtocol>
    </system.webServer>
</configuration>
```

---

## STEP 5: Create the Site in IIS Manager

1. Open **IIS Manager**.
2. In the left pane, right-click **Sites** &rarr; select **Add Website...**.
3. Fill in the parameters:
   - **Site name**: `AssetsManagementWeb`
   - **Physical path**: `D:\Soft\deploy-iis\deploy\web`
   - **Type**: `https`
   - **IP address**: `All Unassigned` (or specific server IP)
   - **Port**: `8443`
   - **Host name**: (Leave blank or enter `app.bd.crystal-martin.com`)
   - **SSL certificate**: Select your **Crystal Martin SSL certificate** (`*.bd.crystal-martin.com`) from the dropdown.
4. Click **OK**.

---

## STEP 6: Open Port 8443 in Windows Firewall

Open **PowerShell as Administrator** on the Windows server:

```powershell
New-NetFirewallRule -DisplayName "Assets Management HTTPS 8443" -Direction Inbound -LocalPort 8443 -Protocol TCP -Action Allow
```

---

## STEP 7: Run Both Services (24/7 Background Service with PM2)

To keep both services running automatically without keeping command windows open:

Open **PowerShell as Administrator** on the server:

```powershell
# 1. Install PM2 and Windows Service Wrapper (one-time)
npm install -g pm2
npm install -g pm2-windows-service

# 2. Start the Backend API (Port 3001)
cd D:\Soft\deploy-iis\deploy\api
pm2 start dist/main.js --name "assets-api"

# 3. Start the Web Portal (Port 3000)
cd D:\Soft\deploy-iis\deploy\web
pm2 start server.js --name "assets-web"

# 4. Save the running state
pm2 save

# 5. Register with Windows Services so it starts on server reboot
pm2-service-install -n PM2
```

*(For quick local testing, you can also double-click **`start-api.bat`** and **`start-web.bat`**).*

---

## STEP 8: Verification & Health Check

Open a browser on any workstation in the company network:

| Destination | URL | Expected Result |
| :--- | :--- | :--- |
| **Web Portal** | `https://app.bd.crystal-martin.com:8443` | Next.js Dashboard loads with green SSL padlock |
| **API Health** | `https://app.bd.crystal-martin.com:8443/api/v1/health` | Returns `{ "status": "ok" }` |
| **Swagger Docs** | `https://app.bd.crystal-martin.com:8443/api/docs` | Interactive Swagger API interface loads |

---

## 🛠️ Maintenance & Useful Commands

| Action | Command (on Windows Server) |
| :--- | :--- |
| **Check service status** | `pm2 status` |
| **View live logs** | `pm2 logs` |
| **Restart services** (after update) | `pm2 restart all` |
| **Restart IIS** | `iisreset` |
| **Check listening ports** | `netstat -ano \| findstr ":3000 :3001 :8443"` |

