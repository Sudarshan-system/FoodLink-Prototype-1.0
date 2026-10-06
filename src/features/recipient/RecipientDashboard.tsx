import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { FoodListing } from '../donor/DonorDashboard';
import { INDIAN_CITIES, getCityById } from '../../lib/cities';
import { SAMPLE_FOOD_IMAGES } from '../../lib/sampleFoodImages';
import { getSavedSettings, SETTINGS_CHANGE_EVENT } from '../../lib/settingsStorage';
import {
  DietaryProfile,
  ShelterCapacity,
  loadDietaryProfile,
  saveDietaryProfile,
  evaluateDietaryMatch,
  loadShelterCapacity,
  saveShelterCapacity,
  checkShelterIntakeCapacity,
} from '../../lib/shelterIntake';
import { QrHandshakeModal } from '../../components/QrHandshakeModal';

export interface RecipientDashboardProps {
  onOpenAuth: () => void;
  onNavigateDonor: () => void;
  selectedCityId?: string;
  onSelectCity?: (cityId: string) => void;
  onOpenCsrModal?: (listing?: FoodListing) => void;
  onOpenTracker?: (customMission?: any) => void;
  onNavigateRequests?: () => void;
  initialView?: 'browse' | 'my_claims';
}

export interface ClaimedItem extends FoodListing {
  handoffCode?: string;
  claimedAtTime?: string;
}

export interface AugmentedFoodListing extends FoodListing {
  _coords: { lat: number; lng: number };
  _distanceKm: number;
  _isVeg: boolean;
}

// Helper to determine if listing is vegetarian
function checkIsVeg(listing: FoodListing): boolean {
  const text = (listing.title + ' ' + (listing.notes || '')).toLowerCase();
  return (
    !text.includes('chicken') &&
    !text.includes('mutton') &&
    !text.includes('meat') &&
    !text.includes('fish') &&
    !text.includes('egg') &&
    !text.includes('non-veg')
  );
}

const getSamplePhoto = (id: string) =>
  SAMPLE_FOOD_IMAGES.find((img) => img.id === id)?.url || '';

// Haversine distance calculator in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Generate deterministic map coordinates for items based on city center
function getListingCoordinates(
  listingId: string,
  index: number,
  baseCoords: { lat: number; lng: number }
): { lat: number; lng: number } {
  const charSum = listingId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = (charSum + index * 19) % 100;
  const angle = (seed / 100) * 2 * Math.PI;
  const dist = 0.01 + ((seed % 25) / 100) * 0.035;
  return {
    lat: baseCoords.lat + dist * Math.sin(angle),
    lng: baseCoords.lng + dist * Math.cos(angle) * 1.15,
  };
}

// Calculate remaining safe time and determine if urgent (#EA580C label)
function calculateTimeLeft(listing: FoodListing, now: number): {
  text: string;
  isUrgent: boolean;
  isExpired: boolean;
  remainingMinutes: number;
} {
  let safeUntilMillis = listing.safeUntilMillis;

  if (!safeUntilMillis && listing.safeUntil) {
    if (typeof listing.safeUntil.toMillis === 'function') {
      safeUntilMillis = listing.safeUntil.toMillis();
    } else if (listing.safeUntil instanceof Date) {
      safeUntilMillis = listing.safeUntil.getTime();
    } else if (typeof listing.safeUntil === 'number') {
      safeUntilMillis = listing.safeUntil;
    }
  }

  if (!safeUntilMillis && listing.createdAt) {
    const createdMillis =
      typeof listing.createdAt.toMillis === 'function'
        ? listing.createdAt.toMillis()
        : listing.createdAt instanceof Date
        ? listing.createdAt.getTime()
        : typeof listing.createdAt === 'number'
        ? listing.createdAt
        : now;
    safeUntilMillis = createdMillis + 3 * 60 * 60 * 1000;
  }

  if (!safeUntilMillis) {
    // Default 2.5 hours from listing creation or present
    safeUntilMillis = now + 150 * 60 * 1000;
  }

  const diffMs = safeUntilMillis - now;
  const remainingMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMs <= 0) {
    return {
      text: 'Expired',
      isUrgent: true,
      isExpired: true,
      remainingMinutes: 0,
    };
  }

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

  // Time left is short when under 2 hours (120 minutes)
  const isUrgent = remainingMinutes <= 120;

  if (hours > 0) {
    return {
      text: `${hours}h ${mins}m left`,
      isUrgent,
      isExpired: false,
      remainingMinutes,
    };
  }

  return {
    text: `${mins}m left`,
    isUrgent: true,
    isExpired: false,
    remainingMinutes,
  };
}

// Fallback sample listings for instant preview if Firestore is initially empty
const FALLBACK_LISTINGS: FoodListing[] = [
  {
    id: 'sample-browse-1',
    donorId: 'donor-grand-bistro',
    donorName: 'Chef Marcus',
    donorOrg: 'The Grand Bistro & Banquet',
    donorEmail: 'contact@bistrodelight.com',
    donorPhone: '+91 98200 12345',
    title: 'Royal Palace Banquet Surplus: Dal Tadka & Jeera Rice',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 65,
    unit: 'Portions',
    pickupWindow: 'Today, 4:00 PM to 6:30 PM',
    expiryTime: 'Within 3 hours',
    location: 'Andheri West, Mumbai',
    notes: 'Pure vegetarian meal prepared for an afternoon corporate reception. Kept heated in insulated silver chafers.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10019022000123',
    safeUntilMillis: Date.now() + 85 * 60 * 1000, // 1h 25m left -> urgent
    photoUrl: getSamplePhoto('curry'),
    isVeg: true,
    dietaryType: 'veg',
  },
  {
    id: 'sample-browse-2',
    donorId: 'donor-taj-caterers',
    donorName: 'Farhan Shaikh',
    donorOrg: 'Apex Hospitality Caterers',
    donorEmail: 'catering@apexhospitality.in',
    donorPhone: '+91 98201 54321',
    title: 'Wedding Reception Chicken Dum Biryani & Mirchi Salan',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 90,
    unit: 'Portions',
    pickupWindow: 'Today, 5:00 PM to 7:30 PM',
    expiryTime: 'Within 4 hours',
    location: 'Bandra Kurla Complex, Mumbai',
    notes: 'Non-veg chicken dum biryani, sealed in clean food-grade aluminum handis immediately after function closing.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10018021000456',
    safeUntilMillis: Date.now() + 190 * 60 * 1000, // 3h 10m left -> normal
    photoUrl: getSamplePhoto('biryani'),
    isVeg: false,
    dietaryType: 'non-veg',
    nonVegType: 'Chicken',
  },
  {
    id: 'sample-browse-3',
    donorId: 'donor-golden-bakery',
    donorName: 'Anita Dsouza',
    donorOrg: 'Golden Grain Artisanal Bakery',
    donorEmail: 'orders@goldengrain.com',
    donorPhone: '+91 98202 98765',
    title: 'Fresh Artisanal Sourdough & Multigrain Loaves',
    foodType: 'Bakery & Bread',
    category: 'Bakery',
    quantity: 40,
    unit: 'Loaves',
    pickupWindow: 'Today before 8:00 PM',
    expiryTime: 'Best within 24 hours',
    location: 'Khar West, Mumbai',
    notes: 'Pure veg fresh baked morning bread. Wrapped in kraft bakery bags.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10020011000789',
    safeUntilMillis: Date.now() + 240 * 60 * 1000, // 4h left -> normal
    photoUrl: getSamplePhoto('bread'),
  },
  {
    id: 'sample-browse-4',
    donorId: 'donor-organic-mandi',
    donorName: 'Ramesh Patel',
    donorOrg: 'Shetkari Sahakari Mandi',
    donorEmail: 'produce@shetkari.org',
    donorPhone: '+91 98203 11223',
    title: 'Crates of Ripe Tomatoes, Carrots & Spinach',
    foodType: 'Produce & Fruits',
    category: 'Produce',
    quantity: 50,
    unit: 'kg',
    pickupWindow: 'Today, until 7:00 PM',
    expiryTime: 'Eat fresh within 48 hours',
    location: 'Dadar Market, Mumbai',
    notes: 'Pure veg unblemished farm fresh produce sorted from morning mandi delivery.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    safeUntilMillis: Date.now() + 65 * 60 * 1000, // 1h 5m left -> urgent
    photoUrl: getSamplePhoto('curry'),
  },
  {
    id: 'sample-browse-5',
    donorId: 'donor-metro-dining',
    donorName: 'Chef Sanjeev',
    donorOrg: 'Metropolis Corporate Food Court',
    donorEmail: 'admin@metrofoodcourt.com',
    donorPhone: '+91 98204 33445',
    title: 'Paneer Butter Masala with Tawa Parathas',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 55,
    unit: 'Portions',
    pickupWindow: 'Today, 4:30 PM to 6:00 PM',
    expiryTime: 'Within 2 hours',
    location: 'Lower Parel, Mumbai',
    notes: 'Pure veg lunch buffet trays, hot sealed and untouched.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10017011000321',
    safeUntilMillis: Date.now() + 50 * 60 * 1000, // 50m left -> urgent
    photoUrl: getSamplePhoto('curry'),
  },
  {
    id: 'sample-browse-6',
    donorId: 'donor-punjabi-dhaba',
    donorName: 'Gurpreet Singh',
    donorOrg: 'Sher-E-Punjab Banquets',
    donorEmail: 'sherepunjab@banquets.com',
    donorPhone: '+91 98205 66778',
    title: 'Tandoori Chicken Tikka & Roomali Rotis',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 45,
    unit: 'Portions',
    pickupWindow: 'Today, 5:30 PM to 7:00 PM',
    expiryTime: 'Within 3 hours',
    location: 'Chembur, Mumbai',
    notes: 'Non-veg freshly roasted chicken starters from banquet buffet. Packed in insulated thermocol carriers.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10016012000888',
    safeUntilMillis: Date.now() + 110 * 60 * 1000, // 1h 50m left -> urgent
    photoUrl: getSamplePhoto('biryani'),
  },
  {
    id: 'sample-browse-7',
    donorId: 'donor-quick-bites',
    donorName: 'Vikram Joshi',
    donorOrg: 'Sunrise Confectionery',
    donorEmail: 'vikram@sunrisebakery.in',
    donorPhone: '+91 98206 99001',
    title: 'Veg Puff Pastries & Vegetable Patties',
    foodType: 'Bakery & Bread',
    category: 'Bakery',
    quantity: 70,
    unit: 'Pieces',
    pickupWindow: 'Today until 8:30 PM',
    expiryTime: 'Within 6 hours',
    location: 'Goregaon East, Mumbai',
    notes: 'Pure veg spiced potato puff pastry, individually wrapped in greaseproof food paper.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10021022000555',
    safeUntilMillis: Date.now() + 210 * 60 * 1000, // 3h 30m left -> normal
    photoUrl: getSamplePhoto('bread'),
  },
  {
    id: 'sample-browse-8',
    donorId: 'donor-central-kitchen',
    donorName: 'Meenakshi Iyer',
    donorOrg: 'Dakshin Catering Services',
    donorEmail: 'orders@dakshincatering.com',
    donorPhone: '+91 98207 44556',
    title: 'Idlis, Medu Vada & Coconut Chutney',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 80,
    unit: 'Portions',
    pickupWindow: 'Today, 3:30 PM to 5:30 PM',
    expiryTime: 'Within 2 hours',
    location: 'Matunga, Mumbai',
    notes: 'Pure veg breakfast and lunch surplus. Freshly made with separate sambar containers.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10014022000999',
    safeUntilMillis: Date.now() + 75 * 60 * 1000, // 1h 15m left -> urgent
    photoUrl: getSamplePhoto('curry'),
  },
];

export const RecipientDashboard: React.FC<RecipientDashboardProps> = ({
  onOpenAuth,
  onNavigateDonor,
  selectedCityId,
  onOpenCsrModal,
  onOpenTracker,
  onNavigateRequests,
  initialView = 'browse',
}) => {
  const { currentUser, userProfile } = useAuth();

  // Dashboard view toggle: browse surplus or view my claimed batches
  const [dashboardView, setDashboardView] = useState<'browse' | 'my_claims'>(initialView);

  // Recipient claims tracking state
  const [myClaims, setMyClaims] = useState<ClaimedItem[]>(() => {
    try {
      const saved = localStorage.getItem('foodlink_recipient_claims');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'sample_claim_1',
        title: 'Idlis, Medu Vada & Coconut Chutney',
        quantity: 80,
        unit: 'Portions',
        category: 'Cooked Hot Meals',
        foodType: 'Cooked Hot Meals',
        donorName: 'Dakshin Catering Services',
        donorOrg: 'Dakshin Catering Services',
        donorEmail: 'orders@dakshincatering.com',
        donorPhone: '+91 98207 44556',
        location: 'Matunga, Mumbai',
        expiryTime: 'Within 2 hours',
        pickupWindow: 'Today, 3:30 PM to 5:30 PM',
        status: 'claimed',
        handoffCode: '7419',
        claimedAtTime: 'Today, 2:45 PM',
        safetyChecklist: {
          tempSafety: true,
          freshlyPrepared: true,
          cleanPackaging: true,
          hygieneAllergen: true,
        },
      },
    ];
  });

  useEffect(() => {
    if (initialView) {
      setDashboardView(initialView);
    }
  }, [initialView]);

  // Real-time Firestore subscription for claims by this user
  useEffect(() => {
    if (!currentUser?.uid) return;
    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('claimedBy', '==', currentUser.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: ClaimedItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as any),
          });
        });
        if (items.length > 0) {
          setMyClaims((prev) => {
            const merged = [...items, ...prev.filter((p) => !items.some((i) => i.id === p.id))];
            try {
              localStorage.setItem('foodlink_recipient_claims', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      },
      (err) => {
        console.warn('Real-time claims listener notice:', err);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const savedSettings = getSavedSettings();
  const effectiveCityId = selectedCityId || savedSettings.defaultCity || 'mumbai';

  const currentCity = getCityById(effectiveCityId);
  const cityCenterCoords = useMemo(() => ({
    lat: currentCity.id === 'all' ? 19.0760 : currentCity.lat,
    lng: currentCity.id === 'all' ? 72.8777 : currentCity.lng,
  }), [currentCity]);

  // Firestore listings state
  const [firestoreListings, setFirestoreListings] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [distanceFilter, setDistanceFilter] = useState<number | 'all'>(() => {
    return savedSettings.defaultDistance || 'all';
  });
  const [foodTypeFilter, setFoodTypeFilter] = useState<string>('all');

  // Mobile Map View Toggle (prefilled from defaultBrowseView)
  const [showMobileMap, setShowMobileMap] = useState<boolean>(
    () => savedSettings.defaultBrowseView === 'map'
  );

  // Pagination State (itemsPerPage from settings)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(
    () => savedSettings.itemsPerPage || 10
  );

  // Real-time synchronization with settings changes
  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const s = customEvent.detail || getSavedSettings();
      if (s.itemsPerPage) setItemsPerPage(s.itemsPerPage);
    };
    window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
  }, []);

  // Selected Listing for Detail Modal & Map Highlight
  const [selectedListing, setSelectedListing] = useState<AugmentedFoodListing | null>(null);
  const [physicalVerificationConfirmed, setPhysicalVerificationConfirmed] = useState(false);

  // Inline Message when non-signed-in visitor clicks Claim
  const [claimPromptMessage, setClaimPromptMessage] = useState<string | null>(null);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Shelter Intake & Capacity Management
  const [shelterCapacity, setShelterCapacity] = useState<ShelterCapacity>(() => loadShelterCapacity());
  const [showCapacityEditor, setShowCapacityEditor] = useState(false);

  // Strict Dietary & Allergen Profile
  const [dietaryProfile, setDietaryProfile] = useState<DietaryProfile>(() => loadDietaryProfile());
  const [filterByDietaryProfile, setFilterByDietaryProfile] = useState(false);
  const [showDietaryEditor, setShowDietaryEditor] = useState(false);

  // QR Handshake Modal for Recipient Handover Verification
  const [deliveryQrClaim, setDeliveryQrClaim] = useState<ClaimedItem | null>(null);

  // Live clock tick every minute to update remaining times accurately
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Google Maps setup
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Load Google Maps API script safely if not already present
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) return;

    if ((window as any).google && (window as any).google.maps) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapsLoaded(true);
      document.head.appendChild(script);
    } else {
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.addEventListener('load', () => setMapsLoaded(true));
      }
    }
  }, []);

  // Real-time Firestore subscription for active available food listings
  useEffect(() => {
    setLoading(true);
    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('status', '==', 'available'));

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
        setFirestoreListings(items);
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time listings listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Merge Firestore listings with benchmark fallback items to ensure a rich experience
  const rawListings = useMemo(() => {
    if (firestoreListings.length > 0) {
      return firestoreListings;
    }
    return FALLBACK_LISTINGS;
  }, [firestoreListings]);

  // Augment listings with calculated distance, coordinates, and veg classification
  const augmentedListings = useMemo(() => {
    return rawListings.map((item, index) => {
      const coords = getListingCoordinates(item.id, index, cityCenterCoords);
      const distance = calculateDistanceKm(
        cityCenterCoords.lat,
        cityCenterCoords.lng,
        coords.lat,
        coords.lng
      );

      let isVeg: boolean;
      if (typeof item.isVeg === 'boolean') {
        isVeg = item.isVeg;
      } else if (item.dietaryType) {
        isVeg = item.dietaryType === 'veg';
      } else {
        const titleAndNotes = (item.title + ' ' + (item.notes || '')).toLowerCase();
        isVeg =
          !titleAndNotes.includes('chicken') &&
          !titleAndNotes.includes('mutton') &&
          !titleAndNotes.includes('meat') &&
          !titleAndNotes.includes('fish') &&
          !titleAndNotes.includes('egg') &&
          !titleAndNotes.includes('non-veg');
      }

      return {
        ...item,
        _coords: coords,
        _distanceKm: distance,
        _isVeg: isVeg,
      };
    });
  }, [rawListings, cityCenterCoords]);

  // Apply filters: Search query, Veg/Non-Veg, Distance, Food Type
  const filteredListings = useMemo(() => {
    return augmentedListings.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(queryLower);
        const matchesLocation = item.location.toLowerCase().includes(queryLower);
        const matchesNotes = (item.notes || '').toLowerCase().includes(queryLower);
        const matchesDonor = (item.donorOrg || item.donorName || '').toLowerCase().includes(queryLower);

        if (!matchesTitle && !matchesLocation && !matchesNotes && !matchesDonor) {
          return false;
        }
      }

      // 2. Veg / Non-veg Filter
      if (vegFilter === 'veg' && !item._isVeg) return false;
      if (vegFilter === 'non-veg' && item._isVeg) return false;

      // 3. Distance Filter
      if (typeof distanceFilter === 'number' && item._distanceKm > distanceFilter) {
        return false;
      }

      // 4. Food Type Filter
      if (foodTypeFilter !== 'all') {
        const typeLower = (item.foodType || item.category || '').toLowerCase();
        if (foodTypeFilter === 'cooked') {
          if (!typeLower.includes('cooked') && !typeLower.includes('hot') && !typeLower.includes('meal')) {
            return false;
          }
        } else if (foodTypeFilter === 'bakery') {
          if (!typeLower.includes('bakery') && !typeLower.includes('bread')) {
            return false;
          }
        } else if (foodTypeFilter === 'produce') {
          if (!typeLower.includes('produce') && !typeLower.includes('fruit') && !typeLower.includes('vegetable')) {
            return false;
          }
        } else if (foodTypeFilter === 'packaged') {
          if (!typeLower.includes('packaged') && !typeLower.includes('dry') && !typeLower.includes('canned')) {
            return false;
          }
        }
      }

      // 5. Strict Dietary & Allergen Profile Filtering
      if (filterByDietaryProfile) {
        const dietaryMatch = evaluateDietaryMatch(item, dietaryProfile);
        if (!dietaryMatch.isMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    augmentedListings,
    searchQuery,
    vegFilter,
    distanceFilter,
    foodTypeFilter,
    filterByDietaryProfile,
    dietaryProfile,
  ]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, vegFilter, distanceFilter, foodTypeFilter, filterByDietaryProfile]);

  // Paginated listings for current page
  const totalPages = Math.max(1, Math.ceil(filteredListings.length / itemsPerPage));
  const paginatedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredListings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredListings, currentPage]);

  // Initialize and update Google Maps instance and markers
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || !(window as any).google?.maps) return;

    const google = (window as any).google;

    if (!googleMapInstance.current) {
      googleMapInstance.current = new google.maps.Map(mapRef.current, {
        center: cityCenterCoords,
        zoom: currentCity.zoom || 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
    } else {
      googleMapInstance.current.setCenter(cityCenterCoords);
    }

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Add Center / Receiver Hub marker (Primary Green)
    const centerMarker = new google.maps.Marker({
      position: cityCenterCoords,
      map: googleMapInstance.current,
      title: `${currentCity.name} Volunteer Dispatch Hub`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#059669',
        fillOpacity: 1,
        strokeWeight: 2.5,
        strokeColor: '#FFFFFF',
      },
    });
    markersRef.current.push(centerMarker);

    // Add markers for all filtered listings
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(cityCenterCoords);

    filteredListings.forEach((item) => {
      bounds.extend(item._coords);
      const isSelected = selectedListing?.id === item.id;

      const marker = new google.maps.Marker({
        position: item._coords,
        map: googleMapInstance.current,
        title: item.title,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: isSelected ? 7 : 5.5,
          fillColor: isSelected ? '#047857' : '#EA580C',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        zIndex: isSelected ? 100 : 1,
      });

      marker.addListener('click', () => {
        setSelectedListing(item);
      });

      markersRef.current.push(marker);
    });

    if (filteredListings.length > 0) {
      googleMapInstance.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }, [mapsLoaded, filteredListings, selectedListing, cityCenterCoords, currentCity]);

  // Handle Claim Action
  const handleClaimListing = async (listing: FoodListing) => {
    setClaimPromptMessage(null);
    setClaimSuccessMessage(null);

    // Rule: Visitors can browse without signing in. If they click "Claim", show a simple message asking them to sign in.
    if (!currentUser) {
      setClaimPromptMessage(
        'Please sign in to claim food. Only verified non-profit organizations, orphanages, and shelters can claim surplus batches.'
      );
      return;
    }

    // Check role: Only non-profit recipients can claim
    const role = userProfile?.role;
    if (role === 'restaurant' || role === 'donor') {
      setClaimPromptMessage(
        'You are currently signed in as a Donor. Only verified recipient organizations and shelters can claim food batches.'
      );
      return;
    }

    // Check Shelter Intake Capacity ceiling to prevent dumping on small shelters
    const intakeCheck = checkShelterIntakeCapacity(listing, shelterCapacity);

    if (!intakeCheck.canAccept) {
      setClaimPromptMessage(
        `⚠️ Intake Limit Exceeded: ${intakeCheck.reason || 'Daily capacity reached'}. Auto-pause protects your facility from oversupply.`
      );
      return;
    }

    setIsClaiming(true);
    try {
      const handoffCode = String(Math.floor(1000 + Math.random() * 9000));
      const orgName = userProfile?.orgName || userProfile?.displayName || 'Registered Community Shelter';

      // Update Firestore if this is a real Firestore document
      if (listing.id && !listing.id.startsWith('sample-')) {
        const listingRef = doc(db, 'listings', listing.id);
        await updateDoc(listingRef, {
          status: 'claimed',
          claimedAt: serverTimestamp(),
          claimedBy: currentUser.uid,
          claimingOrgId: currentUser.uid,
          claimingOrgName: orgName,
          handoffCode,
        });
      }

      const newClaimedItem: ClaimedItem = {
        ...listing,
        status: 'claimed',
        handoffCode,
        claimedAtTime: 'Just now',
      };
      setMyClaims((prev) => {
        const next = [newClaimedItem, ...prev.filter((item) => item.id !== listing.id)];
        try {
          localStorage.setItem('foodlink_recipient_claims', JSON.stringify(next));
        } catch {}
        return next;
      });

      // Update local shelter intake capacity metrics
      const isCold = (listing.storageCondition || listing.foodType || '').toLowerCase().includes('refrig');
      const mealsToAdd = listing.unit?.toLowerCase().includes('kg') ? Math.round(listing.quantity * 2.5) : listing.quantity;
      const updatedCap: ShelterCapacity = {
        ...shelterCapacity,
        currentMealsReceived: shelterCapacity.currentMealsReceived + mealsToAdd,
        currentIntakeMealsToday: shelterCapacity.currentMealsReceived + mealsToAdd,
        currentColdStorageUsedKg: isCold
          ? Math.min(shelterCapacity.coldStorageKg, shelterCapacity.currentColdStorageUsedKg + Math.round(listing.quantity * 0.4))
          : shelterCapacity.currentColdStorageUsedKg,
      };
      setShelterCapacity(updatedCap);
      saveShelterCapacity(updatedCap);

      setClaimSuccessMessage(
        `Food claimed successfully! Pickup verification code is #${handoffCode}. Please present this code upon collection.`
      );
      setSelectedListing(null);
    } catch (err: any) {
      console.error('Error claiming food listing:', err);
      setClaimPromptMessage(err?.message || 'Could not claim this listing. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Confirm Pickup Received handler
  const handleConfirmPickupReceived = async (claimId: string) => {
    setMyClaims((prev) => {
      const next = prev.map((item) =>
        item.id === claimId ? { ...item, status: 'completed' as const } : item
      );
      try {
        localStorage.setItem('foodlink_recipient_claims', JSON.stringify(next));
      } catch {}
      return next;
    });

    if (!claimId.startsWith('sample')) {
      try {
        const docRef = doc(db, 'listings', claimId);
        await updateDoc(docRef, { status: 'completed' });
      } catch (err) {
        console.warn('Firestore claim complete update notice:', err);
      }
    }

    setClaimSuccessMessage('Pickup confirmed received! The batch status is now marked as Completed.');
  };

  // Seed sample data helper when Firestore has 0 listings
  const handleSeedSurplusListings = async () => {
    try {
      const listingsRef = collection(db, 'listings');
      for (const item of FALLBACK_LISTINGS) {
        const { id, ...data } = item;
        await addDoc(listingsRef, {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      setClaimSuccessMessage('Sample surplus batches added to Firestore successfully.');
    } catch (err) {
      console.error('Seed error:', err);
    }
  };

  return (
    <div className="w-full">
      {/* Notifications / Banner Messages */}
      {claimPromptMessage && (
        <div className="mb-6 p-4 rounded-lg bg-[#FEF2F2] border border-[#EA580C]/40 text-[#064E3B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-[#EA580C] shrink-0">
              lock
            </span>
            <p className="text-sm font-medium">{claimPromptMessage}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setClaimPromptMessage(null);
                onOpenAuth();
              }}
              className="px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors min-h-[44px] cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setClaimPromptMessage(null)}
              className="p-2 text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {claimSuccessMessage && (
        <div className="mb-6 p-4 rounded-lg bg-[#D1FAE5] border border-[#059669]/30 text-[#064E3B] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-[#059669] shrink-0">
              check_circle
            </span>
            <p className="text-sm font-medium">{claimSuccessMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setClaimSuccessMessage(null)}
            className="p-2 text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* 📦 Shelter Capacity & Intake Management + 🥗 Strict Dietary Profile */}
      <div className="mb-6 p-4 sm:p-5 bg-white border border-[#E7E5E4] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <span className="material-symbols-outlined text-[22px]">domain</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base text-[#064E3B]">
                  {shelterCapacity.organizationName || userProfile?.orgName || 'Community Shelter & Care Home'}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    shelterCapacity.currentMealsReceived >= shelterCapacity.dailyIntakeCeiling
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {shelterCapacity.currentMealsReceived >= shelterCapacity.dailyIntakeCeiling
                    ? '🔴 Intake Paused (Ceiling Met)'
                    : '🟢 Accepting Allocations'}
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Live Intake Ceiling &amp; Refrigerator Guards prevent surplus dumping on facilities without cold storage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCapacityEditor(!showCapacityEditor)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              <span>{showCapacityEditor ? 'Close Limits' : 'Edit Intake Limits'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDietaryEditor(!showDietaryEditor)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-600/40 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">restaurant_menu</span>
              <span>{showDietaryEditor ? 'Close Dietary' : 'Dietary Profile'}</span>
            </button>
          </div>
        </div>

        {/* Live Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Daily Meals Ceiling Gauge */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-stone-700">Daily Meal Intake Ceiling</span>
              <span className="font-bold text-[#064E3B]">
                {shelterCapacity.currentMealsReceived} / {shelterCapacity.dailyIntakeCeiling} meals
              </span>
            </div>
            <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  shelterCapacity.currentMealsReceived >= shelterCapacity.dailyIntakeCeiling
                    ? 'bg-red-500'
                    : shelterCapacity.currentMealsReceived >= shelterCapacity.dailyIntakeCeiling * 0.8
                    ? 'bg-amber-500'
                    : 'bg-[#059669]'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((shelterCapacity.currentMealsReceived / shelterCapacity.dailyIntakeCeiling) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Cold Storage Capacity Gauge */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-stone-700">Cold Storage / Chiller</span>
              <span className="font-bold text-[#064E3B]">
                {shelterCapacity.coldStorageUsedKg} / {shelterCapacity.coldStorageKg} kg
              </span>
            </div>
            <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  shelterCapacity.coldStorageUsedKg >= shelterCapacity.coldStorageKg
                    ? 'bg-red-500'
                    : 'bg-teal-600'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((shelterCapacity.coldStorageUsedKg / shelterCapacity.coldStorageKg) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Strict Dietary Filter Toggle */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
            <div>
              <span className="font-semibold text-xs text-stone-800 block">Strict Diet Filtering</span>
              <span className="text-[11px] text-stone-500">
                {filterByDietaryProfile ? 'Matching Shelter Profile' : 'Showing all listings'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFilterByDietaryProfile(!filterByDietaryProfile)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterByDietaryProfile
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {filterByDietaryProfile ? 'check_circle' : 'filter_alt'}
              </span>
              <span>{filterByDietaryProfile ? 'Filter ON' : 'Enable'}</span>
            </button>
          </div>
        </div>

        {/* Capacity Editor Drawer */}
        {showCapacityEditor && (
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
              Configure Facility Intake Ceilings
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Daily Meals Intake Ceiling (meals/day):
                </label>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={shelterCapacity.dailyIntakeCeiling}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 10;
                    const next = { ...shelterCapacity, dailyIntakeCeiling: val, dailyIntakeCeilingMeals: val };
                    setShelterCapacity(next);
                    saveShelterCapacity(next);
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Available Cold Storage Capacity (kg):
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={shelterCapacity.coldStorageKg}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    const next = { ...shelterCapacity, coldStorageKg: val, coldStorageCapacityKg: val };
                    setShelterCapacity(next);
                    saveShelterCapacity(next);
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-emerald-800">
                Allocations automatically pause when intake ceiling is met to prevent food spoilage.
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = {
                    ...shelterCapacity,
                    currentMealsReceived: 0,
                    currentIntakeMealsToday: 0,
                    coldStorageUsedKg: 0,
                    currentColdStorageUsedKg: 0,
                  };
                  setShelterCapacity(next);
                  saveShelterCapacity(next);
                }}
                className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
              >
                Reset Daily Intake Counter
              </button>
            </div>
          </div>
        )}

        {/* Dietary Profile Editor Drawer */}
        {showDietaryEditor && (
          <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
              Shelter Dietary &amp; Allergen Profile
            </h4>
            <p className="text-xs text-gray-600">
              Select mandatory criteria for your shelter residents. Food batches violating these will be filtered out.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {[
                { key: 'strictVegetarian', label: '🥗 Strict Vegetarian' },
                { key: 'jainOnly', label: '🪷 Jain (No root veg)' },
                { key: 'halalCertified', label: '🌙 Halal Certified' },
                { key: 'diabeticSafe', label: '🩺 Diabetic Safe' },
                { key: 'nutFree', label: '🥜 Nut-Free' },
                { key: 'glutenFree', label: '🌾 Gluten-Free' },
                { key: 'dairyFree', label: '🥛 Dairy-Free' },
              ].map(({ key, label }) => {
                const checked = Boolean((dietaryProfile as any)[key]);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-teal-100/70 border-teal-300 text-teal-900 font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = { ...dietaryProfile, [key]: e.target.checked };
                        setDietaryProfile(next);
                        saveDietaryProfile(next);
                      }}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RECIPIENT DASHBOARD VIEW SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-2 bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDashboardView('browse')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 min-h-[44px] ${
              dashboardView === 'browse'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#064E3B] dark:hover:text-white hover:bg-[#D1FAE5] dark:hover:bg-[#134025]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">travel_explore</span>
            <span>Browse Surplus Food ({filteredListings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardView('my_claims')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 min-h-[44px] ${
              dashboardView === 'my_claims'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#064E3B] dark:hover:text-white hover:bg-[#D1FAE5] dark:hover:bg-[#134025]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory</span>
            <span>My Claimed Pickups ({myClaims.length})</span>
          </button>
        </div>

        <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] px-3">
          {currentUser
            ? `Signed in as ${userProfile?.orgName || userProfile?.displayName || currentUser.email}`
            : 'Sign in to reserve meals for your organization'}
        </div>
      </div>

      {dashboardView === 'my_claims' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                Your Claimed Surplus Food Pickups
              </h2>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                Food batches reserved by your organization awaiting collection or completed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDashboardView('browse')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#059669] hover:bg-[#047857] text-white transition-colors cursor-pointer flex items-center gap-1.5 min-h-[40px] shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Claim More Food</span>
            </button>
          </div>

          {myClaims.length === 0 ? (
            <div className="bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-2xl p-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[32px]">inventory_2</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                No claimed pickups yet
              </h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">
                Browse available surplus food listings and click "Claim food" to reserve batches for your registered shelter.
              </p>
              <button
                type="button"
                onClick={() => setDashboardView('browse')}
                className="px-5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
              >
                <span>Browse Available Food</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#059669]/40 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                          claim.status === 'completed'
                            ? 'bg-[#D1FAE5] dark:bg-[#134025] text-[#059669]'
                            : 'bg-[#FEF2F2] dark:bg-[#EA580C]/20 text-[#EA580C]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {claim.status === 'completed' ? 'Completed' : 'Ready for Pickup'}
                      </span>

                      {claim.handoffCode && (
                        <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#059669]/10 text-[#059669] border border-[#059669]/30">
                          Code #{claim.handoffCode}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-serif font-bold text-base text-[#064E3B] dark:text-[#F0FDF8] line-clamp-1">
                        {claim.title}
                      </h3>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5 line-clamp-2">
                        {claim.notes || 'Hygienically packaged surplus food.'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#F0FDF8] dark:bg-[#134025]/40 border border-[#E7E5E4]/60 dark:border-[#1E5C38] space-y-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      <div className="flex items-center justify-between">
                        <span>Quantity:</span>
                        <span className="font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                          {claim.quantity} {claim.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Donor:</span>
                        <span className="font-semibold text-[#064E3B] dark:text-[#F0FDF8] truncate max-w-[160px]">
                          {claim.donorOrg || claim.donorName}
                        </span>
                      </div>
                      {claim.donorPhone && (
                        <div className="flex items-center justify-between">
                          <span>Phone:</span>
                          <span className="text-[#064E3B] dark:text-[#F0FDF8]">{claim.donorPhone}</span>
                        </div>
                      )}
                      <div className="truncate">
                        <span>Location: </span>
                        <span className="text-[#064E3B] dark:text-[#F0FDF8]">{claim.location}</span>
                      </div>
                      {claim.pickupWindow && (
                        <div>
                          <span>Window: </span>
                          <span className="text-[#064E3B] dark:text-[#F0FDF8]">{claim.pickupWindow}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E7E5E4]/60 dark:border-[#1E5C38] flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {onOpenTracker && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenTracker({
                              listingId: claim.id,
                              foodTitle: claim.title,
                              quantityStr: `${claim.quantity} ${claim.unit || 'portions'}`,
                              donorName: claim.donorName,
                              donorOrg: claim.donorOrg || claim.donorName,
                              donorAddress: claim.location,
                              donorPhone: claim.donorPhone,
                              shelterName: userProfile?.orgName || userProfile?.displayName || 'Registered Shelter Hub',
                              shelterAddress: userProfile?.address || 'Community Receiving Bay',
                              handoffCode: claim.handoffCode || '4829',
                              status: claim.status === 'completed' ? 'delivered' : 'en_route_shelter',
                            })
                          }
                          className="flex-1 py-1.5 px-3 rounded-lg border border-emerald-600/40 hover:bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">
                            navigation
                          </span>
                          <span>Track Live Delivery</span>
                        </button>
                      )}

                      {onOpenCsrModal && (
                        <button
                          type="button"
                          onClick={() => onOpenCsrModal(claim)}
                          className="py-1.5 px-2.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer flex items-center gap-1"
                          title="Download CSR Impact Certificate"
                        >
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">
                            picture_as_pdf
                          </span>
                          <span>Impact PDF</span>
                        </button>
                      )}
                    </div>

                    {claim.status !== 'completed' ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryQrClaim(claim)}
                          className="w-full py-2 px-3 rounded-lg border border-teal-600 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          title="Scan courier's delivery code or enter PIN to guarantee chain of custody"
                        >
                          <span className="material-symbols-outlined text-[16px] text-teal-700">qr_code_scanner</span>
                          <span>Verify Handover (Scan Courier QR)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmPickupReceived(claim.id)}
                          className="w-full py-1.5 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">task_alt</span>
                          <span>Quick Manual Confirm</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#059669] font-semibold flex items-center justify-center gap-1 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>Handshake Complete &amp; Verified</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* TOP: SEARCH BOX AND SIMPLE FILTERS */}
          <div className="bg-white p-4 sm:p-5 rounded-lg border border-[#E7E5E4] shadow-2xs mb-6 sm:mb-8">
        {/* Search Input */}
        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by food name, area, or donor..."
            className="w-full h-11 pl-11 pr-10 rounded-lg border border-[#E7E5E4] text-[#064E3B] placeholder-[#6B7280] text-base focus:outline-none focus:border-[#059669] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#064E3B] p-1 cursor-pointer"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters Row: Veg / Non-Veg, Distance, Food Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filter 1: Veg / Non-veg */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wider">
              Dietary Preference
            </label>
            <div className="grid grid-cols-3 gap-1 bg-[#F0FDF8] p-1 rounded-lg border border-[#E7E5E4]">
              <button
                type="button"
                onClick={() => setVegFilter('all')}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer min-h-[38px] flex items-center justify-center ${
                  vegFilter === 'all'
                    ? 'bg-[#059669] text-white'
                    : 'text-[#6B7280] hover:text-[#064E3B]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('veg')}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer min-h-[38px] flex items-center justify-center gap-1 ${
                  vegFilter === 'veg'
                    ? 'bg-[#059669] text-white'
                    : 'text-[#6B7280] hover:text-[#064E3B]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669] inline-block" />
                Pure Veg
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('non-veg')}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer min-h-[38px] flex items-center justify-center gap-1 ${
                  vegFilter === 'non-veg'
                    ? 'bg-[#059669] text-white'
                    : 'text-[#6B7280] hover:text-[#064E3B]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C] inline-block" />
                Non-Veg
              </button>
            </div>
          </div>

          {/* Filter 2: Distance */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wider">
              Maximum Distance
            </label>
            <select
              value={distanceFilter === 'all' ? 'all' : String(distanceFilter)}
              onChange={(e) =>
                setDistanceFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full h-11 px-3 rounded-lg border border-[#E7E5E4] bg-[#F0FDF8] text-[#064E3B] text-sm font-medium focus:outline-none focus:border-[#059669] cursor-pointer"
            >
              <option value="all">Any distance</option>
              <option value="3">Within 3 km</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
            </select>
          </div>

          {/* Filter 3: Food Type */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wider">
              Food Type
            </label>
            <select
              value={foodTypeFilter}
              onChange={(e) => setFoodTypeFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-[#E7E5E4] bg-[#F0FDF8] text-[#064E3B] text-sm font-medium focus:outline-none focus:border-[#059669] cursor-pointer"
            >
              <option value="all">All food types</option>
              <option value="cooked">Cooked Hot Meals</option>
              <option value="bakery">Bakery &amp; Bread</option>
              <option value="produce">Fresh Produce &amp; Fruits</option>
              <option value="packaged">Packaged &amp; Dry Groceries</option>
            </select>
          </div>
        </div>

        {/* Mobile View Toggle: Show map button */}
        <div className="lg:hidden mt-4 pt-3 border-t border-[#E7E5E4] flex items-center justify-between">
          <span className="text-xs text-[#6B7280] font-medium">
            {filteredListings.length} active listings
          </span>
          <button
            type="button"
            onClick={() => setShowMobileMap(!showMobileMap)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#E7E5E4] bg-[#F0FDF8] text-sm font-semibold text-[#064E3B] hover:bg-[#D1FAE5] transition-colors min-h-[44px] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-[#059669]">
              {showMobileMap ? 'format_list_bulleted' : 'map'}
            </span>
            <span>{showMobileMap ? 'Show list' : 'Show map'}</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT: LISTINGS ON LEFT, MAP ON RIGHT (DESKTOP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: LISTINGS LIST (~60% on desktop) */}
        <div className={`lg:col-span-7 ${showMobileMap ? 'hidden lg:block' : 'block'}`}>
          {/* Header Summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[#6B7280]">
              Available surplus: <span className="text-[#064E3B] font-bold">{filteredListings.length}</span>
            </p>
            {(searchQuery || vegFilter !== 'all' || distanceFilter !== 'all' || foodTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVegFilter('all');
                  setDistanceFilter('all');
                  setFoodTypeFilter('all');
                }}
                className="text-xs text-[#059669] hover:text-[#047857] font-semibold underline cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-[#6B7280] bg-white rounded-lg border border-[#E7E5E4]">
              <span className="material-symbols-outlined animate-spin text-[32px] text-[#059669] mb-2">
                progress_activity
              </span>
              <p className="text-sm">Loading available surplus listings...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="py-12 px-6 text-center bg-white rounded-lg border border-[#E7E5E4]">
              <div className="w-12 h-12 rounded-lg bg-[#D1FAE5] text-[#059669] flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[24px]">inventory_2</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#064E3B] mb-1">
                No matching food listings found
              </h3>
              <p className="text-sm text-[#6B7280] max-w-md mx-auto mb-4">
                Try widening your distance limit, clearing your search, or adjusting dietary filters.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVegFilter('all');
                    setDistanceFilter('all');
                    setFoodTypeFilter('all');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#059669] text-white text-sm font-semibold hover:bg-[#047857] transition-colors min-h-[44px] cursor-pointer"
                >
                  Clear filters
                </button>
                {firestoreListings.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedSurplusListings}
                    className="px-4 py-2 rounded-lg border border-[#E7E5E4] bg-white text-[#064E3B] text-sm font-semibold hover:bg-[#D1FAE5] transition-colors min-h-[44px] cursor-pointer"
                  >
                    Load sample listings
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedListings.map((listing) => {
                const timeLeft = calculateTimeLeft(listing, currentTime);
                const isSelected = selectedListing?.id === listing.id;

                return (
                  <div
                    key={listing.id}
                    className={`bg-white rounded-lg border p-5 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#059669] ring-1 ring-[#059669]'
                        : 'border-[#E7E5E4] hover:border-[#059669]/50'
                    }`}
                  >
                    <div>
                      {/* Top Row: Tags (Veg/Non-Veg, Quantity, Time Left) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          {/* Veg / Non-veg tag */}
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded border ${
                              listing._isVeg
                                ? 'bg-[#D1FAE5] text-[#059669] border-[#059669]/30'
                                : 'bg-[#FEF2F2] text-[#EA580C] border-[#EA580C]/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                listing._isVeg ? 'bg-[#059669]' : 'bg-[#EA580C]'
                              }`}
                            />
                            {listing._isVeg ? 'Pure Veg' : 'Non-Veg'}
                          </span>

                          {/* Quantity */}
                          <span className="text-xs font-semibold text-[#064E3B] bg-[#F0FDF8] border border-[#E7E5E4] px-2 py-0.5 rounded">
                            {listing.quantity} {listing.unit || 'portions'}
                          </span>
                        </div>

                        {/* Time Left: Highlighted with #EA580C only when time left is short */}
                        <div
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded border ${
                            timeLeft.isUrgent
                              ? 'bg-[#FEF2F2] text-[#EA580C] border-[#EA580C]/30 font-semibold'
                              : 'bg-[#F0FDF8] text-[#6B7280] border-[#E7E5E4] font-medium'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {timeLeft.isUrgent ? 'alarm' : 'schedule'}
                          </span>
                          <span>{timeLeft.text}</span>
                        </div>
                      </div>

                      {/* Food Name */}
                      <h3 className="font-serif text-lg sm:text-xl font-bold text-[#064E3B] mb-1.5 line-clamp-1">
                        {listing.title}
                      </h3>

                      {/* Area & Distance */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] mb-3">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-[#059669]">
                            location_on
                          </span>
                          <span className="font-medium text-[#064E3B]">{listing.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-[#6B7280]">
                            near_me
                          </span>
                          <span>~{listing._distanceKm} km away</span>
                        </div>
                        {listing.donorOrg && (
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-[#6B7280]">
                              storefront
                            </span>
                            <span className="truncate">{listing.donorOrg}</span>
                          </div>
                        )}
                      </div>

                      {listing.notes && (
                        <p className="text-sm text-[#6B7280] line-clamp-2 mb-3 leading-relaxed">
                          {listing.notes}
                        </p>
                      )}

                      {/* Dietary Match & Visual Freshness Badges */}
                      {(() => {
                        const match = evaluateDietaryMatch(listing, dietaryProfile);
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 mb-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                match.isMatch
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {match.isMatch ? 'task_alt' : 'info'}
                              </span>
                              <span>{match.isMatch ? 'Shelter Diet Compatible' : 'Diet Check Needed'}</span>
                            </span>

                            {listing.visualInspection && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                <span className="material-symbols-outlined text-[13px] text-teal-600">lens_blur</span>
                                <span>Gemini Freshness: {listing.visualInspection.freshnessScore}/100</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Allergen badges */}
                      {listing.allergens && listing.allergens.length > 0 && !listing.allergens.includes('None') && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {listing.allergens.map((a) => (
                            <span
                              key={a}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEF2F2] text-[#EA580C] border border-[#EA580C]/20"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* AI Safety Verdict badge (when stored on listing) */}
                      {listing.safetyVerdict && (
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-3 ${
                            listing.safetyVerdict === 'safe' || listing.safetyVerdict === 'Looks safe'
                              ? 'bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0]'
                              : listing.safetyVerdict === 'caution'
                              ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                              : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {listing.safetyVerdict === 'unsafe' || listing.safetyVerdict === 'Flagged for review'
                              ? 'dangerous'
                              : listing.safetyVerdict === 'caution'
                              ? 'warning'
                              : 'verified_user'}
                          </span>
                          <span>AI: {listing.safetyVerdict.toUpperCase()}</span>
                          {typeof (listing as any).safetyScore === 'number' && (
                            <span className="opacity-75 font-normal">({(listing as any).safetyScore}/100)</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-between gap-3">
                      <span className="text-xs text-[#6B7280]">
                        Pickup: {listing.pickupWindow}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedListing(listing)}
                        className="px-4 py-2 rounded-lg border border-[#E7E5E4] hover:border-[#059669] bg-white hover:bg-[#D1FAE5] text-sm font-semibold text-[#064E3B] transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shrink-0"
                      >
                        View details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION AT THE BOTTOM */}
          {filteredListings.length > itemsPerPage && (
            <div className="mt-8 pt-6 border-t border-[#E7E5E4] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-[#6B7280]">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredListings.length)} of{' '}
                {filteredListings.length} listings
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-2 rounded-lg border border-[#E7E5E4] bg-white text-xs font-semibold text-[#064E3B] hover:bg-[#F0FDF8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-11 h-11 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center ${
                      currentPage === pageNum
                        ? 'bg-[#059669] text-white border border-[#059669]'
                        : 'bg-white text-[#064E3B] border border-[#E7E5E4] hover:bg-[#F0FDF8]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-2 rounded-lg border border-[#E7E5E4] bg-white text-xs font-semibold text-[#064E3B] hover:bg-[#F0FDF8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: GOOGLE MAP (~40% on desktop, sticky) */}
        <div
          className={`lg:col-span-5 w-full ${
            showMobileMap ? 'block' : 'hidden lg:block'
          } lg:sticky lg:top-24`}
        >
          <div className="bg-white rounded-lg border border-[#E7E5E4] overflow-hidden shadow-2xs">
            {/* Map Header */}
            <div className="px-4 py-3 bg-[#F0FDF8] border-b border-[#E7E5E4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#064E3B]">
                  Live Rescue Map
                </span>
              </div>
              <span className="text-xs text-[#6B7280]">
                {filteredListings.length} pins plotted
              </span>
            </div>

            {/* Google Map Container */}
            <div className="relative w-full h-[400px] lg:h-[580px] bg-[#D1FAE5]">
              <div ref={mapRef} className="w-full h-full" />

              {!mapsLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#F0FDF8]/90">
                  <span className="material-symbols-outlined text-[32px] text-[#059669] animate-spin mb-2">
                    progress_activity
                  </span>
                  <p className="text-xs text-[#6B7280]">Loading Google Maps radar...</p>
                </div>
              )}
            </div>

            {/* Selected Map Item Summary Card (if marker clicked) */}
            {selectedListing && (
              <div className="p-4 border-t border-[#E7E5E4] bg-[#F0FDF8]">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-bold text-[#059669] block">
                      {selectedListing._isVeg ? '● Pure Veg' : '● Non-Veg'}
                    </span>
                    <h4 className="font-serif text-sm font-bold text-[#064E3B] line-clamp-1">
                      {selectedListing.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedListing(null)}
                    className="text-[#6B7280] hover:text-[#064E3B] text-xs p-1"
                    aria-label="Close selection"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-[#6B7280] mb-3">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-[#059669]">location_on</span>
                    <span>{selectedListing.location}</span>
                  </span>
                  <span className="font-semibold text-[#064E3B]">
                    {selectedListing.quantity} {selectedListing.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleClaimListing(selectedListing)}
                    className="flex-1 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors min-h-[44px] cursor-pointer"
                  >
                    Claim food
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {selectedListing && (
        <div
          className="fixed inset-0 z-50 bg-[#064E3B]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedListing(null);
          }}
        >
          <div className="bg-white w-full max-w-xl rounded-lg border border-[#E7E5E4] p-6 shadow-xl relative my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E7E5E4] mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border ${
                      selectedListing._isVeg
                        ? 'bg-[#D1FAE5] text-[#059669] border-[#059669]/30'
                        : 'bg-[#FEF2F2] text-[#EA580C] border-[#EA580C]/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedListing._isVeg ? 'bg-[#059669]' : 'bg-[#EA580C]'
                      }`}
                    />
                    {selectedListing._isVeg ? 'Pure Veg' : 'Non-Veg'}
                  </span>
                  <span className="text-xs font-medium text-[#6B7280]">
                    {selectedListing.foodType}
                  </span>
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#064E3B]">
                  {selectedListing.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                aria-label="Close details"
                className="w-8 h-8 rounded-lg border border-[#E7E5E4] flex items-center justify-center text-[#6B7280] hover:text-[#064E3B] hover:bg-[#F0FDF8] cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4">
              {/* Photo Preview if available */}
              {selectedListing.photoUrl && (
                <div className="w-full h-48 rounded-lg overflow-hidden border border-[#E7E5E4] bg-[#F0FDF8]">
                  <img
                    src={selectedListing.photoUrl}
                    alt={selectedListing.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Core Specs Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#F0FDF8] border border-[#E7E5E4] text-sm">
                <div>
                  <span className="text-xs text-[#6B7280] block">Available Quantity</span>
                  <span className="font-bold text-[#064E3B]">
                    {selectedListing.quantity} {selectedListing.unit || 'portions'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#6B7280] block">Safe Eating Window</span>
                  <span className="font-bold text-[#EA580C]">
                    {calculateTimeLeft(selectedListing, currentTime).text}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#6B7280] block">Pickup Window</span>
                  <span className="font-medium text-[#064E3B]">{selectedListing.pickupWindow}</span>
                </div>
                <div>
                  <span className="text-xs text-[#6B7280] block">Location Area</span>
                  <span className="font-medium text-[#064E3B]">{selectedListing.location}</span>
                </div>
              </div>

              {/* Donor Organization & Safety Declaration */}
              <div>
                <h4 className="font-serif text-sm font-bold text-[#064E3B] mb-1">
                  Food Source &amp; Preparation
                </h4>
                <p className="text-sm text-[#6B7280] leading-relaxed mb-3">
                  {selectedListing.notes || 'Unserved food freshly packed in food-grade containers.'}
                </p>

                {selectedListing.donorOrg && (
                  <div className="p-3 rounded-lg border border-[#E7E5E4] bg-white flex items-center justify-between text-xs text-[#6B7280]">
                    <span>Listed by: <strong className="text-[#064E3B]">{selectedListing.donorOrg}</strong></span>
                    {selectedListing.fssaiNumber && (
                      <span className="text-[#059669] font-semibold">FSSAI: {selectedListing.fssaiNumber}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Safety Compliance Checklist */}
              <div className="p-3.5 rounded-lg bg-[#D1FAE5] border border-[#E7E5E4] text-xs space-y-1.5 text-[#064E3B]">
                <div className="font-bold text-sm text-[#059669] mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Safety Inspection Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Prepared in licensed food premises and kept at regulated holding temperatures</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Packed in clean, food-grade sealed trays ready for transit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Protected under statutory Good Samaritan food redistribution rules</span>
                </div>

                {/* AI Safety Assessment in Modal */}
                {selectedListing.safetyVerdict && (
                  <div className="mt-3 pt-3 border-t border-[#E7E5E4] space-y-2">
                    {/* Safe Verdict */}
                    {(selectedListing.safetyVerdict === 'safe' || selectedListing.safetyVerdict === 'Looks safe') && (
                      <div className="p-3 rounded-xl border border-[#A7F3D0] bg-[#F0FDF8] text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[#059669] font-bold">
                          <span className="material-symbols-outlined text-[16px]">verified_user</span>
                          <span>AI Food Safety: VERIFIED SAFE</span>
                          {typeof (selectedListing as any).safetyScore === 'number' && (
                            <span className="text-[11px] opacity-80">({(selectedListing as any).safetyScore}/100)</span>
                          )}
                        </div>
                        {selectedListing.safetyVerdictReason && (
                          <p className="text-[#064E3B] opacity-90">{selectedListing.safetyVerdictReason}</p>
                        )}
                      </div>
                    )}

                    {/* Caution Verdict */}
                    {selectedListing.safetyVerdict === 'caution' && (
                      <div className="p-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[#D97706] font-bold">
                          <span className="material-symbols-outlined text-[16px]">warning</span>
                          <span>AI Food Safety: CAUTION / VERIFICATION REQUIRED</span>
                          {typeof (selectedListing as any).safetyScore === 'number' && (
                            <span className="text-[11px] opacity-80">({(selectedListing as any).safetyScore}/100)</span>
                          )}
                        </div>
                        <p className="text-[#92400E]">
                          {selectedListing.safetyVerdictReason || 'Inspection recommended upon pickup to confirm temperature and packaging seal.'}
                        </p>
                      </div>
                    )}

                    {/* Unsafe Verdict */}
                    {(selectedListing.safetyVerdict === 'unsafe' || selectedListing.safetyVerdict === 'Flagged for review') && (
                      <div className="p-3.5 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] text-xs space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[#DC2626] font-bold text-sm">
                          <span className="material-symbols-outlined text-[20px]">dangerous</span>
                          <span>Safety Alert: High Risk / Holding Window Exceeded</span>
                        </div>
                        <p className="text-[#991B1B] leading-relaxed">
                          This surplus food batch was flagged as high-risk or exceeding the FSSAI safe holding threshold. It is not deleted, but recipient organizations must perform strict physical verification (temperature, aroma, texture, and packaging integrity) upon pickup before distributing.
                        </p>
                        {selectedListing.safetyVerdictReason && (
                          <div className="p-2 rounded bg-white/80 border border-[#FECACA] text-[#B91C1C] font-semibold text-[11px]">
                            {selectedListing.safetyVerdictReason}
                          </div>
                        )}
                        {Array.isArray((selectedListing as any).safetyReasons) && (selectedListing as any).safetyReasons.length > 0 && (
                          <ul className="list-disc list-inside text-[#991B1B] text-[11px] space-y-0.5">
                            {(selectedListing as any).safetyReasons.map((r: string, idx: number) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Mandatory acknowledgement if unsafe */}
                    {selectedListing.safetyVerdict === 'unsafe' && (
                      <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#FCA5A5] bg-[#FFF5F5] cursor-pointer text-xs text-[#991B1B]">
                        <input
                          type="checkbox"
                          checked={physicalVerificationConfirmed}
                          onChange={(e) => setPhysicalVerificationConfirmed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-[#FCA5A5] text-[#DC2626] focus:ring-[#DC2626]"
                        />
                        <span className="font-semibold leading-relaxed">
                          I acknowledge the safety warning and confirm that our recipient staff will conduct mandatory physical verification upon pickup prior to consumption.
                        </span>
                      </label>
                    )}

                    {/* Disclaimer */}
                    <p className="text-[11px] text-[#6B7280] italic">
                      Advisory notice: Automated AI check is an assistive tool evaluated under FSSAI surplus food regulations and does not replace mandatory physical inspection upon collection.
                    </p>
                  </div>
                )}
              </div>

              {/* Allergen Declaration */}
              {selectedListing.allergens && selectedListing.allergens.length > 0 && (
                <div className="p-3 rounded-lg border border-[#E7E5E4] bg-[#FFFBEB] text-xs">
                  <div className="font-bold text-[#064E3B] mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#EA580C]">warning</span>
                    Allergen Declaration (FSSAI)
                  </div>
                  {selectedListing.allergens.includes('None') ? (
                    <span className="text-[#059669] font-semibold">No common allergens declared</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedListing.allergens.map((a) => (
                        <span
                          key={a}
                          className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#EA580C] border border-[#EA580C]/20 font-semibold"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Storage Condition */}
              {selectedListing.storageCondition && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E7E5E4] bg-[#F0FDF8] text-xs">
                  <span className="material-symbols-outlined text-[16px] text-[#059669]">thermostat</span>
                  <span className="text-[#6B7280]">Storage:</span>
                  <span className="font-semibold text-[#064E3B]">{selectedListing.storageCondition}</span>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-[#E7E5E4] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[#6B7280]">
                Free for verified shelters and registered non-profits
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedListing(null);
                    setPhysicalVerificationConfirmed(false);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border border-[#E7E5E4] text-sm font-semibold text-[#064E3B] hover:bg-[#F0FDF8] transition-colors min-h-[44px] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isClaiming || (selectedListing.safetyVerdict === 'unsafe' && !physicalVerificationConfirmed)}
                  onClick={() => handleClaimListing(selectedListing)}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClaiming ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">
                        progress_activity
                      </span>
                      <span>Claiming...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                      <span>Claim food</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* 📲 Secure QR Code Handover Handshake Modal */}
      {deliveryQrClaim && (
        <QrHandshakeModal
          isOpen={Boolean(deliveryQrClaim)}
          onClose={() => setDeliveryQrClaim(null)}
          stage="delivery"
          mode="scan"
          listingId={deliveryQrClaim.id}
          foodTitle={deliveryQrClaim.title}
          quantityStr={`${deliveryQrClaim.quantity} ${deliveryQrClaim.unit}`}
          expectedCode={deliveryQrClaim.handoffCode || 'FL-DL-9923'}
          shelterOrg={userProfile?.orgName || userProfile?.displayName || 'Community Shelter'}
          onSuccess={() => {
            handleConfirmPickupReceived(deliveryQrClaim.id);
            setDeliveryQrClaim(null);
          }}
        />
      )}
    </div>
  );
};
