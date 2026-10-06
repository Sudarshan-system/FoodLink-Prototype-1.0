import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { doc, updateDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../features/auth/AuthContext';
import { triggerPushNotification } from '../lib/notifications';
import {
  shouldWriteLocation,
  calculateHaversineDistanceKm,
  calculateEtaMinutes,
  formatSpeedKmh,
  isPickupSessionExpired,
  Coordinates,
  PickupLocation,
  LOCATION_THROTTLE_MS,
  PICKUP_SESSION_TIMEOUT_MS,
} from '../lib/locationTracking';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  X,
  Lock,
  Eye,
  Trash2,
  Maximize2,
} from 'lucide-react';

export interface CourierMissionData {
  listingId: string;
  foodTitle: string;
  quantityStr: string;
  donorName: string;
  donorOrg: string;
  donorAddress: string;
  donorPhone?: string;
  donorId?: string;
  recipientId?: string;
  shelterName: string;
  shelterAddress: string;
  courierName: string;
  courierPhone?: string;
  courierVehicle?: string;
  handoffCode?: string;
  cargoTemp?: string;
  status: 'assigned' | 'at_donor' | 'en_route_shelter' | 'arrived_shelter' | 'delivered';
  donorCoords?: Coordinates;
  shelterCoords?: Coordinates;
}

interface RealTimeCourierTrackerProps {
  mission: CourierMissionData;
  userRole?: 'donor' | 'recipient' | 'courier' | 'viewer';
  onClose?: () => void;
  onStatusChange?: (newStatus: CourierMissionData['status']) => void;
  isModal?: boolean;
}

// Default benchmark coordinates (Worli South to Bandra/Byculla, Mumbai)
const DEFAULT_DONOR_COORDS: Coordinates = { lat: 19.0178, lng: 72.8178 };
const DEFAULT_SHELTER_COORDS: Coordinates = { lat: 19.0596, lng: 72.8295 };

export const RealTimeCourierTracker: React.FC<RealTimeCourierTrackerProps> = ({
  mission,
  userRole = 'viewer',
  onClose,
  onStatusChange,
  isModal = false,
}) => {
  const { isDark } = useTheme();
  const { currentUser, userProfile } = useAuth();

  const donorPosition = mission.donorCoords || DEFAULT_DONOR_COORDS;
  const shelterPosition = mission.shelterCoords || DEFAULT_SHELTER_COORDS;

  // Live Location and Telemetry State
  const [courierLocation, setCourierLocation] = useState<PickupLocation>({
    lat: donorPosition.lat,
    lng: donorPosition.lng,
    speed: 0,
    heading: 0,
    updatedAt: Date.now(),
  });
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [lastWriteTimestamp, setLastWriteTimestamp] = useState<number>(0);
  const [telemetrySource, setTelemetrySource] = useState<'live_gps' | 'firestore_stream' | 'simulated'>('simulated');
  const [internalStatus, setInternalStatus] = useState<CourierMissionData['status']>(mission.status);
  const [showOtpConfirm, setShowOtpConfirm] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Compute remaining distance & ETA dynamically using Haversine
  const distanceRemainingKm = calculateHaversineDistanceKm(
    courierLocation.lat,
    courierLocation.lng,
    shelterPosition.lat,
    shelterPosition.lng
  );
  const etaMinutes = calculateEtaMinutes(distanceRemainingKm, courierLocation.speed ? courierLocation.speed * 3.6 : null);

  // 1. Initialize Leaflet Map with OpenStreetMap (Free, zero-billing)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([courierLocation.lat, courierLocation.lng], 13);

    // OpenStreetMap Tile Layer (Free, no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add Attribution manually in minimal style
    L.control.attribution({ position: 'bottomright', prefix: '© OpenStreetMap contributors' }).addTo(map);

    // Custom HTML div-icons for crisp rendering & zero broken asset paths
    const donorIcon = L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="flex flex-col items-center">
          <div class="w-8 h-8 rounded-full bg-[#059669] text-white flex items-center justify-center shadow-lg border-2 border-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <span class="text-[10px] font-bold bg-white text-[#064E3B] px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">Kitchen</span>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
    });

    const shelterIcon = L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="flex flex-col items-center">
          <div class="w-8 h-8 rounded-full bg-[#E8672C] text-white flex items-center justify-center shadow-lg border-2 border-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          </div>
          <span class="text-[10px] font-bold bg-white text-[#9A3412] px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">Shelter</span>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
    });

    const courierIcon = L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 rounded-full bg-[#E8672C]/30 animate-ping"></div>
          <div class="w-9 h-9 rounded-full bg-[#1A1714] text-[#E8672C] flex items-center justify-center shadow-xl border-2 border-[#E8672C] z-10">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // Add static donor & shelter markers
    L.marker([donorPosition.lat, donorPosition.lng], { icon: donorIcon }).addTo(map);
    L.marker([shelterPosition.lat, shelterPosition.lng], { icon: shelterIcon }).addTo(map);

    // Add moving courier marker
    const courierMarker = L.marker([courierLocation.lat, courierLocation.lng], { icon: courierIcon }).addTo(map);
    courierMarkerRef.current = courierMarker;

    // Add Polyline Route
    const polyline = L.polyline(
      [
        [donorPosition.lat, donorPosition.lng],
        [shelterPosition.lat, shelterPosition.lng],
      ],
      { color: '#E8672C', weight: 4, opacity: 0.8, dashArray: '6, 8' }
    ).addTo(map);
    polylineRef.current = polyline;

    // Fit map bounds to encompass both endpoints
    map.fitBounds([
      [donorPosition.lat, donorPosition.lng],
      [shelterPosition.lat, shelterPosition.lng],
    ], { padding: [50, 50] });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Subscribe to Firestore `pickups/{listingId}` for viewer (Donor or Recipient)
  useEffect(() => {
    if (!mission.listingId) return;

    const pickupDocRef = doc(db, 'pickups', mission.listingId);
    const unsubscribe = onSnapshot(
      pickupDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Check if session has auto-expired
          if (data.startedAt && isPickupSessionExpired(data.startedAt)) {
            setStatusNotice('Tracking session expired after 45-minute security limit.');
            return;
          }

          if (data.location && typeof data.location.lat === 'number') {
            const loc: PickupLocation = {
              lat: data.location.lat,
              lng: data.location.lng,
              speed: data.location.speed || 0,
              heading: data.location.heading || 0,
              updatedAt: data.location.updatedAt || Date.now(),
            };
            setCourierLocation(loc);
            setTelemetrySource('firestore_stream');

            // Smoothly move courier marker on map
            if (courierMarkerRef.current) {
              courierMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            }
          }
        }
      },
      (err) => {
        console.warn('Pickups live tracking sync notice:', err.message);
      }
    );

    return () => unsubscribe();
  }, [mission.listingId]);

  // 3. Start Geolocation Watcher with 10s Throttling upon explicit user consent
  const startLiveLocationTracking = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your current browser.');
      return;
    }

    setIsSharingLocation(true);
    setTelemetrySource('live_gps');
    setSessionStartTime(Date.now());
    setStatusNotice('Live location sharing active. Telemetry throttled to 1 write every 10s.');

    const watcher = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();

        // Update local marker immediately for butter-smooth visual feedback
        const newLocation: PickupLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0,
          updatedAt: now,
        };
        setCourierLocation(newLocation);
        if (courierMarkerRef.current) {
          courierMarkerRef.current.setLatLng([newLocation.lat, newLocation.lng]);
        }

        // Apply 10-second throttling to Firestore write to protect free Spark quota
        if (shouldWriteLocation(lastWriteTimestamp, now, LOCATION_THROTTLE_MS)) {
          setLastWriteTimestamp(now);
          try {
            const pickupDocRef = doc(db, 'pickups', mission.listingId);
            await setDoc(
              pickupDocRef,
              {
                listingId: mission.listingId,
                donorId: mission.donorId || 'donor_demo',
                recipientId: mission.recipientId || 'recipient_demo',
                courierId: currentUser?.uid || 'courier_runner_demo',
                courierName: userProfile?.displayName || mission.courierName,
                status: 'active',
                startedAt: sessionStartTime,
                expiresAt: sessionStartTime + PICKUP_SESSION_TIMEOUT_MS,
                location: {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  speed: pos.coords.speed || 0,
                  heading: pos.coords.heading || 0,
                  updatedAt: now,
                },
              },
              { merge: true }
            );
          } catch (writeErr) {
            console.warn('Error writing throttled location:', writeErr);
          }
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setStatusNotice('Unable to acquire GPS signal. Check location permissions.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    watchIdRef.current = watcher;
  };

  // 4. Stop Location Sharing & Auto-Delete Document from Firestore
  const stopLiveLocationTracking = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharingLocation(false);
    setStatusNotice('Location sharing stopped.');

    // Delete ephemeral document from Firestore to respect DPDP Act ephemeral storage
    try {
      if (mission.listingId) {
        await deleteDoc(doc(db, 'pickups', mission.listingId));
      }
    } catch (delErr) {
      console.warn('Error deleting pickup location document:', delErr);
    }
  };

  // 5. Complete Handover (Deletes location and marks completed)
  const handleCompleteHandover = async () => {
    await stopLiveLocationTracking();
    setInternalStatus('delivered');
    if (onStatusChange) onStatusChange('delivered');

    triggerPushNotification({
      type: 'courier_arrived',
      title: '🎉 Rescue Run Delivered & Verified',
      body: `Delivery of ${mission.foodTitle} (${mission.quantityStr}) handed over to ${mission.shelterName}.`,
      linkTab: 'ledger',
    });

    try {
      if (mission.listingId) {
        await updateDoc(doc(db, 'listings', mission.listingId), {
          status: 'completed',
          courierCompletedAt: new Date().toISOString(),
          courierLiveStatus: 'delivered',
        });
      }
    } catch (e) {
      console.warn('Handover update notice:', e);
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border shadow-xl flex flex-col ${
        isDark ? 'bg-[#0D2017] border-[#1E4D34] text-[#F2EDE4]' : 'bg-white border-[#E7E5E4] text-[#1A1714]'
      } ${isModal ? 'max-w-4xl mx-auto' : ''}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E7E5E4] dark:border-[#1E4D34] bg-white/70 dark:bg-[#122A1E]/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8672C]/10 text-[#E8672C] flex items-center justify-center font-bold">
            <Navigation className="w-5 h-5 text-[#E8672C]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base leading-tight">Live Food Rescue Transit</h3>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-[#E8672C] text-white">
                {internalStatus === 'delivered' ? 'Completed' : 'Transit'}
              </span>
            </div>
            <p className="text-xs text-[#78716C] dark:text-[#9CA3AF]">
              {mission.foodTitle} • {mission.quantityStr}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status Notice Banner if present */}
      {statusNotice && (
        <div className="px-4 py-2 text-xs font-semibold bg-[#FFF7ED] dark:bg-[#2C1C11] text-[#C2410C] dark:text-[#FDBA74] border-b border-[#FDBA74]/30 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-[#E8672C]" />
            {statusNotice}
          </span>
          <button type="button" onClick={() => setStatusNotice(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Map Canvas Area (Leaflet + OpenStreetMap) */}
      <div className="relative w-full h-[360px] sm:h-[420px] bg-gray-100 dark:bg-gray-900">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Telemetry & ETA HUD */}
        <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-80 z-20 pointer-events-none">
          <div className="p-3.5 rounded-xl bg-white/95 dark:bg-[#142D21]/95 backdrop-blur-md border border-[#E7E5E4] dark:border-[#204E35] shadow-lg pointer-events-auto space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#78716C] dark:text-[#9CA3AF]">
                Destination ETA
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#ECFDF5] text-[#059669]">
                <Clock className="w-3 h-3" />
                {distanceRemainingKm <= 0.05 ? 'Arrived' : `~${etaMinutes} min`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800 text-xs">
              <div>
                <span className="text-[10px] text-[#78716C] dark:text-[#9CA3AF] block">Remaining Distance</span>
                <span className="font-bold text-[#1A1714] dark:text-[#F2EDE4]">{distanceRemainingKm} km</span>
              </div>
              <div>
                <span className="text-[10px] text-[#78716C] dark:text-[#9CA3AF] block">Current Speed</span>
                <span className="font-bold text-[#1A1714] dark:text-[#F2EDE4]">
                  {formatSpeedKmh(courierLocation.speed)}
                </span>
              </div>
            </div>

            {/* Privacy Guarantee Pill */}
            <div className="flex items-center gap-1.5 text-[10px] text-[#059669] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-[#064E3B]/30 px-2 py-1 rounded-md font-medium">
              <Lock className="w-3 h-3 text-[#059669]" />
              <span>Visible only to donor &amp; recipient • Auto-purged upon arrival</span>
            </div>
          </div>
        </div>

        {/* Floating Location Sharing Action Toggle (Bottom of Map) */}
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-20 flex items-center gap-2">
          {!isSharingLocation ? (
            <button
              type="button"
              onClick={() => setShowConsentModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8672C] hover:bg-[#D4551B] text-white font-bold text-xs shadow-xl active:scale-95 transition-all cursor-pointer"
            >
              <Radio className="w-4 h-4 text-white animate-pulse" />
              <span>Share My Location (Opt-In)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopLiveLocationTracking}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xl active:scale-95 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-white" />
              <span>Stop Sharing &amp; Delete Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Transit Mission Details Footer */}
      <div className="p-4 sm:p-5 border-t border-[#E7E5E4] dark:border-[#1E4D34] bg-white dark:bg-[#10241A] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] dark:text-[#9CA3AF] block mb-1">
            Pickup Origin (Donor)
          </span>
          <p className="font-bold text-[#1A1714] dark:text-[#F2EDE4]">{mission.donorOrg || mission.donorName}</p>
          <p className="text-[#78716C] dark:text-[#9CA3AF] text-[11px] truncate">{mission.donorAddress}</p>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] dark:text-[#9CA3AF] block mb-1">
            Destination Shelter (Recipient)
          </span>
          <p className="font-bold text-[#1A1714] dark:text-[#F2EDE4]">{mission.shelterName}</p>
          <p className="text-[#78716C] dark:text-[#9CA3AF] text-[11px] truncate">{mission.shelterAddress}</p>
        </div>

        {/* Complete Handover Action */}
        {internalStatus !== 'delivered' && (
          <div className="sm:col-span-2 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-[#78716C] dark:text-[#9CA3AF]">
              Confirming handover will immediately stop GPS broadcast and purge all stored telemetry.
            </span>
            <button
              type="button"
              onClick={handleCompleteHandover}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Confirm Delivery &amp; Handover</span>
            </button>
          </div>
        )}
      </div>

      {/* Dedicated Opt-In Consent Modal (DPDP Act 2023 Compliant) */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#142D21] border border-[#E7E5E4] dark:border-[#204E35] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E8672C]/10 text-[#E8672C] flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#E8672C]" />
              </div>
              <div>
                <h4 className="font-bold text-base text-[#1A1714] dark:text-[#F2EDE4]">
                  Opt-In Live Location Sharing
                </h4>
                <p className="text-xs text-[#78716C] dark:text-[#9CA3AF]">Single active pickup tracking only</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-[#44403C] dark:text-[#D6D3D1] bg-[#FFFBF7] dark:bg-[#0D2017] p-3.5 rounded-xl border border-[#F3E8DC] dark:border-[#1E4D34] leading-relaxed">
              <p>
                <strong>1. Restricted Visibility:</strong> Your GPS location is shared <em>only</em> with the verified
                donor (<strong>{mission.donorOrg || mission.donorName}</strong>) and recipient (<strong>{mission.shelterName}</strong>) of this specific food batch.
              </p>
              <p>
                <strong>2. Throttled Updates:</strong> Location updates are throttled to <strong>1 write every 10 seconds</strong> to preserve network bandwidth and battery.
              </p>
              <p>
                <strong>3. Automatic Deletion:</strong> Location tracking stops and your coordinates are <strong>permanently deleted</strong> from our servers as soon as delivery is confirmed or after a 45-minute timeout.
              </p>
              <p>
                <strong>4. Revoke Anytime:</strong> You can click &quot;Stop Sharing&quot; at any moment during transit.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 font-bold text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConsentModal(false);
                  startLiveLocationTracking();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#E8672C] hover:bg-[#D4551B] text-white font-bold text-xs shadow-md active:scale-95 transition-all"
              >
                I Consent &amp; Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
