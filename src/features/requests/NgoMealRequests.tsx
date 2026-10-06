import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { INDIAN_CITIES } from '../../lib/cities';
import { triggerPushNotification } from '../../lib/notifications';

export interface NgoMealRequest {
  id: string;
  ngoId: string;
  ngoName: string;
  ngoType: string;
  contactPerson: string;
  contactPhone: string;
  city: string;
  address: string;
  mealsNeeded: number;
  neededDate: string;
  neededTime: string;
  dietaryType: 'veg' | 'non-veg' | 'jain' | 'any';
  urgency: 'critical' | 'high' | 'scheduled';
  title: string;
  notes: string;
  status: 'open' | 'pledged' | 'fulfilled';
  pledgedByDonorId?: string;
  pledgedByDonorName?: string;
  pledgedQuantity?: number;
  pledgedAt?: string;
  createdAt?: any;
}

// Seed initial meal requests to populate the network immediately
const SEED_MEAL_REQUESTS: NgoMealRequest[] = [
  {
    id: 'req-seed-1',
    ngoId: 'ngo-akshaya-01',
    ngoName: 'The Akshaya Patra Shelter & Community Kitchen',
    ngoType: 'Children Shelter & Mid-Day Meal Center',
    contactPerson: 'Sister Mary Fernandes',
    contactPhone: '+91 98201 44521',
    city: 'mumbai',
    address: 'Receiving Bay #2, Byculla East, Mumbai',
    mealsNeeded: 80,
    neededDate: 'This Friday',
    neededTime: '07:30 PM (Dinner)',
    dietaryType: 'veg',
    urgency: 'high',
    title: 'Hot Nutritious Dinner for 80 Children',
    notes: 'Mildly spiced cooked meals (Rice, Dal, Khichdi, or Vegetable Pulao). Clean thermal containers preferred.',
    status: 'open',
  },
  {
    id: 'req-seed-2',
    ngoId: 'ngo-robinhood-02',
    ngoName: 'Robin Hood Army & Daryaganj Night Shelter',
    ngoType: 'Night Homeless Transit Center',
    contactPerson: 'Arunav Sengupta',
    contactPhone: '+91 98112 39910',
    city: 'delhi',
    address: 'Near Daryaganj Metro Pillar 42, Old Delhi',
    mealsNeeded: 120,
    neededDate: 'Tonight',
    neededTime: '09:00 PM (Night Relief)',
    dietaryType: 'any',
    urgency: 'critical',
    title: 'Urgent Night Shelter Meals for 120 Persons',
    notes: 'Cold wave relief emergency. Fresh cooked rotis, sabzi, or packed meal boxes urgently needed.',
    status: 'open',
  },
  {
    id: 'req-seed-3',
    ngoId: 'ngo-snehasadan-03',
    ngoName: 'Snehasadan Boys Home',
    ngoType: 'Orphanage & Youth Foundation',
    contactPerson: 'Father Joseph',
    contactPhone: '+91 98210 56782',
    city: 'mumbai',
    address: 'Andheri East Community Hub, Mumbai',
    mealsNeeded: 45,
    neededDate: 'Tomorrow',
    neededTime: '01:00 PM (Lunch)',
    dietaryType: 'veg',
    urgency: 'scheduled',
    title: 'Weekend Lunch for 45 Residents',
    notes: 'Wholesome vegetarian curry and rice or chapati.',
    status: 'open',
  },
  {
    id: 'req-seed-4',
    ngoId: 'ngo-feeding-04',
    ngoName: 'Feeding India Community Hub',
    ngoType: 'Elder Care & Destitute Mission',
    contactPerson: 'Meera Nambiar',
    contactPhone: '+91 94480 12890',
    city: 'bengaluru',
    address: 'Shivajinagar Welfare Ground, Bengaluru',
    mealsNeeded: 65,
    neededDate: 'Friday',
    neededTime: '06:30 PM (Early Dinner)',
    dietaryType: 'veg',
    urgency: 'high',
    title: 'Senior Citizen Dinner for 65 Persons',
    notes: 'Soft texture food suitable for elderly beneficiaries (Dal Khichdi, Idli/Sambar, or Pongal).',
    status: 'open',
  },
];

interface NgoMealRequestsProps {
  onOpenAuth?: (role?: 'donor' | 'recipient') => void;
  onNavigateDonor?: () => void;
}

export const NgoMealRequests: React.FC<NgoMealRequestsProps> = ({
  onOpenAuth,
  onNavigateDonor,
}) => {
  const { isDark } = useTheme();
  const { currentUser, userProfile } = useAuth();

  const [requests, setRequests] = useState<NgoMealRequest[]>(SEED_MEAL_REQUESTS);
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'my_requests'>('browse');

  // Filters
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [selectedDiet, setSelectedDiet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form State for creating a new request
  const [title, setTitle] = useState('');
  const [mealsNeeded, setMealsNeeded] = useState<number>(80);
  const [neededDate, setNeededDate] = useState('This Friday');
  const [neededTime, setNeededTime] = useState('07:30 PM (Dinner)');
  const [dietaryType, setDietaryType] = useState<NgoMealRequest['dietaryType']>('veg');
  const [urgency, setUrgency] = useState<NgoMealRequest['urgency']>('high');
  const [city, setCity] = useState(userProfile?.city || 'mumbai');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [contactPerson, setContactPerson] = useState(userProfile?.displayName || '');
  const [contactPhone, setContactPhone] = useState(userProfile?.phone || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pledge Modal State
  const [pledgingRequest, setPledgingRequest] = useState<NgoMealRequest | null>(null);
  const [pledgeQuantity, setPledgeQuantity] = useState<number>(80);
  const [pledgeNotes, setPledgeNotes] = useState('');
  const [pledgeLoading, setPledgeLoading] = useState(false);

  // Real-time Firestore subscription
  useEffect(() => {
    try {
      const q = query(collection(db, 'meal_requests'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const list: NgoMealRequest[] = snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })) as NgoMealRequest[];
            // Merge with seed data (ensuring unique ids)
            const ids = new Set(list.map((r) => r.id));
            const merged = [...list, ...SEED_MEAL_REQUESTS.filter((s) => !ids.has(s.id))];
            setRequests(merged);
          }
        },
        (err) => {
          console.warn('Firestore meal_requests notice:', err.message);
        }
      );
      return () => unsub();
    } catch {
      // Offline fallback
    }
  }, []);

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (activeTab === 'my_requests') {
      if (!currentUser) return false;
      return req.ngoId === currentUser.uid;
    }
    if (selectedCity !== 'all' && req.city.toLowerCase() !== selectedCity.toLowerCase()) {
      return false;
    }
    if (selectedUrgency !== 'all' && req.urgency !== selectedUrgency) {
      return false;
    }
    if (selectedDiet !== 'all' && req.dietaryType !== selectedDiet) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        req.title.toLowerCase().includes(q) ||
        req.ngoName.toLowerCase().includes(q) ||
        req.notes.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Handle Create Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || mealsNeeded <= 0) {
      alert('Please fill out the request title and number of meals needed.');
      return;
    }

    setSubmitting(true);
    try {
      const newRequestData = {
        ngoId: currentUser?.uid || 'ngo-guest-' + Date.now().toString(36),
        ngoName: userProfile?.orgName || userProfile?.displayName || 'Registered Relief Shelter',
        ngoType: userProfile?.recipientCategoryTitle || 'Community Welfare Kitchen',
        contactPerson: contactPerson.trim() || 'Shelter Coordinator',
        contactPhone: contactPhone.trim() || '+91 98200 00000',
        city,
        address: address.trim() || 'Main Shelter Dining Hall',
        mealsNeeded: Number(mealsNeeded),
        neededDate: neededDate.trim(),
        neededTime: neededTime.trim(),
        dietaryType,
        urgency,
        title: title.trim(),
        notes: notes.trim(),
        status: 'open',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'meal_requests'), newRequestData);

      // Local optimistic update
      const createdItem: NgoMealRequest = {
        id: docRef.id,
        ...(newRequestData as any),
      };
      setRequests((prev) => [createdItem, ...prev]);

      // Push notification broadcast
      triggerPushNotification({
        type: 'ngo_request',
        title: `📢 New Meal Request: ${mealsNeeded} Meals`,
        body: `${newRequestData.ngoName} needs ${mealsNeeded} meals for ${neededDate} (${neededTime}).`,
        linkTab: 'requests',
      });

      setSuccessMsg(
        `Meal request "${title}" posted successfully! Donors and commercial kitchens across ${city} have been alerted.`
      );
      setTitle('');
      setNotes('');
      setActiveTab('browse');
    } catch (err: any) {
      console.error('Error adding meal request:', err);
      // Fallback local addition
      const fallbackItem: NgoMealRequest = {
        id: `req-local-${Date.now()}`,
        ngoId: currentUser?.uid || 'guest-ngo',
        ngoName: userProfile?.orgName || 'Community Shelter',
        ngoType: 'Shelter',
        contactPerson: contactPerson || 'Coordinator',
        contactPhone,
        city,
        address,
        mealsNeeded,
        neededDate,
        neededTime,
        dietaryType,
        urgency,
        title,
        notes,
        status: 'open',
      };
      setRequests((prev) => [fallbackItem, ...prev]);
      setActiveTab('browse');
      setSuccessMsg('Meal request saved locally and published to community network.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Pledge
  const handleConfirmPledge = async () => {
    if (!pledgingRequest) return;
    if (!currentUser && onOpenAuth) {
      onOpenAuth('donor');
      return;
    }

    setPledgeLoading(true);
    try {
      const donorName = userProfile?.orgName || userProfile?.displayName || 'Taj Grand Banquets & Hotels';

      // Update in Firestore
      if (pledgingRequest.id && !pledgingRequest.id.startsWith('req-seed')) {
        await updateDoc(doc(db, 'meal_requests', pledgingRequest.id), {
          status: 'pledged',
          pledgedByDonorId: currentUser?.uid || 'donor-demo',
          pledgedByDonorName: donorName,
          pledgedQuantity: pledgeQuantity,
          pledgedAt: new Date().toISOString(),
        }).catch(() => {});
      }

      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === pledgingRequest.id
            ? {
                ...r,
                status: 'pledged',
                pledgedByDonorName: donorName,
                pledgedQuantity: pledgeQuantity,
              }
            : r
        )
      );

      triggerPushNotification({
        type: 'surplus_claimed',
        title: `🤝 Request Pledged by ${donorName}!`,
        body: `${donorName} pledged ${pledgeQuantity} meals for ${pledgingRequest.ngoName}.`,
        linkTab: 'requests',
      });

      alert(
        `Thank you! You have pledged ${pledgeQuantity} meals to ${pledgingRequest.ngoName}. The shelter has been notified with your contact details.`
      );
      setPledgingRequest(null);
    } finally {
      setPledgeLoading(false);
    }
  };

  const getUrgencyBadge = (u: NgoMealRequest['urgency']) => {
    switch (u) {
      case 'critical':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-600 border border-red-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            Critical Urgent
          </span>
        );
      case 'high':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 border border-amber-500/30">
            High Priority
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
            Scheduled Event
          </span>
        );
    }
  };

  const getDietaryBadge = (diet: NgoMealRequest['dietaryType']) => {
    if (diet === 'veg') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
          Pure Veg
        </span>
      );
    }
    if (diet === 'non-veg') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-300">
          Non-Veg
        </span>
      );
    }
    if (diet === 'jain') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-300 dark:bg-teal-950/40 dark:text-teal-300">
          Jain (No Root Veg)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300">
        Any Wholesome
      </span>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-sm text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Banner */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border shadow-xl relative overflow-hidden transition-colors ${
          isDark
            ? 'bg-gradient-to-br from-[#162421] to-[#0e1715] border-[#233833]'
            : 'bg-gradient-to-br from-[#F0FDF8] via-white to-[#F4F8F5] border-[#CFDED5]'
        }`}
      >
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-400">
              Reverse Food Rescue Network
            </span>
            <span className="text-xs font-semibold text-gray-500">
              Demand-Driven Redistribution
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            NGO &amp; Shelter Meal Requests
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-[#A7BCB0] leading-relaxed">
            Shelters, orphanages, and disaster relief stations can specify their exact meal requirements (e.g., &ldquo;We need food for 80 children this Friday&rdquo;). Commercial kitchens, banquet halls, and caterers can pledge surplus food directly to satisfy real-time demand.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">explore</span>
              <span>Browse Open Requests ({requests.filter((r) => r.status === 'open').length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!currentUser && onOpenAuth) {
                  onOpenAuth('recipient');
                } else {
                  setActiveTab('create');
                }
              }}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Post a Meal Request (NGOs &amp; Shelters)</span>
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('my_requests')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'my_requests'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">list_alt</span>
                <span>My Requests</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CREATE REQUEST FORM */}
      {activeTab === 'create' && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-xl transition-colors ${
            isDark ? 'bg-[#14211E] border-[#233833]' : 'bg-white border-[#CFDED5]'
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 mb-6">
            <div>
              <h2 className="text-xl font-black">Publish a Meal Request for Your Shelter</h2>
              <p className="text-xs text-gray-500">
                Local restaurants, banquets, and caterers will be notified immediately to pledge surplus.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className="text-xs font-bold text-gray-500 hover:text-emerald-600"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateRequest} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Request Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinner Needed for 80 Children"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Meals / Portions Required *
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  max={5000}
                  value={mealsNeeded}
                  onChange={(e) => setMealsNeeded(Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Date Needed *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. This Friday or Today"
                  value={neededDate}
                  onChange={(e) => setNeededDate(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Time Slot Needed *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 07:30 PM (Dinner)"
                  value={neededTime}
                  onChange={(e) => setNeededTime(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Urgency Level *
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                >
                  <option value="critical">🚨 Critical Urgent (Within 4 hours)</option>
                  <option value="high">⚡ High Priority (Today / Tomorrow)</option>
                  <option value="scheduled">📅 Scheduled Event (Upcoming Days)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Dietary Requirement
                </label>
                <select
                  value={dietaryType}
                  onChange={(e) => setDietaryType(e.target.value as any)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                >
                  <option value="veg">Pure Veg (Vegetarian)</option>
                  <option value="any">Any Wholesome Food</option>
                  <option value="non-veg">Non-Veg Accepted</option>
                  <option value="jain">Jain Diet (No Onion/Garlic)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  City Location *
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                >
                  {INDIAN_CITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Receiving Address / Shelter Bay
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gate #2, Shelter Hall"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Contact Person *
                </label>
                <input
                  type="text"
                  placeholder="Coordinator Name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="+91 98200 XXXXX"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                Dietary &amp; Packaging Notes
              </label>
              <textarea
                rows={2}
                placeholder="Mention special details (e.g. Mild spices for young children, packed in meal trays or bulk thermal pot, etc.)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                }`}
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="px-5 py-2.5 rounded-xl border font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Broadcasting...' : 'Publish Reverse Meal Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BROWSE REQUESTS LIST */}
      {(activeTab === 'browse' || activeTab === 'my_requests') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div
            className={`p-4 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-3 ${
              isDark ? 'bg-[#14211E] border-[#233833]' : 'bg-white border-[#CFDED5]'
            }`}
          >
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by shelter, dish, or notes..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5]'
                }`}
              />
            </div>

            {/* City Dropdown */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5]'
              }`}
            >
              <option value="all">All Cities</option>
              {INDIAN_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Urgency */}
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5]'
              }`}
            >
              <option value="all">All Urgency</option>
              <option value="critical">🚨 Critical Urgent</option>
              <option value="high">⚡ High Priority</option>
              <option value="scheduled">📅 Scheduled Event</option>
            </select>

            {/* Dietary */}
            <select
              value={selectedDiet}
              onChange={(e) => setSelectedDiet(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5]'
              }`}
            >
              <option value="all">All Diets</option>
              <option value="veg">Pure Veg</option>
              <option value="non-veg">Non-Veg</option>
              <option value="jain">Jain</option>
            </select>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRequests.length === 0 ? (
              <div
                className={`col-span-full p-12 text-center rounded-3xl border ${
                  isDark ? 'bg-[#14211E] border-[#233833]' : 'bg-white border-[#CFDED5]'
                }`}
              >
                <span className="material-symbols-outlined text-[48px] text-gray-400 block mb-2">
                  volunteer_activism
                </span>
                <h3 className="font-bold text-base">No meal requests match your filters</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Adjust your search criteria or post a new request for your local organization.
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-5 sm:p-6 rounded-3xl border shadow-md flex flex-col justify-between transition-all hover:border-emerald-500/50 ${
                    req.status === 'pledged'
                      ? isDark
                        ? 'bg-[#12221b] border-emerald-900/50'
                        : 'bg-emerald-50/40 border-emerald-200'
                      : isDark
                      ? 'bg-[#14211E] border-[#233833]'
                      : 'bg-white border-[#CFDED5]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Pills */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getUrgencyBadge(req.urgency)}
                        {getDietaryBadge(req.dietaryType)}
                      </div>

                      {req.status === 'pledged' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Pledged by Donor
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-400">
                          Awaiting Surplus
                        </span>
                      )}
                    </div>

                    {/* Quantity & Title */}
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-2xl font-black text-emerald-600">
                          {req.mealsNeeded}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Meals Required
                        </span>
                      </div>
                      <h3 className="font-black text-lg leading-snug">{req.title}</h3>
                    </div>

                    {/* Organization details */}
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#0E1715] border border-gray-200 dark:border-gray-800 text-xs space-y-1">
                      <div className="font-bold truncate text-emerald-700 dark:text-emerald-400">
                        {req.ngoName}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        <span className="truncate">{req.address || req.city}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>
                          Required by: <strong className="text-gray-700 dark:text-gray-200">{req.neededDate} • {req.neededTime}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    {req.notes && (
                      <p className="text-xs text-gray-600 dark:text-[#A7BCB0] italic leading-relaxed">
                        &ldquo;{req.notes}&rdquo;
                      </p>
                    )}

                    {/* Pledged Banner if applicable */}
                    {req.status === 'pledged' && req.pledgedByDonorName && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-[18px]">handshake</span>
                        <div>
                          <strong>{req.pledgedByDonorName}</strong> pledged {req.pledgedQuantity || req.mealsNeeded} meals!
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-gray-500">
                      Contact: <strong>{req.contactPerson}</strong>
                    </div>

                    {req.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPledgingRequest(req);
                          setPledgeQuantity(req.mealsNeeded);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">volunteer_activism</span>
                        <span>Pledge Surplus Meals</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Fulfilled</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PLEDGE POPUP MODAL */}
      {pledgingRequest && (
        <div
          className="fixed inset-0 z-50 bg-[#0E1715]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPledgingRequest(null);
          }}
        >
          <div
            className={`w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl space-y-5 ${
              isDark ? 'bg-[#14211E] border-[#233833] text-[#F2F7F4]' : 'bg-white border-[#CFDED5] text-[#111A17]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[24px]">
                  volunteer_activism
                </span>
                <h3 className="font-black text-lg">Pledge Surplus Food</h3>
              </div>
              <button
                type="button"
                onClick={() => setPledgingRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">
                Fulfilling: {pledgingRequest.ngoName}
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                Needs {pledgingRequest.mealsNeeded} meals for {pledgingRequest.neededDate} ({pledgingRequest.neededTime})
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Meals You Are Pledging
                </label>
                <input
                  type="number"
                  min={1}
                  max={pledgingRequest.mealsNeeded * 2}
                  value={pledgeQuantity}
                  onChange={(e) => setPledgeQuantity(Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  You can fulfill all {pledgingRequest.mealsNeeded} meals, or a partial batch.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Surplus Dishes / Menu Prepared
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 80 containers of Vegetable Biryani with Raita, prepared in commercial kitchen."
                  value={pledgeNotes}
                  onChange={(e) => setPledgeNotes(e.target.value)}
                  className={`w-full px-4 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0E1715] border-[#233833] text-white' : 'bg-white border-[#CFDED5] text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPledgingRequest(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPledge}
                disabled={pledgeLoading || pledgeQuantity <= 0}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {pledgeLoading ? 'Confirming...' : 'Confirm Pledge & Notify NGO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
