# Mobile App Development Plan (`apps/mobile`)
**Project:** Enterprise Asset Management & Auditing Mobile Application  
**Technology Stack:** React Native (Expo SDK), TypeScript, Native SQLite, Turborepo  
**Target Devices:** Android (Smartphones, Tablets, Zebra/Honeywell Handheld Terminals) & iOS  
**Backend API:** `https://app.bd.crystal-martin.com/assets/api` (Local Dev: `http://localhost:3001/api/v1`)  
**Shared Workspaces:** `@repo/types`, `@repo/database`

---

## Current Status & Roadmap Status
- [x] Backend lightweight offline synchronization endpoint (`/api/assets/offline-sync`) returns all **13,470+ assets** with sub-millisecond response.
- [x] 18 facility locations validated and structured in hierarchy (`Company > Unit > Block > Line`).
- [x] Monorepo configured with Turborepo and npm workspaces (`apps/*`, `packages/*`).
- [x] Phase 1 completed: Mobile application workspace (`apps/mobile`) initialized with Expo SDK 58, TypeScript, Monorepo Metro bundler, `.env` endpoints, and linked `@repo/types`.
- [x] Phase 2 completed: Auth & Secure Session Storage (`expo-secure-store`, JWT auto-refresh on 401, offline session persistence, server endpoint switcher modal, LoginScreen & DashboardScreen).
- [x] Phase 3 completed: High-Performance Offline Database (`expo-sqlite 58` with WAL mode, index-backed 0ms lookup for SAP/Asset/QR codes, batch chunking transactions, live progress reporting, and offline audit outbox queue).
- [x] Phase 4 completed: Optical Camera Scanner & Hardware Laser Support (`expo-camera 58`, `expo-haptics 58`, scanning reticle crosshairs overlay, on-demand camera toggle, Zebra/Honeywell barcode wedge input, and ScanScreen with SQLite verification).
- [x] Phase 5 completed: Station Floor Audit Workflow (`AuditScreen.tsx` with station placard QR check-in, rapid line scanning, real-time location mismatch alert, condition grading, re-scan to commit, and SQLite outbox batch fallback).
- [x] Phase 6 completed: Standalone Tag Inspector & Photo Capture (`AssetDetailScreen.tsx`, `expo-image-picker 58`, offline photos SQLite table, multi-photo preview gallery, condition grading, and multipart upload).
- [x] Phase 7 completed: Production Android APK Configuration (`eas.json` configured with `buildType: apk`, `app.json` native permissions, and root/mobile build scripts).

---

## Milestone Roadmap

```
Phase 1: Scaffolding & Monorepo Linkage [COMPLETED]
   └─► Phase 2: Auth & Secure Storage [COMPLETED]
          └─► Phase 3: Native SQLite Database (13k+ Offline Sync) [COMPLETED]
                 └─► Phase 4: Hardware & Camera Barcode Engine [COMPLETED]
                        └─► Phase 5: Floor Audit Workflow & Station Check [COMPLETED]
                               └─► Phase 6: Tag Inspector & Condition Photos [COMPLETED]
                                      └─► Phase 7: Production APK Configured (.apk) [COMPLETED]
```

---

## Detailed Task Breakdown

### Phase 1: Project Scaffolding & Monorepo Integration (Hour 1)
- [x] Initialize Expo TypeScript project in `apps/mobile`:
  ```bash
  npx create-expo-app@latest apps/mobile --template blank-typescript
  ```
- [x] Configure `apps/mobile/package.json` with workspace reference to `@repo/types`:
  ```json
  "dependencies": {
    "@repo/types": "file:../../packages/types"
  }
  ```
- [x] Configure `metro.config.js` to resolve monorepo packages (`node_modules` hoisting and symlink support).
- [x] Add mobile tasks to root `package.json` and `turbo.json`:
  - `"mobile:start": "npm run start --workspace=@repo/mobile"`
  - `"mobile:android": "npm run android --workspace=@repo/mobile"`
  - `"mobile:ios": "npm run ios --workspace=@repo/mobile"`
  - `"mobile:web": "npm run web --workspace=@repo/mobile"`
- [x] Configure environment variables (`apps/mobile/.env` & `.env.example`):
  - `EXPO_PUBLIC_API_URL=https://app.bd.crystal-martin.com/assets/api/v1`
  - `EXPO_PUBLIC_LOCAL_API_URL=http://localhost:3001/api/v1`
- [x] Typecheck verified passing (`npx tsc --noEmit --project apps/mobile/tsconfig.json`).

---

### Phase 2: Authentication & Secure Session Storage (Hours 1.5 – 2)
- [x] Install dependencies:
  - `expo-secure-store` (Encrypted keystore for JWT tokens)
  - `@react-navigation/native` & `@react-navigation/native-stack`
  - `react-native-screens` & `react-native-safe-area-context`
- [x] Implement Auth Context & API client (`src/services/api.ts` & `src/services/storage.ts`):
  - Token refresh and automatic `Authorization: Bearer <token>` attachment.
  - Automatic unwrapping of NestJS `TransformInterceptor` payload.
  - Timeout and connectivity error formatting.
- [x] Build mobile-optimized **Login Screen** (`src/screens/LoginScreen.tsx`):
  - Email & password inputs with reveal toggle.
  - Dynamic server endpoint switcher (Production IIS, Local Dev, or Custom Device IP).
  - "Continue Offline" cached session login for dead factory zones.
  - Error alert banners and loading states.
- [x] Build **Dashboard Screen** (`src/screens/DashboardScreen.tsx`) & Navigation (`src/navigation/RootNavigator.tsx`):
  - Conditional authentication stack switching.
  - User profile, active server endpoint, and roadmap implementation progress.

---

### Phase 3: High-Performance Offline Database (`expo-sqlite`) (Hours 2 – 3)
*Stores all 13,470+ equipment records and 18 locations in native C-based SQLite on the device for 0-latency dead-zone scanning.*
- [x] Install `expo-sqlite` (SDK 58).
- [x] Create database initialization module (`src/database/db.ts`):
  - Table `assets`: `id`, `assetCode`, `sapAssetCode`, `name`, `model`, `serialNumber`, `qrCode`, `barcode`, `status`, `condition`, `locationId`, `locationName`, `updatedAt`, `cachedAt`.
  - Indexes: `idx_assets_asset_code`, `idx_assets_sap_code`, `idx_assets_qr_code`, `idx_assets_barcode`, `idx_assets_location`.
  - Table `locations`: `id`, `code`, `name`, `type`, `parentId`, `fullPath`.
  - Table `sync_meta`: Last catalog sync timestamp and record count tracking.
  - Table `offline_audits`: Outbox queue for offline mutations when in dead zones.
  - Table `offline_photos`: Stores captured photos locally for offline field operations.
  - Fast query helper: `findCachedAsset(code)` multi-column indexed query.
- [x] Build **Sync Manager** (`src/services/syncManager.ts`):
  - Pull `/api/assets/offline-sync` and batch insert all 13,470 assets in 500-item transactions (`BEGIN TRANSACTION` -> `COMMIT`).
  - Pull `/api/locations?limit=500`.
  - Live progress reporting callback (`Downloading... -> Indexing 5,000 / 13,470... -> Completed`).
  - Outbox audit sync flusher (`flushPendingAudits()`).
- [x] Integrated into **Dashboard Screen** with interactive sync progress bar and instant local search test widget.

---

### Phase 4: Optical Camera Scanner & Hardware Laser Support (Hours 3 – 4)
- [x] Install `expo-camera` and `expo-haptics` (SDK 58).
- [x] Configured camera permissions in `app.json` for Android and iOS.
- [x] Build **Scanner Component** (`src/components/ScannerView.tsx`):
  - Hidden by default; expands on "Start Camera" and closes on "Stop Camera".
  - Reticle crosshair overlay with corner guides and laser line.
  - Continuous 2D QR and 1D Barcode scanning (`qr`, `code128`, `code39`, `ean13`, etc.) with 1.5s duplicate debounce.
  - Flashlight/torch toggle for dark factory lines.
  - Native haptic feedback (`Haptics.notificationAsync`) on successful scan.
  - Dedicated hardware scanner wedge input field for Zebra / Honeywell laser guns.
- [x] Build **Terminal Scan Screen** (`src/screens/ScanScreen.tsx`):
  - Real-time matching against local SQLite database.
  - Detailed asset inspection card (Asset Code, SAP Code, Category, Model, Serial, Assigned Location).
  - Quick action audit buttons ("Verify Location (Found)", "Flag Damaged", "Dismiss").
  - Recent scans log for the active operator session.

---

### Phase 5: Station Floor Audit Workflow (Hours 4 – 5)
*Matches the exact verified web workflow.*
- [x] **Audit Plan Selection Bar**:
  - Displays and filters active published/in-progress plans.
- [x] **Station Auditing Screen** (`src/screens/AuditScreen.tsx`):
  - **Step 1: Station Placard Check-In**: Scanning station placard QR (e.g. `BLOCK-C`) opens the line session.
  - **Step 2: Rapid Equipment Scanning**: Real-time tag resolution against local SQLite.
  - **Step 3: Instant Location Mismatch Detection**: Flags tags assigned to other stations with a red/amber mismatch badge.
  - **Step 4: Item Condition Grading**: One-tap toggles for `GOOD`, `FAIR`, `DAMAGED`.
  - **Step 5: Re-scan Placard or Tap Save**: Commits batch to `/audits/plans/:id/commit-location` or queues to SQLite outbox if offline.

---

### Phase 6: Standalone Tag Inspector & Asset Management (Hours 5 – 6)
- [x] Direct single-tag inspection accessible from Dashboard, Search, and Scan screens.
- [x] Detailed Asset Profile Screen (`src/screens/AssetDetailScreen.tsx`):
  - Full equipment specs: System Code, SAP Code, Category, Model, Serial Number, Current Line, Status badge.
  - Condition updater: Toggle condition to `GOOD`, `FAIR`, or `DAMAGED` with instant local SQLite audit recording.
- [x] Equipment Photo Capture & Offline Store (`expo-image-picker 58`):
  - Camera capture and gallery selection for damage/condition documentation.
  - Horizontal photo gallery with "Local" vs "Cloud" badges.
  - Direct multipart upload to `POST /assets/:id/photos` when online.

---

### Phase 7: Production Android APK Build Configuration (Hour 7)
- [x] Configured [`eas.json`](file:///Volumes/CORSAIR/assets-management/apps/mobile/eas.json) with `buildType: "apk"` for direct sideloading on Android devices, tablets, and Zebra/Honeywell barcode terminals.
- [x] Native permissions configured in `app.json` (`CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `VIBRATE`).
- [x] Root and mobile build scripts added (`npm run mobile:build:apk`).

