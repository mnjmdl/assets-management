'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Network,
  Barcode,
  Search,
  Check,
  Building,
  Factory,
  Layers,
  Cpu,
  Boxes,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  Upload,
  SwitchCamera,
  Volume2,
  ClipboardCheck,
  ChevronRight,
  Trash2,
  Sparkles,
  Save,
  CheckCheck,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { syncManager } from '@/lib/offline/sync-manager';
import { getAllItems, OfflineAuditPlan } from '@/lib/offline/db';

interface AuditPlanOption {
  id: string;
  name: string;
  type: string;
  status: string;
  scopeType?: string;
}

interface ScannedAssetItem {
  id: string;
  assetCode: string;
  sapAssetCode?: string | null;
  name: string;
  model?: string | null;
  expectedLocationId?: string | null;
  expectedLocationName?: string | null;
  condition: 'GOOD' | 'FAIR' | 'DAMAGED';
  isMismatch: boolean;
  scannedAt: Date;
}

interface ActiveLocation {
  id: string;
  name: string;
  code: string;
  type: string;
}

export default function ScanPage() {
  const searchParams = useSearchParams();
  const initialCode = searchParams?.get('code') || '';
  const initialPlanId = searchParams?.get('planId') || searchParams?.get('auditId') || '';
  const querySessionId = searchParams?.get('sessionId') || '';

  // Audit Plans List & Active Selection
  const [plans, setPlans] = useState<AuditPlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);
  const [planSessions, setPlanSessions] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Session states & Mark Complete
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [lastSavedSessionId, setLastSavedSessionId] = useState<string | null>(querySessionId || null);
  const [lastSavedLocationName, setLastSavedLocationName] = useState<string | null>(null);
  const [isSessionMarkedCompleted, setIsSessionMarkedCompleted] = useState<boolean>(false);

  // Check if current session or loaded station is locked
  const isCurrentSessionLocked = Boolean(
    isSessionMarkedCompleted ||
    (sessionInfo &&
      (sessionInfo.status === 'COMPLETED' ||
        sessionInfo.status === 'SUBMITTED' ||
        sessionInfo.status === 'REVIEWED')),
  );

  // Floor Audit Flow States:
  // Step 1: Select Plan
  // Step 2: Scan Location
  // Step 3: Scan Assets (shown as list under the location)
  // Step 4: Scan Location again -> Assets saved with location
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null);
  const [scannedAssets, setScannedAssets] = useState<ScannedAssetItem[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccessBanner, setCommitSuccessBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  // Manual / fallback single tag inspection states
  const [manualCode, setManualCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Single tag lookup fallback result (when not in audit mode)
  const [standaloneAsset, setStandaloneAsset] = useState<any>(null);
  const [standaloneLocation, setStandaloneLocation] = useState<any>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Anti-bounce / throttling for rapid camera scanning
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  // Audio feedback chimes
  const playChime = (type: 'asset' | 'location' | 'saved' | 'warning') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'asset') {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 high note
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'location') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'saved') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      // Audio autoplay restrictions
    }
  };

  // Load audit plans on mount
  useEffect(() => {
    async function loadPlans() {
      setLoadingPlans(true);
      try {
        const res = await fetch('/api/audits/plans');
        if (res.ok) {
          const json = await res.json();
          const list: AuditPlanOption[] = Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json)
              ? json
              : [];
          setPlans(list);

          // If no initialPlanId was set in query, auto-select the first active plan if present
          if (!initialPlanId && list.length > 0) {
            setSelectedPlanId(list[0].id);
          }
        } else {
          throw new Error('Server returned error');
        }
      } catch (e) {
        console.error('Error fetching plans for scanner:', e);
        console.warn('Network offline, loading cached plans from IndexedDB:', e);
        try {
          const cached = await getAllItems<OfflineAuditPlan>('audit_plans');
          if (cached && cached.length > 0) {
            setPlans(cached);
            if (!initialPlanId && !selectedPlanId) {
              setSelectedPlanId(cached[0].id);
            }
          }
        } catch { }
      } finally {
        setLoadingPlans(false);
      }
    }
    loadPlans();
  }, [initialPlanId]);

  // Fetch plan sessions to detect completed stations
  const fetchPlanSessions = async (planId: string) => {
    if (!planId) {
      setPlanSessions([]);
      return;
    }
    try {
      const res = await fetch(`/api/audits/plans/${planId}`);
      if (res.ok) {
        const json = await res.json();
        const p = json?.data !== undefined ? json.data : json;
        if (p?.sessions) {
          setPlanSessions(p.sessions);
        }
      }
    } catch (e) {
      console.error('Error fetching plan sessions:', e);
    }
  };

  useEffect(() => {
    if (selectedPlanId) {
      fetchPlanSessions(selectedPlanId);
    } else {
      setPlanSessions([]);
    }
  }, [selectedPlanId]);

  // Load session if query param sessionId is present
  useEffect(() => {
    if (querySessionId) {
      fetch(`/api/audits/sessions/${querySessionId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const sess = json?.data !== undefined ? json.data : json;
          if (sess) {
            setSessionInfo(sess);
            if (sess.planId) {
              setSelectedPlanId(sess.planId);
              fetchPlanSessions(sess.planId);
            }
            if (sess.location) {
              setActiveLocation(sess.location);
              setLastSavedLocationName(sess.location.name);
            }
            if (sess.status === 'COMPLETED') {
              setIsSessionMarkedCompleted(true);
              stopCamera();
            }
          }
        })
        .catch((e) => console.error('Error loading session:', e));
    }
  }, [querySessionId]);

  // Commit scanned assets under the current location to database
  const handleCommitLocation = async (
    targetLocationId: string,
    itemsToCommit: ScannedAssetItem[],
    locName?: string,
  ) => {
    // Deduplicate any repeat tags before submitting
    const seenAssetIds = new Set<string>();
    const uniqueItems: ScannedAssetItem[] = [];
    for (const it of itemsToCommit) {
      if (!seenAssetIds.has(it.id)) {
        seenAssetIds.add(it.id);
        uniqueItems.push(it);
      }
    }

    if (!selectedPlanId || !targetLocationId || uniqueItems.length === 0) return;

    setIsCommitting(true);
    setCommitSuccessBanner(null);
    setNoticeBanner(null);

    try {
      const count = uniqueItems.length;
      const displayName = locName || activeLocation?.name || 'this station';
      const payload = {
        locationId: targetLocationId,
        auditorId: 'admin',
        items: uniqueItems.map((item) => ({
          assetId: item.id,
          condition: item.condition,
        })),
      };

      // 1. If online, attempt direct backend save
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const res = await fetch(`/api/audits/plans/${selectedPlanId}/commit-location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const resData = await res.json();
            playChime('saved');

            const createdSessionId = resData?.data?.sessionId || resData?.sessionId;
            setLastSavedSessionId(createdSessionId);
            setLastSavedLocationName(displayName);
            setIsSessionMarkedCompleted(false);
            if (selectedPlanId) fetchPlanSessions(selectedPlanId);

            setCommitSuccessBanner(
              `🎉 Successfully saved ${count} equipment tag${count > 1 ? 's' : ''} at ${displayName}!`,
            );

            setScannedAssets([]);
            setActiveLocation(null);
            return;
          } else {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData?.message || 'Failed to save audit scan batch';
            playChime('warning');
            setNoticeBanner(`❌ ${errMsg}`);
            alert(`⚠️ Audit Scan Error:\n\n${errMsg}`);
            return;
          }
        } catch (netErr) {
          console.warn('Direct commit failed, falling back to offline outbox queue:', netErr);
        }
      }

      // 2. Offline / Network Failure Fallback -> Queue in IndexedDB Outbox!
      await syncManager.queueMutation(
        `/api/audits/plans/${selectedPlanId}/commit-location`,
        'POST',
        payload,
        `Audit Batch: ${displayName} (${count} tags)`,
      );

      playChime('saved');
      setLastSavedLocationName(displayName);
      setCommitSuccessBanner(
        `📦 Saved Offline: ${count} tags at ${displayName} queued in local database. Will automatically synchronize when online.`,
      );

      setScannedAssets([]);
      setActiveLocation(null);
    } catch (err: any) {
      console.error('Commit location error:', err);
      setNoticeBanner(err.message || 'Could not save assets to location.');
      playChime('warning');
    } finally {
      setIsCommitting(false);
    }
  };

    // Perform QR / Barcode Lookup
    const performLookup = async (codeToLookup: string) => {
      const raw = codeToLookup.trim();
      if (!raw) return;

      if (isCurrentSessionLocked) {
        playChime('warning');
        setNoticeBanner(
          '🔒 Current station session is marked COMPLETED and locked for scanning. Reopen session to scan additional items.',
        );
        return;
      }

      setLoading(true);
      setLookupError(null);
      setNoticeBanner(null);

      try {
        let payload: any = null;

        // 1. Attempt online API lookup first if online
        if (typeof navigator === 'undefined' || navigator.onLine) {
          try {
            const res = await fetch(`/api/assets/scan/${encodeURIComponent(raw)}`);
            if (res.ok) {
              const json = await res.json();
              payload = json?.data !== undefined ? json.data : json;
            }
          } catch (fetchErr) {
            console.warn('Online lookup unreachable, checking offline IndexedDB:', fetchErr);
          }
        }

        // 2. Offline Fallback: Search local IndexedDB cache
        if (!payload) {
          const offlineResult = await syncManager.offlineScanLookup(raw);
          if (offlineResult) {
            if (offlineResult.type === 'LOCATION') {
              payload = {
                type: 'LOCATION',
                location: offlineResult.data,
              };
            } else {
              payload = {
                type: 'ASSET',
                asset: offlineResult.data,
              };
            }
          }
        }

        if (!payload) {
          throw new Error(`No equipment or location matches code "${raw}" (verified online & offline database).`);
        }

          // ─────────────────────────────────────────────────────────────
          // AUDIT MODE: Plan is selected
          // ─────────────────────────────────────────────────────────────
          if (selectedPlanId) {
            if (payload.type === 'LOCATION') {
              const scannedLoc = payload.location;

              // Check if station session for this location is already marked COMPLETED in this audit plan
              const completedSession = planSessions.find(
                (s) =>
                  s.locationId === scannedLoc.id &&
                  (s.status === 'COMPLETED' || s.status === 'SUBMITTED' || s.status === 'REVIEWED'),
              );

              if (completedSession) {
                playChime('warning');
                setNoticeBanner(
                  `🔒 Station "${scannedLoc.name}" is already marked COMPLETED for this audit plan. Scanning is locked. Reopen the session in the Audit Plan to scan more equipment.`,
                );
                return;
              }

              // If no active location is opened yet -> open it
              if (!activeLocation) {
                setActiveLocation(scannedLoc);
                setScannedAssets([]);
                setCommitSuccessBanner(null);
                playChime('location');
                setNoticeBanner(`📍 Station ${scannedLoc.name} opened. Now scan equipment tags!`);
              } else if (activeLocation.id === scannedLoc.id) {
                // Scanned the SAME location again -> TRIGGER COMMIT!
                if (scannedAssets.length === 0) {
                  setNoticeBanner(`Already at ${scannedLoc.name}. Scan equipment before saving.`);
                  playChime('warning');
                } else {
                  // Commit current batch!
                  await handleCommitLocation(scannedLoc.id, scannedAssets, scannedLoc.name);
                }
              } else {
                // Scanned a DIFFERENT location -> Auto-save previous batch & open new location!
                if (scannedAssets.length > 0) {
                  await handleCommitLocation(activeLocation.id, scannedAssets, activeLocation.name);
                }
                setActiveLocation(scannedLoc);
                setScannedAssets([]);
                playChime('location');
                setNoticeBanner(`📍 Moved to new station: ${scannedLoc.name}`);
              }
            } else {
              // Scanned code is an ASSET
              const asset = payload.asset || payload;

              if (!activeLocation) {
                playChime('warning');
                setNoticeBanner(
                  '⚠️ Scan a Location QR placard (e.g. BLOCK-C) first to set the station!',
                );
              } else {
                // Check if already in current location batch
                const alreadyInBatch = scannedAssets.some(
                  (a) =>
                    a.id === asset.id ||
                    a.assetCode?.toUpperCase() === asset.assetCode?.toUpperCase(),
                );
                if (alreadyInBatch) {
                  playChime('warning');
                  setNoticeBanner(
                    `⚠️ DUPLICATE: Asset "${asset.assetCode}" is already in this station batch! Duplicate scans are not allowed and not saved.`,
                  );
                  return;
                }

                // Check if already scanned in any session of the audit plan
                const alreadyAuditedInPlan = planSessions.find((s) =>
                  s.items?.some(
                    (it: any) =>
                      (it.assetId === asset.id ||
                        it.asset?.assetCode?.toUpperCase() === asset.assetCode?.toUpperCase()) &&
                      it.status !== 'PENDING' &&
                      Boolean(it.scannedAt),
                  ),
                );
                if (alreadyAuditedInPlan) {
                  playChime('warning');
                  const stationName = alreadyAuditedInPlan.location?.name || alreadyAuditedInPlan.id;
                  const alertMsg = `⚠️ DUPLICATE SCAN REJECTED:\n\nAsset "${asset.assetCode}" (${asset.name}) has ALREADY been audited in this audit plan at station "${stationName}".\n\nDuplicate scans are not allowed and this record was NOT saved.`;
                  setNoticeBanner(
                    `⚠️ DUPLICATE: Asset "${asset.assetCode}" (${asset.name}) has ALREADY been audited in station "${stationName}". Duplicate scans are not allowed.`,
                  );
                  alert(alertMsg);
                  return;
                }
                  // Check location mismatch
                  const isMismatch = Boolean(
                    asset.locationId && asset.locationId !== activeLocation.id,
                  );

                  const newItem: ScannedAssetItem = {
                    id: asset.id,
                    assetCode: asset.assetCode,
                    sapAssetCode: asset.sapAssetCode,
                    name: asset.name,
                    model: asset.model,
                    expectedLocationId: asset.locationId,
                    expectedLocationName: asset.location?.name || 'Unassigned',
                    condition: 'GOOD',
                    isMismatch,
                    scannedAt: new Date(),
                  };

                  setScannedAssets((prev) => [newItem, ...prev]);
                  playChime('asset');
                  setNoticeBanner(
                    `Scanned: ${asset.assetCode} (${scannedAssets.length + 1} items at ${activeLocation.name})`,
                  );
                }
              }
            } else {
            // ─────────────────────────────────────────────────────────────
            // STANDALONE MODE: No audit plan selected (direct lookup)
            // ─────────────────────────────────────────────────────────────
            playChime('asset');
            if (payload.type === 'LOCATION') {
              setStandaloneLocation(payload.location);
              setStandaloneAsset(null);
            } else {
              setStandaloneAsset(payload.asset || payload);
              setStandaloneLocation(null);
            }
            stopCamera();
          }
        } catch (err: any) {
          setLookupError(err.message || 'Lookup failed.');
          playChime('warning');
        } finally {
          setLoading(false);
          setManualCode('');
        }
      };

      // Auto-lookup if code query param is present on mount
      useEffect(() => {
        if (initialCode) {
          performLookup(initialCode);
        }
      }, [initialCode]);

      // Start Camera Stream with Android Progressive Fallback Constraints
      const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
        stopCamera();
        setCameraPermissionError(null);

        // 1. Check for Secure Context / WebRTC API presence
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
          const isLocalhost = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          );

          let msg = 'Live camera stream is disabled by browser security policies. (HTTPS or localhost required on Android).';
          if (!isHttps && !isLocalhost) {
            msg = `Android Chrome blocks camera streams on plain HTTP (${typeof window !== 'undefined' ? window.location.host : 'local network'}). Tap "Take Photo / Snap QR" below to scan using your native camera, or access via HTTPS.`;
          }
          setCameraPermissionError(msg);
          return;
        }

        // 2. Progressive constraint fallback list for Android camera drivers
        const constraintAttempts: MediaStreamConstraints[] = [
          {
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          {
            video: {
              facingMode: { ideal: facing },
            },
            audio: false,
          },
          {
            video: {
              facingMode: facing,
            },
            audio: false,
          },
          {
            video: true,
            audio: false,
          },
        ];

        let stream: MediaStream | null = null;
        let lastErr: any = null;

        for (const c of constraintAttempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(c);
            if (stream) break;
          } catch (e: any) {
            lastErr = e;
            console.warn('Camera constraint attempt failed:', c, e);
          }
        }

        if (!stream) {
          console.warn('All camera constraint attempts failed:', lastErr);
          setCameraPermissionError(
            lastErr?.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera permissions in Android Chrome settings.'
              : `Camera unavailable: ${lastErr?.message || 'Device camera could not be started'}. Please use "Take Photo / Snap QR" below.`,
          );
          setCameraActive(false);
          return;
        }

        try {
          streamRef.current = stream;
          setCameraActive(true);
          if (videoRef.current) {
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.setAttribute('webkit-playsinline', 'true');
            videoRef.current.setAttribute('muted', 'true');
            videoRef.current.setAttribute('autoplay', 'true');
            videoRef.current.muted = true;
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch((playErr) => {
              console.warn('Video play auto-call error:', playErr);
            });
            startContinuousScanner();
          }
        } catch (err: any) {
          console.warn('Camera video element attach error:', err);
          setCameraPermissionError(`Camera preview error: ${err.message}`);
          setCameraActive(false);
        }
      };

      // Ensure camera video element receives stream and starts scanning when mounted
      useEffect(() => {
        if (cameraActive && streamRef.current && videoRef.current) {
          try {
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.setAttribute('webkit-playsinline', 'true');
            videoRef.current.setAttribute('muted', 'true');
            videoRef.current.setAttribute('autoplay', 'true');
            videoRef.current.muted = true;
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch((playErr) => {
              console.warn('Video play error in effect:', playErr);
            });
            startContinuousScanner();
          } catch (err: any) {
            console.warn('Video attach error in effect:', err);
          }
        }
      }, [cameraActive]);

      // Stop Camera Stream
      const stopCamera = () => {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setCameraActive(false);
      };

      const toggleCameraFacing = () => {
        const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
        setCameraFacing(nextFacing);
        if (cameraActive) {
          startCamera(nextFacing);
        }
      };

      // Continuous Barcode / QR Scanning Loop
      const startContinuousScanner = () => {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;

          if ('BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({
                formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'],
              });
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const code = barcodes[0].rawValue;
                const now = Date.now();

                // Throttle identical scans within 1.8 seconds to allow floor scanning flow
                if (code === lastScannedCodeRef.current && now - lastScanTimeRef.current < 1800) {
                  return;
                }

                lastScannedCodeRef.current = code;
                lastScanTimeRef.current = now;
                performLookup(code);
              }
            } catch (e) {
              // Silent detector frame ignore
            }
          }
        }, 350);
      };

      // Handle Photo / Image Upload of QR Code
      const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];

        setLoading(true);
        setLookupError(null);

        try {
          if ('BarcodeDetector' in window) {
            const detector = new (window as any).BarcodeDetector({
              formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'],
            });

            let source: any = null;
            try {
              source = await createImageBitmap(file);
            } catch {
              source = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
              });
            }

            const barcodes = await detector.detect(source);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              performLookup(barcodes[0].rawValue);
              return;
            }
          }
          throw new Error('No QR code or barcode detected in image. Please ensure the code is clear and well-lit.');
        } catch (err: any) {
          setLookupError(err.message || 'Could not scan image.');
          setLoading(false);
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
        }
      };

      // Cleanup on unmount
      useEffect(() => {
        return () => {
          stopCamera();
        };
      }, []);

      // Update item condition in current batch
      const handleUpdateItemCondition = (
        assetId: string,
        condition: 'GOOD' | 'FAIR' | 'DAMAGED',
      ) => {
        setScannedAssets((prev) =>
          prev.map((item) => (item.id === assetId ? { ...item, condition } : item)),
        );
      };

      // Remove single item from current uncommitted batch
      const handleRemoveFromBatch = (assetId: string) => {
        setScannedAssets((prev) => prev.filter((item) => item.id !== assetId));
      };

      const selectedPlan = plans.find((p) => p.id === selectedPlanId);

      return (
        <div className="w-full pb-12">
          {/* ─────────────────────────────────────────────────────────────
          CAMERA / VIEWFINDER & INPUT (Sticky in Top Safe Area on Mobile)
         ───────────────────────────────────────────────────────────── */}
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md safe-top px-3 sm:px-4 pt-1.5 pb-2 border-b shadow-xs md:static md:bg-transparent md:backdrop-blur-none md:p-0 md:border-0 md:shadow-none md:pt-0">
            <div className="max-w-lg mx-auto">
              <Card className="overflow-hidden border shadow-sm bg-card">
                <CardHeader className="p-2.5 sm:p-3.5 pb-2 border-b bg-muted/20">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Camera className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
                        Viewfinder
                      </span>
                      {activeLocation && (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 font-mono font-semibold shrink-0"
                        >
                          {activeLocation.code} ({scannedAssets.length})
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {activeLocation && scannedAssets.length > 0 && (
                        <Button
                          size="sm"
                          disabled={isCommitting}
                          onClick={() => handleCommitLocation(activeLocation.id, scannedAssets)}
                          className="h-7 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0 shadow-xs"
                          title={`Save & Finish ${activeLocation.code}`}
                        >
                          {isCommitting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          <span>Save ({scannedAssets.length})</span>
                        </Button>
                      )}

                      <Button
                        variant={cameraActive ? 'destructive' : 'default'}
                        size="sm"
                        disabled={isCurrentSessionLocked}
                        onClick={() => (cameraActive ? stopCamera() : startCamera())}
                        className={`h-7 sm:h-8 px-2 sm:px-3 gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold ${
                          !cameraActive ? 'bg-primary text-primary-foreground shadow-xs' : ''
                        }`}
                        title={cameraActive ? 'Stop Camera' : 'Start Camera'}
                      >
                        {isCurrentSessionLocked ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="hidden sm:inline">Locked</span>
                          </>
                        ) : cameraActive ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="hidden sm:inline">Stop Camera</span>
                            <span className="sm:hidden text-[11px]">Stop</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Start Camera</span>
                          </>
                        )}
                      </Button>

                      {cameraActive && !isCurrentSessionLocked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleCameraFacing}
                          className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground"
                          title="Switch Camera"
                        >
                          <SwitchCamera className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isCurrentSessionLocked}
                        onChange={handleImageUpload}
                      />
                      <input
                        ref={nativeCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={isCurrentSessionLocked}
                        onChange={handleImageUpload}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isCurrentSessionLocked}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                        title="Upload QR Image"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Camera Screen Viewfinder - Hidden by default, shown ONLY when cameraActive is true */}
                {isCurrentSessionLocked ? (
                  <CardContent className="p-0 bg-card border-b">
                    <div className="py-5 px-3 sm:py-7 sm:px-4 text-center flex flex-col items-center justify-center space-y-2">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-foreground flex items-center justify-center gap-1.5">
                          <span>Station Session Completed</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-600 border-emerald-500/40 bg-emerald-500/10 font-bold"
                          >
                            Locked
                          </Badge>
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          {lastSavedLocationName || activeLocation?.name || 'This station'} is marked as{' '}
                          <strong>COMPLETED</strong>. Scanning is locked.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const targetId = sessionInfo?.id || lastSavedSessionId;
                            if (!targetId) return;
                            try {
                              const r = await fetch(`/api/audits/sessions/${targetId}/reopen`, {
                                method: 'PUT',
                              });
                              if (r.ok) {
                                setIsSessionMarkedCompleted(false);
                                if (sessionInfo) setSessionInfo({ ...sessionInfo, status: 'IN_PROGRESS' });
                                if (selectedPlanId) fetchPlanSessions(selectedPlanId);
                                playChime('saved');
                                setNoticeBanner('Station session reopened. Camera and scanner unlocked.');
                              }
                            } catch (e) {
                              console.error('Error reopening session:', e);
                            }
                          }}
                          className="h-7 text-xs font-semibold gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reopen Station</span>
                        </Button>
                        {selectedPlanId && (
                          <Link href={`/audits/${selectedPlanId}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                              <span>Audit Plan</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                ) : cameraActive ? (
                  <CardContent className="p-0 bg-black relative animate-in fade-in duration-200">
                    <div className="relative aspect-video max-h-[190px] xs:max-h-[220px] sm:max-h-[280px] md:max-h-[320px] w-full overflow-hidden flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Viewfinder Target Overlays */}
                      <div className="absolute inset-0 border-2 border-primary/40 pointer-events-none flex items-center justify-center">
                        <div className="w-36 h-36 sm:w-44 sm:h-44 border-2 border-dashed border-primary rounded-xl relative animate-pulse">
                          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
                          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
                          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
                        </div>
                      </div>

                      <div className="absolute bottom-2 text-center w-full pointer-events-none px-2">
                        <span className="text-[10px] bg-black/80 text-white/95 px-2.5 py-1 rounded-full backdrop-blur-xs font-mono truncate max-w-[90%] inline-block">
                          {activeLocation
                            ? `Scan equipment or scan ${activeLocation.code} again to save`
                            : 'Scan Location Placard (e.g. BLOCK-C)'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                ) : cameraPermissionError ? (
                  <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <span className="font-bold text-foreground block">Camera Notice</span>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{cameraPermissionError}</p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => nativeCameraInputRef.current?.click()}
                          className="h-7 text-xs px-2.5 font-semibold"
                        >
                          <Camera className="w-3.5 h-3.5 mr-1" />
                          Take Photo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startCamera()}
                          className="h-7 text-xs px-2.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Retry
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Handheld Gun Scanner / Manual Input */}
                <div className="p-2 sm:p-3 border-t bg-card">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      performLookup(manualCode);
                    }}
                    className="flex gap-1.5 sm:gap-2"
                  >
                    <Input
                      disabled={isCurrentSessionLocked}
                      placeholder={
                        isCurrentSessionLocked
                          ? 'Session is completed and locked'
                          : activeLocation
                            ? `Scan equipment or ${activeLocation.code} to save...`
                            : 'Scan or type Location code (e.g. BLOCK-C)...'
                      }
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="font-mono text-xs h-8 sm:h-9 disabled:opacity-50 disabled:bg-muted"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={loading || !manualCode.trim() || isCurrentSessionLocked}
                      className="h-8 sm:h-9 px-2.5 sm:px-3 shrink-0 gap-1 text-xs"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isCurrentSessionLocked ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Verify</span>
                    </Button>
                  </form>

                  {lookupError && (
                    <p className="text-destructive text-[11px] mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{lookupError}</span>
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Scrollable Content Container underneath sticky camera */}
          <div className="max-w-lg mx-auto px-3 sm:px-4 pt-3 space-y-4">
            {/* ─────────────────────────────────────────────────────────────
          TOP AUDIT PLAN SELECTOR BAR (Desktop only)
         ───────────────────────────────────────────────────────────── */}
            <Card className="hidden md:block border bg-card shadow-2xs">
              <CardContent className="p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-primary" />
                    <span>Audit Plan</span>
                  </span>
                  {selectedPlan && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {selectedPlan.type}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                    value={selectedPlanId}
                    onChange={(e) => {
                      setSelectedPlanId(e.target.value);
                      setActiveLocation(null);
                      setScannedAssets([]);
                      setCommitSuccessBanner(null);
                      setNoticeBanner(null);
                    }}
                  >
                    <option value="">-- No Audit Plan (Single Tag Lookup) --</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.status})
                      </option>
                    ))}
                  </select>

                  {selectedPlanId && (
                    <Link href={`/audits/${selectedPlanId}`}>
                      <Button variant="outline" size="sm" className="h-10 px-3 text-xs shrink-0" title="View Audit Plan">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ─────────────────────────────────────────────────────────────
          AUDIT FLOOR WALK STATUS / STAGE BANNER
         ───────────────────────────────────────────────────────────── */}
            {selectedPlanId && (
              <div className="space-y-2">
                {/* Commit Success Celebration Banner */}
                {commitSuccessBanner && (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs font-medium space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                        <span className="font-semibold">{commitSuccessBanner}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCommitSuccessBanner(null)}
                        className="h-6 px-1.5 text-[11px] text-muted-foreground"
                      >
                        Dismiss
                      </Button>
                    </div>

                    {lastSavedSessionId && (
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20">
                        <span className="text-[11px] text-muted-foreground">
                          {isSessionMarkedCompleted ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Station Session Marked COMPLETED!
                            </span>
                          ) : (
                            `Finished physical verification at ${lastSavedLocationName || 'station'}?`
                          )}
                        </span>

                        {!isSessionMarkedCompleted && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const r = await fetch(
                                  `/api/audits/sessions/${lastSavedSessionId}/complete`,
                                  { method: 'PUT' },
                                );
                                if (r.ok) {
                                  setIsSessionMarkedCompleted(true);
                                  stopCamera();
                                  if (selectedPlanId) fetchPlanSessions(selectedPlanId);
                                  playChime('saved');
                                }
                              } catch (e) {
                                console.error('Error completing session:', e);
                              }
                            }}
                            className="h-7 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-2xs gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Complete</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Notice / Audio feedback text */}
                {noticeBanner && !commitSuccessBanner && (
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-foreground text-xs font-medium flex items-center gap-2 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <span>{noticeBanner}</span>
                  </div>
                )}

                {/* Stage Card: Step 1 (Awaiting Location) vs Step 2 (Location Active) */}
                {!activeLocation ? (
                  <Card className="border-sky-500/30 bg-sky-500/5 shadow-2xs">
                    <CardContent className="p-4 space-y-1.5 text-center">
                      <div className="w-10 h-10 rounded-full bg-sky-500/15 text-sky-600 mx-auto flex items-center justify-center">
                        <Building className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-sm text-foreground">
                        Step 1: Scan Location QR Placard
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Point the camera at the station or room placard (e.g. <strong>BLOCK-C</strong>) to open the location batch.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-emerald-500/40 bg-emerald-500/5 shadow-md">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                            📍 Active Station (Step 2 &amp; 3)
                          </span>
                          <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                            <span>{activeLocation.name}</span>
                            <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {activeLocation.code}
                            </span>
                          </h3>
                        </div>

                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 bg-emerald-500/10 text-[11px] px-2 py-0.5">
                          {scannedAssets.length} Assets in Batch
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Scan equipment tags in this station. When finished, <strong>scan {activeLocation.code} again</strong> or tap below to save.
                      </p>

                      {/* Primary Action Button: Save Location Batch */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={scannedAssets.length === 0 || isCommitting}
                          onClick={() => handleCommitLocation(activeLocation.id, scannedAssets)}
                          className="w-full gap-2 h-10 font-semibold shadow-sm"
                        >
                          {isCommitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Saving Batch...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              <span>Save &amp; Finish {activeLocation.code} ({scannedAssets.length})</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (scannedAssets.length > 0 && !confirm('Discard scanned assets in this unsaved location?')) {
                              return;
                            }
                            setActiveLocation(null);
                            setScannedAssets([]);
                          }}
                          className="h-10 text-xs shrink-0"
                          title="Cancel or Switch Location"
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
          LIVE SCANNED ASSETS LIST UNDER THE LOCATION
         ───────────────────────────────────────────────────────────── */}
            {selectedPlanId && activeLocation && (
              <div className="space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-primary" />
                    <span>
                      Equipment at {activeLocation.name} ({scannedAssets.length})
                    </span>
                  </h3>

                  {scannedAssets.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Scan <strong>{activeLocation.code}</strong> to save
                    </span>
                  )}
                </div>

                {scannedAssets.length === 0 ? (
                  <Card className="border-dashed p-6 text-center space-y-1.5 bg-muted/10">
                    <QrCode className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                    <p className="text-xs font-medium text-foreground">No Assets Scanned Yet</p>
                    <p className="text-[11px] text-muted-foreground">
                      Point camera at machinery &amp; asset tags stationed in {activeLocation.name}.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {scannedAssets.map((item, index) => (
                      <Card
                        key={item.id}
                        className={`overflow-hidden transition-all border ${item.isMismatch ? 'border-amber-500/50 bg-amber-500/5' : 'bg-card'
                          }`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  #{scannedAssets.length - index}
                                </span>
                                <span className="font-mono font-bold text-xs text-primary">
                                  {item.assetCode}
                                </span>
                                {item.sapAssetCode && (
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    (SAP: {item.sapAssetCode})
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-xs text-foreground leading-tight">
                                {item.name}
                              </h4>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFromBatch(item.id)}
                              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 -mr-1"
                              title="Remove from batch"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          {/* Mismatch Alert or Expected Location */}
                          {item.isMismatch ? (
                            <div className="p-1.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-medium flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>
                                Relocated: Expected at <strong>{item.expectedLocationName}</strong>
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Station verified</span>
                            </div>
                          )}

                          {/* Quick Physical Condition Pills */}
                          <div className="flex items-center justify-between pt-1 border-t text-[11px]">
                            <span className="text-muted-foreground text-[10px]">Condition:</span>
                            <div className="flex items-center gap-1">
                              {(['GOOD', 'FAIR', 'DAMAGED'] as const).map((cond) => (
                                <button
                                  key={cond}
                                  type="button"
                                  onClick={() => handleUpdateItemCondition(item.id, cond)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${item.condition === cond
                                      ? cond === 'GOOD'
                                        ? 'bg-emerald-600 text-white'
                                        : cond === 'FAIR'
                                          ? 'bg-amber-600 text-white'
                                          : 'bg-destructive text-white'
                                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                >
                                  {cond}
                                </button>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Bottom Commit Button */}
                    <div className="pt-2">
                      <Button
                        size="lg"
                        disabled={isCommitting}
                        onClick={() => handleCommitLocation(activeLocation.id, scannedAssets)}
                        className="w-full gap-2 shadow-md h-12 text-sm font-bold"
                      >
                        {isCommitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving Batch to {activeLocation.code}...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Commit {scannedAssets.length} Assets with {activeLocation.name}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
          STANDALONE LOOKUP CARD (When not in audit mode)
         ───────────────────────────────────────────────────────────── */}
            {!selectedPlanId && standaloneAsset && (
              <Card className="border-primary/50 shadow-xl overflow-hidden animate-in fade-in">
                <CardHeader className="bg-primary/5 pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active Asset</span>
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStandaloneAsset(null)}
                      className="h-8 gap-1 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Scan Next</span>
                    </Button>
                  </div>
                  <CardTitle className="text-base sm:text-lg mt-2">{standaloneAsset.name}</CardTitle>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="font-mono font-bold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                      Tag: {standaloneAsset.assetCode}
                    </span>
                    {standaloneAsset.sapAssetCode && (
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        SAP: {standaloneAsset.sapAssetCode}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-1 text-xs">
                    <span className="font-semibold text-muted-foreground block text-[10px] uppercase">
                      Location
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Network className="w-4 h-4 text-primary" />
                      <span>{standaloneAsset.location?.name || 'Unassigned'}</span>
                    </div>
                  </div>

                  <Link href={`/assets/${standaloneAsset.id}`} className="block">
                    <Button variant="outline" className="w-full gap-1.5 text-xs h-10">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Full Asset Profile</span>
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {!selectedPlanId && standaloneLocation && (
              <Card className="border-emerald-500/50 shadow-xl overflow-hidden animate-in fade-in">
                <CardHeader className="bg-emerald-500/10 pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="bg-emerald-600">
                      <span>Location Station</span>
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStandaloneLocation(null)}
                      className="h-8 text-xs"
                    >
                      Scan Next
                    </Button>
                  </div>
                  <CardTitle className="text-base sm:text-lg mt-2">{standaloneLocation.name}</CardTitle>
                  <span className="font-mono font-bold text-xs text-primary">{standaloneLocation.code}</span>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    To audit equipment at this location, select an <strong>Audit Plan</strong> from the top dropdown.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      );
    }
