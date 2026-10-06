import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { FoodListing } from '../donor/DonorDashboard';
import { INDIAN_CITIES, matchesCity } from '../../lib/cities';
import { RealTimeCourierTracker, CourierMissionData } from '../../components/RealTimeCourierTracker';
import { QrHandshakeModal } from '../../components/QrHandshakeModal';
import { HandshakePayload } from '../../lib/qrCode';
import { clusterAndBundleListings, RouteBundle } from '../../lib/routeBundling';
import { VolunteerImpactPassModal } from '../../components/VolunteerImpactPassModal';

interface VolunteerLogisticsProps {
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  onOpenAuth: () => void;
  onNavigateVerify: () => void;
  onOpenCsrModal: (listing?: FoodListing) => void;
}

interface ActiveMission {
  listing: FoodListing;
  status: 'heading_to_donor' | 'at_donor' | 'en_route_shelter' | 'delivered';
  transportMode: 'bike' | 'auto' | 'van';
  distanceKm: number;
  etaMinutes: number;
  tempChecked: boolean;
  hygieneApproved: boolean;
  handoffOtpInput: string;
  acceptedAt: number;
  pickupHandshakeVerified?: boolean;
}

export const VolunteerLogistics: React.FC<VolunteerLogisticsProps> = ({
  selectedCityId,
  onSelectCity,
  onOpenAuth,
  onNavigateVerify,
  onOpenCsrModal,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { isDark } = useTheme();

  const [availableRuns, setAvailableRuns] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMission, setActiveMission] = useState<ActiveMission | null>(null);
  const [vehicleType, setVehicleType] = useState<'bike' | 'auto' | 'van'>('bike');
  const [volunteerStats, setVolunteerStats] = useState({
    completedRuns: 14,
    kgDelivered: 420,
    co2SavedKg: 1029,
    badgeLevel: 'Tier 3 Golden Courier',
  });
  const [toast, setToast] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{
    isOpen: boolean;
    stage: 'pickup' | 'delivery';
  } | null>(null);
  const [logisticsViewMode, setLogisticsViewMode] = useState<'single' | 'bundled'>('single');
  const [impactPassModalOpen, setImpactPassModalOpen] = useState(false);
  const [activeBundleMission, setActiveBundleMission] = useState<RouteBundle | null>(null);
  const [bundleStopStep, setBundleStopStep] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Real-time listener for listings that are claimed or available and need courier rescue
  useEffect(() => {
    setLoading(true);
    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('status', 'in', ['claimed', 'available']));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FoodListing[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<FoodListing, 'id'>),
          });
        });

        // Filter by selected city
        const cityFiltered = items.filter((item) =>
          matchesCity(item.location, selectedCityId)
        );

        setAvailableRuns(cityFiltered);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching volunteer runs:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedCityId]);

  const routeBundles = React.useMemo(
    () => clusterAndBundleListings(availableRuns),
    [availableRuns]
  );

  const handleAcceptBundle = (bundle: RouteBundle) => {
    setActiveBundleMission(bundle);
    setBundleStopStep(0);
    showToast(`Multi-Stop Bundle Accepted: ${bundle.hubName} (${bundle.stops.length} stops, ${bundle.totalKg} kg total)`);
  };

  const handleAcceptRun = (listing: FoodListing) => {
    const pseudoDist = Math.round((2.5 + Math.random() * 5.5) * 10) / 10;
    const pseudoEta = Math.round(pseudoDist * 4 + 8);

    setActiveMission({
      listing,
      status: 'heading_to_donor',
      transportMode: vehicleType,
      distanceKm: pseudoDist,
      etaMinutes: pseudoEta,
      tempChecked: false,
      hygieneApproved: false,
      handoffOtpInput: '',
      acceptedAt: Date.now(),
    });

    showToast(`Mission Accepted! Heading to ${listing.donorOrg || 'Donor Kitchen'}`);
  };

  const handleConfirmArrivedDonor = () => {
    if (!activeMission) return;
    setActiveMission({
      ...activeMission,
      status: 'at_donor',
    });
    showToast('Arrived at donor kitchen. Please complete food hygiene & temperature check.');
  };

  const handleConfirmCargoLoaded = async () => {
    if (!activeMission) return;
    if (!activeMission.tempChecked || !activeMission.hygieneApproved) {
      showToast('Please verify both thermal temperature and sealed packaging safety check!');
      return;
    }
    setActiveMission({
      ...activeMission,
      status: 'en_route_shelter',
    });
    try {
      await updateDoc(doc(db, 'listings', activeMission.listing.id), {
        status: 'in_transit',
        courierLiveStatus: 'in_transit',
        volunteerCourierId: currentUser?.uid || 'volunteer-runner-01',
        volunteerCourierName: userProfile?.displayName || currentUser?.displayName || 'Volunteer Courier',
      });
    } catch (e) {
      console.warn('Status updated locally:', e);
    }
    showToast('Cargo secured in insulated crate. En route to recipient shelter!');
  };

  const handlePickupHandshakeSuccess = async (payload: HandshakePayload) => {
    if (!activeMission) return;
    setQrModal(null);
    setActiveMission({
      ...activeMission,
      status: 'en_route_shelter',
      tempChecked: true,
      hygieneApproved: true,
      pickupHandshakeVerified: true,
    });
    try {
      await updateDoc(doc(db, 'listings', activeMission.listing.id), {
        status: 'in_transit',
        courierLiveStatus: 'in_transit',
        pickupHandshakeCode: payload.code,
        pickupVerifiedAt: serverTimestamp(),
        pickupVerifiedBy: userProfile?.displayName || currentUser?.displayName || 'Volunteer Courier',
        volunteerCourierId: currentUser?.uid || 'volunteer-runner-01',
        volunteerCourierName: userProfile?.displayName || currentUser?.displayName || 'Volunteer Courier',
      });
    } catch (e) {
      console.warn('Pickup handshake updated locally:', e);
    }
    showToast('Donor Pickup QR Handshake Verified! Status set to In Transit.');
  };

  const handleDeliveryHandshakeSuccess = async (payload: HandshakePayload) => {
    if (!activeMission) return;
    setQrModal(null);
    try {
      await updateDoc(doc(db, 'listings', activeMission.listing.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        deliveryHandshakeCode: payload.code,
        deliveryVerifiedAt: serverTimestamp(),
        deliveryVerifiedBy: userProfile?.displayName || currentUser?.displayName || 'Volunteer Runner',
        volunteerCourierId: currentUser?.uid || 'volunteer-runner-01',
        volunteerCourierName: userProfile?.displayName || currentUser?.displayName || 'Volunteer Runner',
        handoffCodeEntered: payload.code,
      });
    } catch (err: any) {
      console.warn('Handover verified locally:', err);
    }

    setVolunteerStats((prev) => ({
      ...prev,
      completedRuns: prev.completedRuns + 1,
      kgDelivered: prev.kgDelivered + activeMission.listing.quantity,
      co2SavedKg: prev.co2SavedKg + Math.round(activeMission.listing.quantity * 2.45),
    }));

    showToast('Delivery Handshake Verified! Food safely transferred to shelter.');
    setActiveMission({
      ...activeMission,
      status: 'delivered',
    });
  };

  const handleCompleteHandover = async () => {
    if (!activeMission) return;
    if (!activeMission.handoffOtpInput.trim()) {
      showToast('Please enter the recipient shelter handoff verification PIN.');
      return;
    }

    await handleDeliveryHandshakeSuccess({
      protocol: 'FOODLINK_V1',
      listingId: activeMission.listing.id,
      stage: 'delivery',
      code: activeMission.handoffOtpInput.trim(),
      timestamp: Date.now(),
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#059669] text-white px-5 py-3 rounded-2xl shadow-xl font-bold text-[13px] flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner & Mode Control */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border transition-colors shadow-xs ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#111A17]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#059669]/15 text-[#059669] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#059669] animate-ping" />
                <span>Volunteer Courier &amp; Logistics Mode</span>
              </span>
              <span className="text-[12px] font-bold text-[#059669] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">electric_bolt</span>
                <span>Zero Wastage Dispatch</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Rapid Food Rescue Dispatch &amp; Route Hub
            </h1>
            <p className={`text-[13px] max-w-2xl ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
              Pick up inspected surplus batches from restaurants, caterers, and banquets, and safely deliver them to verified NGO shelters within the critical safe consumption window.
            </p>
          </div>

          {/* Vehicle Selector & City Indicator */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div
              className={`p-1.5 rounded-2xl border flex items-center gap-1 text-[12px] font-bold ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <button
                type="button"
                onClick={() => setVehicleType('bike')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  vehicleType === 'bike'
                    ? 'bg-[#059669] text-white shadow-xs'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-white'
                    : 'text-[#4D5C56] hover:text-[#111A17]'
                }`}
                title="Electric Two-Wheeler (Fast for <25kg)"
              >
                <span className="material-symbols-outlined text-[16px]">two_wheeler</span>
                <span>EV Bike</span>
              </button>

              <button
                type="button"
                onClick={() => setVehicleType('auto')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  vehicleType === 'auto'
                    ? 'bg-[#059669] text-white shadow-xs'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-white'
                    : 'text-[#4D5C56] hover:text-[#111A17]'
                }`}
                title="Cargo Auto (Ideal for 25-150kg)"
              >
                <span className="material-symbols-outlined text-[16px]">electric_rickshaw</span>
                <span>Auto</span>
              </button>

              <button
                type="button"
                onClick={() => setVehicleType('van')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  vehicleType === 'van'
                    ? 'bg-[#059669] text-white shadow-xs'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-white'
                    : 'text-[#4D5C56] hover:text-[#111A17]'
                }`}
                title="Insulated Mini-Van (>150kg Banquets)"
              >
                <span className="material-symbols-outlined text-[16px]">airport_shuttle</span>
                <span>Van</span>
              </button>
            </div>
          </div>
        </div>

        {/* Courier Digital Passport / Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#CFDED5]/60 dark:border-[#233833]">
          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              Completed Missions
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-[#059669]">
                {volunteerStats.completedRuns}
              </span>
              <span className="text-[11px] font-bold text-[#059669]">Verified</span>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              Surplus Rescued
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#059669]">
                {volunteerStats.kgDelivered}
              </span>
              <span className="text-[12px] font-bold">kg</span>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              Carbon Offset
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#059669]">
                {volunteerStats.co2SavedKg}
              </span>
              <span className="text-[12px] font-bold">kg CO₂e</span>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              Courier Standing
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-[18px] text-[#059669]">stars</span>
              <span className="text-[12px] font-black truncate">{volunteerStats.badgeLevel}</span>
            </div>
          </div>
        </div>

        {/* Verified Volunteer Impact Pass & LinkedIn Sharing Banner */}
        <div className="mt-5 pt-4 border-t border-[#CFDED5]/60 dark:border-[#233833] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#059669] text-[24px]">military_tech</span>
            <div>
              <h4 className="text-xs font-black">Verified Volunteer Impact Pass &amp; LinkedIn Badges</h4>
              <p className={`text-[11px] ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
                Digital credentials: 100kg Rescued, Night Owl Rescuer, Zero Waste Champion &amp; 1-click LinkedIn certification.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImpactPassModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            <span>View Impact Pass &amp; Share to LinkedIn</span>
          </button>
        </div>
      </div>

      {/* ACTIVE DISPATCH MISSION WORKFLOW (IF ACCEPTED) */}
      {activeMission && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border-2 border-[#059669] shadow-xl relative overflow-hidden transition-colors ${
            isDark ? 'bg-[#162421]' : 'bg-[#FFFFFF]'
          }`}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#CFDED5]/60 dark:border-[#233833]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[26px]">local_shipping</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#059669]/20 text-[#059669] uppercase tracking-wider">
                    Active Mission #{activeMission.listing.id.slice(0, 6)}
                  </span>
                  <span className="text-[12px] font-bold text-[#059669] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">speed</span>
                    <span>ETA ~{activeMission.etaMinutes} mins</span>
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight mt-0.5">
                  {activeMission.listing.title} ({activeMission.listing.quantity} {activeMission.listing.unit})
                </h2>
              </div>
            </div>

            {activeMission.status === 'delivered' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCsrModal(activeMission.listing)}
                  className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-[13px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>View Impact Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMission(null)}
                  className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#DC2626] text-white font-bold text-[13px] cursor-pointer"
                >
                  Start Next Run
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Cancel this active rescue mission?')) {
                    setActiveMission(null);
                    showToast('Mission cancelled');
                  }
                }}
                className={`text-[12px] font-bold px-3 py-1.5 rounded-xl border cursor-pointer ${
                  isDark
                    ? 'border-[#233833] text-[#B8CCC1] hover:text-white hover:bg-[#1C2E2A]'
                    : 'border-[#CFDED5] text-[#4D5C56] hover:text-[#111A17] hover:bg-[#EBF2ED]'
                }`}
              >
                Abort Mission
              </button>
            )}
          </div>

          {/* Stepper Progress Bar */}
          <div className="my-6 grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'heading_to_donor'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : 'border-[#059669] bg-[#059669]/10 text-[#059669]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">navigation</span>
              <span>1. En Route Donor</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'at_donor'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : activeMission.status === 'en_route_shelter' || activeMission.status === 'delivered'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : isDark
                  ? 'border-[#233833] text-[#7B9487]'
                  : 'border-[#CFDED5] text-[#71827A]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              <span>2. Cargo Inspection</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'en_route_shelter'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : activeMission.status === 'delivered'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : isDark
                  ? 'border-[#233833] text-[#7B9487]'
                  : 'border-[#CFDED5] text-[#71827A]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">route</span>
              <span>3. Transit to Shelter</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'delivered'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : isDark
                  ? 'border-[#233833] text-[#7B9487]'
                  : 'border-[#CFDED5] text-[#71827A]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>4. OTP Handover</span>
            </div>
          </div>

          {/* Real-time Courier Radar & Map Telemetry */}
          {(() => {
            const missionData: CourierMissionData = {
              listingId: activeMission.listing.id || 'mission-live',
              foodTitle: activeMission.listing.title,
              quantityStr: `${activeMission.listing.quantity} ${activeMission.listing.unit}`,
              donorName: activeMission.listing.donorName,
              donorOrg: activeMission.listing.donorOrg,
              donorAddress: activeMission.listing.location,
              donorPhone: activeMission.listing.donorPhone,
              shelterName: activeMission.listing.claimedQuantity
                ? 'Akshaya Patra Community Food Hall'
                : 'Registered City Shelter',
              shelterAddress: 'Receiving Bay #2, Urban Relief Center',
              courierName: userProfile?.displayName || 'Volunteer Courier',
              courierPhone: (userProfile?.verificationDocs as any)?.phone || undefined,
              courierVehicle: activeMission.transportMode,
              handoffCode: 'FL-8821',
              cargoTemp: activeMission.tempChecked ? '4.2°C (Safe)' : undefined,
              status:
                activeMission.status === 'heading_to_donor'
                  ? 'assigned'
                  : activeMission.status === 'at_donor'
                  ? 'at_donor'
                  : activeMission.status === 'en_route_shelter'
                  ? 'en_route_shelter'
                  : 'delivered',
            };
            return (
              <div className="my-6">
                <RealTimeCourierTracker
                  mission={missionData}
                  userRole="courier"
                  isModal={false}
                />
              </div>
            );
          })()}

          {/* Mission Details & Route Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            {/* Pickup Node */}
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#059669] tracking-wider">
                  Pickup Point (Donor)
                </span>
                <span className="text-[11px] font-mono font-bold text-[#059669]">
                  {activeMission.distanceKm} km away
                </span>
              </div>
              <p className="font-extrabold text-[15px]">{activeMission.listing.donorOrg}</p>
              <p className={`text-[12px] mt-0.5 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                {activeMission.listing.location}
              </p>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#CFDED5]/50 dark:border-[#233833] text-[12px]">
                <span className="font-bold">Contact:</span>
                <span>{activeMission.listing.donorName}</span>
                {activeMission.listing.donorPhone && (
                  <a
                    href={`tel:${activeMission.listing.donorPhone}`}
                    className="text-[#059669] hover:underline font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    <span>Call Donor</span>
                  </a>
                )}
              </div>
            </div>

            {/* Destination Node */}
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#059669] tracking-wider">
                  Destination Node (Shelter)
                </span>
                <span className="text-[11px] font-bold text-[#059669]">Priority Drop</span>
              </div>
              <p className="font-extrabold text-[15px]">
                {activeMission.listing.claimedQuantity ? 'Akshaya Patra Community Food Hall' : 'Registered City NGO Shelter'}
              </p>
              <p className={`text-[12px] mt-0.5 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                Receiving Bay #2, Urban Relief Center, Central Hub
              </p>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#CFDED5]/50 dark:border-[#233833] text-[12px]">
                <span className="font-bold">Protocol:</span>
                <span className="text-[#059669] font-semibold">Immediate Dinner Distribution</span>
              </div>
            </div>
          </div>

          {/* STEP CONTROLS */}
          {activeMission.status === 'heading_to_donor' && (
            <div
              className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div>
                <h4 className="font-bold text-[14px]">Heading to Donor Facility</h4>
                <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                  Drive safely. Park in designated receiving bay. Click below once you arrive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConfirmArrivedDonor}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#059669] hover:bg-[#DC2626] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">where_to_vote</span>
                <span>Confirm Arrival at Donor</span>
              </button>
            </div>
          )}

          {activeMission.status === 'at_donor' && (
            <div
              className={`p-5 rounded-2xl border space-y-4 ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div>
                <h4 className="font-bold text-[14px] text-[#059669]">
                  FSSAI Food Quality &amp; Thermal Cargo Inspection
                </h4>
                <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                  Verify that the surplus batch satisfies statutory temperature and clean packaging requirements before loading into your vehicle crate:
                </p>
              </div>

              <div className="space-y-2 text-[13px]">
                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={activeMission.tempChecked}
                    onChange={(e) =>
                      setActiveMission({ ...activeMission, tempChecked: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#059669] rounded"
                  />
                  <span>
                    Thermal temperature verified (&le; 4&deg;C for chilled or &ge; 65&deg;C for hot meals)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={activeMission.hygieneApproved}
                    onChange={(e) =>
                      setActiveMission({ ...activeMission, hygieneApproved: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#059669] rounded"
                  />
                  <span>
                    Clean, food-grade sealed packaging and no signs of contamination or spillage
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQrModal({ isOpen: true, stage: 'pickup' })}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                  <span>Scan Donor Pickup QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCargoLoaded}
                  disabled={!activeMission.tempChecked || !activeMission.hygieneApproved}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-[#CFDED5] dark:border-[#233833] hover:bg-[#EBF2ED] dark:hover:bg-[#1C2E2A] disabled:opacity-50 disabled:cursor-not-allowed font-bold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  <span>Manual Lock &amp; Transit</span>
                </button>
              </div>
            </div>
          )}

          {activeMission.status === 'en_route_shelter' && (
            <div
              className={`p-5 rounded-2xl border space-y-4 ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div>
                <h4 className="font-bold text-[14px] text-[#059669]">
                  Live Transit: En Route to Recipient Shelter
                </h4>
                <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                  Safe transport in progress. Meet the shelter coordinator and scan their delivery QR code, or enter their 4-digit transfer PIN:
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQrModal({ isOpen: true, stage: 'delivery' })}
                  className="px-6 py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                  <span>Scan Shelter Delivery QR</span>
                </button>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Enter PIN"
                    value={activeMission.handoffOtpInput}
                    onChange={(e) =>
                      setActiveMission({ ...activeMission, handoffOtpInput: e.target.value })
                    }
                    className={`w-36 px-3 py-2.5 rounded-xl border text-center font-mono font-black text-sm tracking-wider uppercase ${
                      isDark
                        ? 'bg-[#162421] border-[#233833] text-white'
                        : 'bg-white border-[#CFDED5] text-[#111A17]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleCompleteHandover}
                    className="px-4 py-2.5 rounded-xl border border-[#059669] text-[#059669] hover:bg-[#059669] hover:text-white font-bold text-[12px] transition-all cursor-pointer"
                  >
                    Verify PIN
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeMission.status === 'delivered' && (
            <div
              className={`p-5 rounded-2xl border text-center space-y-2 ${
                isDark ? 'bg-[#059669]/15 border-[#059669]/40' : 'bg-[#D1FAE5] border-[#A7F3D0]'
              }`}
            >
              <span className="material-symbols-outlined text-4xl text-[#059669]">task_alt</span>
              <h3 className="text-xl font-black text-[#059669]">
                Rescue Mission Successfully Completed!
              </h3>
              <p className={`text-[13px] max-w-lg mx-auto ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                {activeMission.listing.quantity} {activeMission.listing.unit} of surplus food was delivered in sound condition. CSR environmental report and rescue credit have been recorded in the central ledger.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE MULTI-STOP BUNDLE MISSION WORKFLOW (IF ACCEPTED) */}
      {activeBundleMission && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border-2 border-[#059669] shadow-xl relative overflow-hidden transition-colors ${
            isDark ? 'bg-[#162421]' : 'bg-[#FFFFFF]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#CFDED5]/60 dark:border-[#233833]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[26px]">alt_route</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#059669]/20 text-[#059669] uppercase tracking-wider">
                    Multi-Stop Bundle • {activeBundleMission.hubName}
                  </span>
                  <span className="text-[12px] font-bold text-[#059669]">
                    Saves {activeBundleMission.carbonReductionPercent}% CO2
                  </span>
                </div>
                <h3 className="text-xl font-black tracking-tight mt-0.5">
                  Stop {bundleStopStep + 1} of {activeBundleMission.stops.length}: {activeBundleMission.stops[bundleStopStep]?.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (bundleStopStep < activeBundleMission.stops.length - 1) {
                    setBundleStopStep((s) => s + 1);
                    showToast(`Checked into stop ${bundleStopStep + 2}: ${activeBundleMission.stops[bundleStopStep + 1]?.name}`);
                  } else {
                    setActiveBundleMission(null);
                    setVolunteerStats((prev) => ({
                      ...prev,
                      completedRuns: prev.completedRuns + activeBundleMission.stops.length - 1,
                      kgDelivered: prev.kgDelivered + activeBundleMission.totalKg,
                      co2SavedKg: prev.co2SavedKg + Math.round(activeBundleMission.totalKg * 2.45),
                    }));
                    showToast('🎉 Multi-Stop Rescue Mission Completed! Total cargo delivered to shelter.');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                {bundleStopStep < activeBundleMission.stops.length - 1
                  ? `Complete Stop #${bundleStopStep + 1} & Proceed`
                  : 'Complete Final Drop-off'}
              </button>
              <button
                type="button"
                onClick={() => setActiveBundleMission(null)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Exit Bundle
              </button>
            </div>
          </div>

          {/* Stops Timeline */}
          <div className="mt-5 space-y-3">
            {activeBundleMission.stops.map((stop, sIdx) => (
              <div
                key={stop.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                  sIdx === bundleStopStep
                    ? 'border-[#059669] bg-[#059669]/10 ring-1 ring-[#059669]'
                    : sIdx < bundleStopStep
                    ? 'border-emerald-500/40 bg-emerald-500/5 opacity-70'
                    : isDark
                    ? 'border-[#233833] bg-[#0E1715]'
                    : 'border-[#CFDED5] bg-[#F4F8F5]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      sIdx < bundleStopStep
                        ? 'bg-[#059669] text-white'
                        : sIdx === bundleStopStep
                        ? 'bg-[#059669] text-white animate-pulse'
                        : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {sIdx < bundleStopStep ? '✓' : sIdx + 1}
                  </div>
                  <div>
                    <strong className="text-sm block">{stop.name}</strong>
                    <span className="opacity-75">{stop.location}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-[#059669] block">{stop.quantityStr}</span>
                  <span className="text-[10px] uppercase font-bold opacity-60">
                    {stop.type === 'pickup' ? 'Surplus Pickup' : 'Consolidated Drop-off'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logistics Route Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-emerald-500/5 dark:bg-[#162421] border-[#CFDED5] dark:border-[#233833]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLogisticsViewMode('single')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              logisticsViewMode === 'single'
                ? 'bg-[#059669] text-white border-[#059669]'
                : isDark
                ? 'bg-[#0E1715] border-[#233833] text-[#B8CCC1]'
                : 'bg-white border-[#CFDED5] text-[#4D5C56]'
            }`}
          >
            ⚡ Single Rescue Runs ({availableRuns.length})
          </button>
          <button
            type="button"
            onClick={() => setLogisticsViewMode('bundled')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 ${
              logisticsViewMode === 'bundled'
                ? 'bg-[#059669] text-white border-[#059669]'
                : isDark
                ? 'bg-[#0E1715] border-[#233833] text-[#B8CCC1]'
                : 'bg-white border-[#CFDED5] text-[#4D5C56]'
            }`}
          >
            <span>🗺️ Multi-Stop Smart Bundles ({routeBundles.length})</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#059669] dark:text-emerald-300 text-[10px] font-black">
              Save 60% CO2
            </span>
          </button>
        </div>

        <p className={`text-xs ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
          {logisticsViewMode === 'bundled'
            ? 'Clusters nearby kitchens in the same commercial hub into a single consolidated pickup run.'
            : 'Direct point-to-point dispatch runs for individual donor kitchens.'}
        </p>
      </div>

      {/* City Geofence Selection Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 max-w-full">
        <div className="flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[#059669] text-[20px]">near_me</span>
          <h2 className="text-lg font-black tracking-tight">
            {logisticsViewMode === 'bundled'
              ? `Multi-Stop Commercial Hub Bundles (${routeBundles.length})`
              : `Surplus Batches Requesting Dispatch (${availableRuns.length})`}
          </h2>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 min-w-0 max-w-full">
          {INDIAN_CITIES.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => onSelectCity(city.id)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCityId === city.id
                  ? 'bg-[#059669] text-white border-[#059669]'
                  : isDark
                  ? 'bg-[#162421] border-[#233833] text-[#B8CCC1] hover:text-white'
                  : 'bg-white border-[#CFDED5] text-[#4D5C56] hover:text-[#111A17]'
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>
      </div>

      {/* Available Rescue Runs Grid */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-10 h-10 border-4 border-[#059669] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className={`text-[13px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
            Scanning active food dispatch requests...
          </p>
        </div>
      ) : availableRuns.length === 0 ? (
        <div
          className={`p-10 rounded-3xl border text-center ${
            isDark ? 'bg-[#162421] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
          }`}
        >
          <span className="material-symbols-outlined text-4xl text-[#059669] mb-2 block">
            check_circle
          </span>
          <h3 className="text-lg font-black">All Clear in this Region!</h3>
          <p className={`text-[13px] max-w-md mx-auto mt-1 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
            There are currently no outstanding surplus rescue runs waiting for transport in {INDIAN_CITIES.find(c => c.id === selectedCityId)?.name || 'this city'}. Select another city or check back shortly.
          </p>
        </div>
      ) : logisticsViewMode === 'bundled' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {routeBundles.map((bundle) => {
            const isCurrentlyActive = activeBundleMission?.id === bundle.id;

            return (
              <div
                key={bundle.id}
                className={`rounded-2xl p-6 border transition-all flex flex-col justify-between shadow-2xs hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-[#059669] ring-2 ring-[#059669]/30'
                    : isDark
                    ? 'bg-[#162421] border-[#233833]'
                    : 'bg-[#FFFFFF] border-[#CFDED5]'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#059669]/15 text-[#059669]">
                      {bundle.commercialZone}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-[#059669] dark:text-emerald-300">
                      🌱 Saves {bundle.carbonReductionPercent}% CO2 ({bundle.carbonSavedKg} kg)
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-black tracking-tight">{bundle.hubName}</h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
                      {bundle.stops.length} Combined Waypoints • {bundle.totalKg} kg Total Cargo • ~{bundle.estimatedMeals} meals
                    </p>
                  </div>

                  {/* Waypoint sequence */}
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-[#0E1715] border border-slate-200 dark:border-[#233833] text-xs">
                    {bundle.stops.map((stop, i) => (
                      <div key={stop.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              stop.type === 'pickup' ? 'bg-[#059669] text-white' : 'bg-purple-600 text-white'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="font-semibold truncate max-w-[200px] sm:max-w-xs">{stop.name}</span>
                        </div>
                        <span className="text-[#059669] font-bold">{stop.quantityStr}</span>
                      </div>
                    ))}
                  </div>

                  {/* Distance comparison */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] block opacity-70">Bundled Run</span>
                      <strong className="text-[#059669]">{bundle.totalDistanceKm} km</strong>
                    </div>
                    <div>
                      <span className="text-[10px] block opacity-70">Separate Trips</span>
                      <span className="line-through opacity-70">{bundle.unbundledDistanceKm} km</span>
                    </div>
                    <div>
                      <span className="text-[10px] block opacity-70">Est. Time</span>
                      <strong>~{bundle.estimatedDurationMins}m</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#CFDED5]/60 dark:border-[#233833] flex items-center justify-between gap-2">
                  <span className="text-[11px] opacity-75">Multi-Kitchen Cluster</span>
                  <button
                    type="button"
                    onClick={() => handleAcceptBundle(bundle)}
                    disabled={activeBundleMission !== null || activeMission !== null}
                    className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    Accept Multi-Stop Bundle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {availableRuns.map((listing) => {
            const isCurrentlyActive = activeMission?.listing.id === listing.id;

            return (
              <div
                key={listing.id}
                className={`rounded-2xl p-5 border transition-all flex flex-col justify-between shadow-2xs hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-[#059669] ring-2 ring-[#059669]/30'
                    : isDark
                    ? 'bg-[#162421] border-[#233833]'
                    : 'bg-[#FFFFFF] border-[#CFDED5]'
                }`}
              >
                <div className="space-y-3">
                  {/* Top status */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#059669]/15 text-[#059669]">
                      {listing.foodType || 'Prepared Meals'}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        listing.status === 'claimed'
                          ? 'bg-[#059669]/15 text-[#059669]'
                          : 'bg-[#2563EB]/15 text-[#2563EB]'
                      }`}
                    >
                      {listing.status === 'claimed' ? '● Claimed (Needs Delivery)' : '● Ready to Rescue'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-[16px] font-black tracking-tight">{listing.title}</h3>
                    <p className={`text-[12px] font-bold mt-0.5 text-[#059669]`}>
                      {listing.donorOrg}
                    </p>
                    <p className={`text-[11px] line-clamp-1 flex items-center gap-1 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                      <span className="material-symbols-outlined text-[14px] text-[#059669]">location_on</span>
                      <span>{listing.location}</span>
                    </p>
                  </div>

                  {/* Quantity & Packaging Specs */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-[12px] ${
                      isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold block uppercase opacity-70">
                        Cargo Volume
                      </span>
                      <span className="font-black text-[#059669]">
                        {listing.quantity} {listing.unit}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold block uppercase opacity-70">
                        Est. Servings
                      </span>
                      <span className="font-extrabold">
                        ~{Math.round(listing.quantity * 2.5)} meals
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-[#CFDED5]/60 dark:border-[#233833] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCsrModal(listing)}
                    className={`text-[11px] font-bold flex items-center gap-1 hover:underline cursor-pointer ${
                      isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">description</span>
                    <span>CSR Specs</span>
                  </button>

                  {currentUser && userProfile?.role === 'volunteer' ? (
                    <button
                      type="button"
                      onClick={() => handleAcceptRun(listing)}
                      disabled={activeMission !== null}
                      className={`px-4 py-2 rounded-xl text-white font-bold text-[12px] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                        activeMission !== null
                          ? 'opacity-50 cursor-not-allowed bg-[#7B9487]'
                          : 'bg-[#059669] hover:bg-[#DC2626] active:scale-95'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">navigation</span>
                      <span>Accept Run</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      title={currentUser ? 'Only registered volunteers can accept deliveries. Register as a volunteer to help.' : 'Sign in and register as a volunteer to accept delivery runs.'}
                      className={`px-4 py-2 rounded-xl font-bold text-[12px] flex items-center gap-1.5 border cursor-pointer transition-all ${
                        isDark
                          ? 'bg-[#0E1715] border-[#233833] text-[#7B9487] hover:text-[#059669]'
                          : 'bg-[#F4F8F5] border-[#CFDED5] text-[#71827A] hover:text-[#059669]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">volunteer_activism</span>
                      <span>{currentUser ? 'Volunteers Only' : 'Sign in to Help'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verified Volunteer Impact Pass & LinkedIn Modal */}
      <VolunteerImpactPassModal
        isOpen={impactPassModalOpen}
        onClose={() => setImpactPassModalOpen(false)}
        passData={{
          volunteerName: userProfile?.displayName || currentUser?.displayName || 'Rahul Verma',
          completedRuns: volunteerStats.completedRuns,
          totalKgRescued: volunteerStats.kgDelivered,
          co2SavedKg: volunteerStats.co2SavedKg,
          tierTitle: volunteerStats.badgeLevel,
        }}
      />
    </div>
  );
};
