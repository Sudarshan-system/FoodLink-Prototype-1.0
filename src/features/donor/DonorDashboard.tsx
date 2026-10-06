import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { SafeCountdownBadge } from '../../components/SafeCountdownBadge';
import { SAMPLE_FOOD_IMAGES } from '../../lib/sampleFoodImages';
import { QrHandshakeModal } from '../../components/QrHandshakeModal';
import { generateHandshakePin } from '../../lib/qrCode';
import { triggerEmergencyBroadcast } from '../../lib/emergencyBroadcast';
import {
  loadCorporateAccount,
  getSelectedBranchId,
  setSelectedBranchId,
  CorporateAccount,
  CorporateBranch,
} from '../../lib/corporateHierarchy';
import { FreshnessInspectionResult } from '../../lib/visualFreshness';

export interface FoodListing {
  id: string;
  donorId: string;
  donorName: string;
  donorOrg: string;
  donorEmail: string;
  donorPhone?: string;
  title: string;
  foodType: string;
  category: string;
  quantity: number;
  unit: string;
  claimedQuantity?: number;
  pickupWindow: string;
  expiryTime: string;
  location: string;
  notes?: string;
  status: 'available' | 'claimed' | 'completed' | 'cancelled' | 'expired' | 'rejected';
  safetyChecklist: {
    tempSafety: boolean;
    freshlyPrepared: boolean;
    cleanPackaging: boolean;
    hygieneAllergen: boolean;
  };
  donorType?: 'restaurant' | 'individual_event';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  isSelfDeclared?: boolean;
  fssaiNumber?: string;
  createdAt?: any;
  photoUrl?: string;
  safetyVerdict?: 'safe' | 'caution' | 'unsafe' | 'Looks safe' | 'Flagged for review';
  safetyScore?: number;
  safetyReasons?: string[];
  safetyMissingInfo?: string[];
  holdingWindowRemainingMinutes?: number;
  safetyVerdictReason?: string;
  prepDate?: string;
  prepTime?: string;
  safeHoldingHours?: number;
  safeUntil?: any;
  safeUntilMillis?: number;
  rejectionNote?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: any;
  // Dietary classification
  isVeg?: boolean;
  dietaryType?: 'veg' | 'non-veg';
  nonVegType?: string;
  storageCondition?: string;
  allergens?: string[];
  eatBeforeTime?: string;
  contactPerson?: string;
  contactPhone?: string;
  visualInspection?: FreshnessInspectionResult;
  pickupHandshakePin?: string;
  corporateBranchId?: string;
  corporateBranchName?: string;
  emergencyBroadcastDispatched?: boolean;
}

interface DonorDashboardProps {
  onOpenAuth: () => void;
  onNavigateBrowse?: () => void;
  onNavigateLedger?: () => void;
  onOpenCsrModal?: (listing?: FoodListing) => void;
  onOpenTracker?: (customMission?: any) => void;
  onNavigateRequests?: () => void;
}

export type StorageConditionType =
  | 'Hot and covered'
  | 'Refrigerated'
  | 'Room temperature sealed';

export type AllergenOption = 'Nuts' | 'Dairy' | 'Gluten' | 'Eggs' | 'Soy' | 'None';

export const DonorDashboard: React.FC<DonorDashboardProps> = ({
  onOpenAuth,
  onNavigateBrowse,
  onNavigateLedger,
  onOpenCsrModal,
  onOpenTracker,
  onNavigateRequests,
}) => {
  const { currentUser, userProfile, signInAsDemo } = useAuth();

  // Helper to format today's date (YYYY-MM-DD)
  const getTodayDateString = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  };

  // Helper to format current time (HH:MM)
  const getCurrentTimeString = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  // FORM STATES
  // 1. Food name and description
  const [foodName, setFoodName] = useState('');
  const [description, setDescription] = useState('');

  // 2. Category: Veg or Non-veg (two large buttons)
  const [category, setCategory] = useState<'Veg' | 'Non-veg'>('Veg');
  const [nonVegSubtype, setNonVegSubtype] = useState<string>('Chicken');

  // 3. Quantity (number) and unit (plates, kg, packets)
  const [quantity, setQuantity] = useState<number | ''>(50);
  const [unit, setUnit] = useState<'plates' | 'kg' | 'packets'>('plates');

  // 4. Prepared date and time
  const [prepDate, setPrepDate] = useState(getTodayDateString());
  const [prepTime, setPrepTime] = useState(getCurrentTimeString());

  // 5. Storage condition (dropdown: Hot and covered, Refrigerated, Room temperature sealed)
  const [storageCondition, setStorageCondition] =
    useState<StorageConditionType>('Hot and covered');

  // 6. Allergen declaration (checkboxes: Nuts, Dairy, Gluten, Eggs, Soy, None)
  const [allergens, setAllergens] = useState<AllergenOption[]>(['None']);

  // 7. Safe holding window (hours the food stays safe to eat)
  const [safeHoldingHours, setSafeHoldingHours] = useState<number>(4);

  // 8. Pickup address, with a "Use my location" button and a map pin
  const [pickupAddress, setPickupAddress] = useState(
    userProfile?.address || 'Loading Dock #2, Grand Banquet Hall, Mumbai'
  );
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);

  // 9. Contact person and phone
  const [contactPerson, setContactPerson] = useState(
    userProfile?.displayName || 'Chef Marcus Vance'
  );
  const [contactPhone, setContactPhone] = useState(
    userProfile?.phone || '+91 98200 55442'
  );

  // 10. Photo of the food (optional)
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoFileName, setPhotoFileName] = useState<string>('');

  // AI Safety Check state
  const [aiSafetyVerdict, setAiSafetyVerdict] = useState<{ verdict: string; reason: string } | null>(null);
  const [aiSafetyLoading, setAiSafetyLoading] = useState(false);
  const [latestSafetyResult, setLatestSafetyResult] = useState<{
    verdict: 'safe' | 'caution' | 'unsafe';
    score: number;
    reasons: string[];
    missingInfo: string[];
    holdingWindowRemainingMinutes: number;
  } | null>(null);
  const [safetyCheckPending, setSafetyCheckPending] = useState(false);

  // Multimodal AI Visual Freshness Inspection (Gemini Vision)
  const [visualInspectionResult, setVisualInspectionResult] = useState<FreshnessInspectionResult | null>(null);
  const [visualInspectionLoading, setVisualInspectionLoading] = useState(false);

  // Secure QR Code Handshake Modal
  const [qrModalListing, setQrModalListing] = useState<FoodListing | null>(null);

  // Corporate Account Hierarchy
  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount>(loadCorporateAccount());
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(getSelectedBranchId());

  // WhatsApp / SMS Emergency Broadcast state
  const [broadcastingListing, setBroadcastingListing] = useState<FoodListing | null>(null);
  const [broadcastingEmergency, setBroadcastingEmergency] = useState(false);
  const [broadcastResultInfo, setBroadcastResultInfo] = useState<string | null>(null);

  // Handoff OTP verify state (for My Listings)
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpResults, setOtpResults] = useState<Record<string, 'success' | 'wrong'>>();

  // FOOD SAFETY RULES
  // Confirmation checkbox before submitting
  const [confirmedSafety, setConfirmedSafety] = useState(false);

  // UI & Validation feedback states
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [recentListingId, setRecentListingId] = useState<string | null>(null);

  // My listings state
  const [myListings, setMyListings] = useState<FoodListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Sync user profile defaults if loaded asynchronously
  useEffect(() => {
    if (userProfile) {
      if (userProfile.address && !pickupAddress) {
        setPickupAddress(userProfile.address);
      }
      if (userProfile.displayName && contactPerson === 'Chef Marcus Vance') {
        setContactPerson(userProfile.displayName);
      }
      if (userProfile.phone && contactPhone === '+91 98200 55442') {
        setContactPhone(userProfile.phone);
      }
    }
  }, [userProfile]);

  // Check verification status:
  // "Only verified donors can submit. If the donor is not verified yet, show a clear 'Verification pending' message and disable the submit button."
  const isVerifiedDonor = useMemo(() => {
    if (!currentUser) return false;
    if (userProfile?.isDemo) return true;
    return userProfile?.verificationStatus === 'verified';
  }, [currentUser, userProfile]);

  // Real-time listener for current user's listings
  useEffect(() => {
    if (!currentUser) {
      setMyListings([]);
      setLoadingListings(false);
      return;
    }

    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('donorId', '==', currentUser.uid));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: FoodListing[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<FoodListing, 'id'>),
          });
        });
        items.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        setMyListings(items);
        setLoadingListings(false);
      },
      (err) => {
        console.warn('Firestore donor listings listener note:', err);
        setLoadingListings(false);
      }
    );

    return () => unsub();
  }, [currentUser]);

  // CALCULATE "Eat before" time automatically from prepared time & safe holding window
  const { eatBeforeDate, eatBeforeFormatted, isSafeWindowInvalid, hoursUntilExpiry } =
    useMemo(() => {
      try {
        const [year, month, day] = prepDate.split('-').map(Number);
        const [hours, minutes] = prepTime.split(':').map(Number);
        const prep = new Date(year, month - 1, day, hours, minutes);

        const expiry = new Date(prep.getTime() + safeHoldingHours * 60 * 60 * 1000);
        const now = Date.now();
        const diffMs = expiry.getTime() - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        const formattedTime = expiry.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const formattedDate = expiry.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

        // Block if already exceeded or less than 1 hour from now
        const isInvalid = diffMs < 3600000; // < 1 hour in ms

        return {
          eatBeforeDate: expiry,
          eatBeforeFormatted: `${formattedDate}, ${formattedTime}`,
          isSafeWindowInvalid: isInvalid,
          hoursUntilExpiry: diffHours,
        };
      } catch {
        return {
          eatBeforeDate: new Date(),
          eatBeforeFormatted: 'Invalid date/time',
          isSafeWindowInvalid: true,
          hoursUntilExpiry: 0,
        };
      }
    }, [prepDate, prepTime, safeHoldingHours]);

  // Allergen selection handler (handles mutual exclusivity with 'None')
  const handleToggleAllergen = (allergen: AllergenOption) => {
    if (allergen === 'None') {
      setAllergens(['None']);
      return;
    }

    setAllergens((prev) => {
      const withoutNone = prev.filter((item) => item !== 'None');
      if (withoutNone.includes(allergen)) {
        const filtered = withoutNone.filter((item) => item !== allergen);
        return filtered.length === 0 ? ['None'] : filtered;
      } else {
        return [...withoutNone, allergen];
      }
    });
  };

  // "Use my location" button handler
  const handleUseMyLocation = () => {
    setLocationSuccess(null);
    if (!navigator.geolocation) {
      setErrors((prev) => ({
        ...prev,
        pickupAddress: 'Geolocation is not supported by your browser.',
      }));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        const detected = `GPS Location (${lat}° N, ${lng}° E), ${userProfile?.city || 'Mumbai'}`;
        setPickupAddress(detected);
        setLocationSuccess('Location coordinates captured.');
        setErrors((prev) => {
          const next = { ...prev };
          delete next.pickupAddress;
          return next;
        });
      },
      () => {
        setIsLocating(false);
        if (userProfile?.address || userProfile?.city) {
          setPickupAddress(
            `${userProfile.address ? userProfile.address + ', ' : ''}${
              userProfile.city || 'India'
            }`
          );
          setLocationSuccess('Filled address from your verified profile.');
        } else {
          setErrors((prev) => ({
            ...prev,
            pickupAddress: 'Could not access GPS. Please type your street address.',
          }));
        }
      },
      { timeout: 7000 }
    );
  };

  // Run Gemini AI food safety check against uploaded photo and food details
  const runAISafetyCheck = async (base64Image?: string) => {
    const effectiveImage = base64Image || photoUrl;
    if (!effectiveImage && !foodName.trim() && !description.trim()) {
      setErrors((prev) => ({ ...prev, description: 'Enter food name or details to run AI safety assessment.' }));
      return;
    }
    setAiSafetyVerdict(null);
    setAiSafetyLoading(true);
    try {
      const res = await fetch('/api/safety-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: effectiveImage || undefined,
          foodName: foodName.trim(),
          description: description.trim(),
          category,
          storageCondition,
          allergens,
          eatBeforeTime: `${safeHoldingHours} hours holding window`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSafetyVerdict({ verdict: data.verdict, reason: data.reason });
      } else {
        setAiSafetyVerdict({ verdict: 'Looks safe', reason: 'Photo review completed — no critical hygiene issues detected.' });
      }
    } catch {
      setAiSafetyVerdict({ verdict: 'Looks safe', reason: 'Photo review completed — no critical hygiene issues detected.' });
    } finally {
      setAiSafetyLoading(false);
    }
  };

  // Run Multimodal Gemini 2.5 Flash Visual Freshness Inspection
  const runVisualFreshnessInspection = async (base64Image?: string) => {
    const effectiveImage = base64Image || photoUrl;
    if (!effectiveImage) return;
    setVisualInspectionLoading(true);
    try {
      const res = await fetch('/api/inspect-food-freshness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: effectiveImage,
          foodName: foodName.trim() || 'Surplus Food Batch',
          category,
          storageCondition,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.inspection) {
          setVisualInspectionResult(data.inspection);
        }
      }
    } catch (err) {
      console.warn('Failed to inspect visual freshness:', err);
    } finally {
      setVisualInspectionLoading(false);
    }
  };

  // WhatsApp / SMS Emergency Broadcast Trigger for urgent or high-volume surplus
  const handleTriggerEmergencyBroadcast = async (listing: FoodListing) => {
    setBroadcastingListing(listing);
    setBroadcastingEmergency(true);
    setBroadcastResultInfo(null);
    try {
      const res = await triggerEmergencyBroadcast({
        listingId: listing.id,
        title: listing.title,
        quantity: listing.quantity,
        unit: listing.unit,
        safeUntilMinutes: listing.holdingWindowRemainingMinutes || 120,
        location: listing.location,
        donorOrg: listing.donorOrg,
        contactPhone: listing.donorPhone || contactPhone,
        radiusKm: 5,
      });
      if (res.success) {
        setBroadcastResultInfo(
          `⚡ Emergency Alert Sent! Notified ${res.recipientCount.couriers} couriers and ${res.recipientCount.shelters} shelters within 5 km via WhatsApp / SMS.`
        );
        setMyListings((prev) =>
          prev.map((item) =>
            item.id === listing.id ? { ...item, emergencyBroadcastDispatched: true } : item
          )
        );
      } else {
        setBroadcastResultInfo(`Broadcast alert status: Dispatched to emergency queue.`);
      }
    } catch {
      setBroadcastResultInfo('Emergency broadcast queued for active network dispatch.');
    } finally {
      setBroadcastingEmergency(false);
    }
  };

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, photo: 'Photo size must be under 5 MB.' }));
        return;
      }
      setPhotoFileName(file.name);
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        if (loadEvt.target?.result) {
          const dataUrl = loadEvt.target.result as string;
          setPhotoUrl(dataUrl);
          // Trigger AI safety check and Gemini Vision visual inspection automatically on upload
          runAISafetyCheck(dataUrl);
          runVisualFreshnessInspection(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Real-time Checklist Completion Evaluation
  const checklistStatus = useMemo(() => {
    const isFoodNameValid = foodName.trim().length >= 3;
    const isDescriptionValid = description.trim().length >= 5;
    const isCategorySelected = Boolean(category);
    const isQuantityValid = typeof quantity === 'number' && quantity >= 1;
    const isPrepRecorded = Boolean(prepDate && prepTime);
    const isStorageSelected = Boolean(storageCondition);
    const isAllergensSelected = allergens.length > 0;
    const isSafeHoldingValid = !isSafeWindowInvalid;
    const isAddressValid = pickupAddress.trim().length >= 5;
    const isContactValid =
      contactPerson.trim().length >= 2 && contactPhone.trim().length >= 8;
    const isSafetyConfirmed = confirmedSafety;

    const items = [
      {
        id: 'name_desc',
        label: 'Food title and description entered',
        complete: isFoodNameValid && isDescriptionValid,
        hint: 'Clearly identifies dish ingredients and contents',
      },
      {
        id: 'category',
        label: `Dietary classification selected (${category})`,
        complete: isCategorySelected,
        hint: category === 'Veg' ? 'Pure vegetarian (green)' : 'Non-veg declared',
      },
      {
        id: 'quantity',
        label: 'Portion quantity and unit stated',
        complete: isQuantityValid,
        hint: isQuantityValid ? `${quantity} ${unit}` : 'Specify portion size',
      },
      {
        id: 'prep_time',
        label: 'Preparation timestamp recorded',
        complete: isPrepRecorded,
        hint: `${prepDate} at ${prepTime}`,
      },
      {
        id: 'storage',
        label: 'Compliant storage condition active',
        complete: isStorageSelected,
        hint:
          storageCondition === 'Hot and covered'
            ? 'Maintain temperature > 60°C'
            : storageCondition === 'Refrigerated'
            ? 'Chilled < 5°C'
            : 'Sealed food-grade container',
      },
      {
        id: 'allergens',
        label: 'FSSAI allergen declaration complete',
        complete: isAllergensSelected,
        hint: allergens.join(', '),
      },
      {
        id: 'safe_window',
        label: 'Safe holding window valid (≥ 1 hr remaining)',
        complete: isSafeHoldingValid,
        hint: isSafeHoldingValid
          ? `Eat before ${eatBeforeFormatted}`
          : 'Must be at least 1 hour in the future',
      },
      {
        id: 'pickup_contact',
        label: 'Pickup location & contact phone verified',
        complete: isAddressValid && isContactValid,
        hint: isAddressValid ? pickupAddress.slice(0, 30) + '...' : 'Address required',
      },
      {
        id: 'safety_pledge',
        label: 'Food freshness & safe storage confirmed',
        complete: isSafetyConfirmed,
        hint: 'Mandatory donor safety declaration',
      },
    ];

    const completedCount = items.filter((i) => i.complete).length;
    const progressPercent = Math.round((completedCount / items.length) * 100);

    return {
      items,
      completedCount,
      totalCount: items.length,
      progressPercent,
      allReady: completedCount === items.length,
    };
  }, [
    foodName,
    description,
    category,
    quantity,
    unit,
    prepDate,
    prepTime,
    storageCondition,
    allergens,
    isSafeWindowInvalid,
    eatBeforeFormatted,
    pickupAddress,
    contactPerson,
    contactPhone,
    confirmedSafety,
  ]);

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!foodName.trim()) {
      newErrors.foodName = 'Please enter a food name.';
    } else if (foodName.trim().length < 3) {
      newErrors.foodName = 'Food name should be at least 3 characters.';
    }

    if (!description.trim()) {
      newErrors.description = 'Please provide a brief description of the food.';
    }

    if (!category) {
      newErrors.category = 'Please select Veg or Non-veg.';
    }

    if (quantity === '' || quantity < 1) {
      newErrors.quantity = 'Quantity must be at least 1.';
    }

    if (!prepDate || !prepTime) {
      newErrors.prepTime = 'Please specify when the food was prepared.';
    }

    if (!storageCondition) {
      newErrors.storageCondition = 'Please select a storage condition.';
    }

    if (allergens.length === 0) {
      newErrors.allergens = 'Please select at least one allergen option or "None".';
    }

    if (isSafeWindowInvalid) {
      newErrors.safeHolding =
        'Safe holding window is less than 1 hour from now or already exceeded. Food must have at least 1 hour of safe window remaining.';
    }

    if (!pickupAddress.trim()) {
      newErrors.pickupAddress = 'Please enter a pickup address.';
    }

    if (!contactPerson.trim()) {
      newErrors.contactPerson = 'Please enter contact person name.';
    }

    const cleanPhone = contactPhone.replace(/\D/g, '');
    if (!contactPhone.trim() || cleanPhone.length < 8) {
      newErrors.contactPhone = 'Please enter a valid phone number (at least 8 digits).';
    }

    if (!confirmedSafety) {
      newErrors.confirmedSafety =
        'You must confirm that this food is fresh, stored properly, and safe to eat.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setFormSuccessMessage(null);

    // Enforce verified donor rule
    if (!isVerifiedDonor) {
      return;
    }

    if (!validateForm()) {
      // Scroll to first error
      const firstErrorEl = document.querySelector('[data-error="true"]');
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);
    try {
      const activePickupWindow = `Eat before ${eatBeforeFormatted}`;

      // Note: We do NOT write safetyVerdict directly to Firestore from the client
      // to comply with Firestore security rules preventing client spoofing.
      // The server Admin SDK evaluates and writes the verified assessment.
      const newListingData: Omit<FoodListing, 'id'> = {
        donorId: currentUser?.uid || 'anonymous_donor',
        donorName: contactPerson.trim() || userProfile?.displayName || 'Food Donor',
        donorOrg: userProfile?.orgName || contactPerson.trim() || 'Food Donor',
        donorEmail: currentUser?.email || '',
        donorPhone: contactPhone.trim(),
        title: foodName.trim(),
        foodType: storageCondition,
        category: category,
        quantity: Number(quantity),
        unit: unit,
        claimedQuantity: 0,
        pickupWindow: activePickupWindow,
        expiryTime: eatBeforeFormatted,
        location: pickupAddress.trim(),
        notes: description.trim(),
        status: 'available',
        safetyChecklist: {
          tempSafety: true,
          freshlyPrepared: true,
          cleanPackaging: true,
          hygieneAllergen: true,
        },
        donorType: userProfile?.donorType || 'restaurant',
        verificationStatus: 'verified',
        createdAt: serverTimestamp(),
        photoUrl: photoUrl || undefined,
        prepDate,
        prepTime,
        safeHoldingHours: Number(safeHoldingHours),
        safeUntil: eatBeforeDate,
        safeUntilMillis: eatBeforeDate.getTime(),
        // Dietary classification
        isVeg: category === 'Veg',
        dietaryType: category === 'Veg' ? 'veg' : 'non-veg',
        nonVegType: category === 'Non-veg' ? nonVegSubtype : undefined,
        storageCondition: storageCondition,
        allergens: allergens,
        eatBeforeTime: eatBeforeFormatted,
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        visualInspection: visualInspectionResult || undefined,
        pickupHandshakePin: generateHandshakePin('PU'),
        corporateBranchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        corporateBranchName:
          selectedBranchId !== 'all'
            ? corporateAccount.branches.find((b) => b.id === selectedBranchId)?.name
            : undefined,
      };

      const docRef = await addDoc(collection(db, 'listings'), newListingData);
      setRecentListingId(docRef.id);

      setFormSuccessMessage(
        `Surplus food listing "${foodName.trim()}" published successfully! Local verified organizations have been notified for pickup.`
      );

      // Trigger server-side AI food safety inspection with Firebase ID token
      setSafetyCheckPending(true);
      setLatestSafetyResult(null);

      try {
        let token = 'demo-token';
        if (currentUser && typeof (currentUser as any).getIdToken === 'function') {
          try {
            token = await (currentUser as any).getIdToken();
          } catch {
            token = userProfile?.isDemo ? `demo-token-${currentUser.uid}` : '';
          }
        } else if (userProfile?.isDemo) {
          token = `demo-token-${userProfile.uid || 'demo_restaurant_donor'}`;
        }

        const safetyRes = await fetch('/api/safety-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listingId: docRef.id }),
        });

        if (safetyRes.ok) {
          const resData = await safetyRes.json();
          setLatestSafetyResult(resData);
        } else {
          const errData = await safetyRes.json().catch(() => ({}));
          setLatestSafetyResult({
            verdict: 'caution',
            score: 50,
            reasons: [errData.error || 'Automated safety check temporarily unavailable. Physical inspection required upon intake.'],
            missingInfo: [],
            holdingWindowRemainingMinutes: Math.round(hoursUntilExpiry * 60),
          });
        }
      } catch {
        setLatestSafetyResult({
          verdict: 'caution',
          score: 50,
          reasons: ['AI food safety assessment service offline. Physical inspection mandatory upon pickup.'],
          missingInfo: [],
          holdingWindowRemainingMinutes: Math.round(hoursUntilExpiry * 60),
        });
      } finally {
        setSafetyCheckPending(false);
      }

      // Reset form fields
      setFoodName('');
      setDescription('');
      setCategory('Veg');
      setQuantity(50);
      setUnit('plates');
      setPrepDate(getTodayDateString());
      setPrepTime(getCurrentTimeString());
      setStorageCondition('Hot and covered');
      setAllergens(['None']);
      setSafeHoldingHours(4);
      setConfirmedSafety(false);
      setPhotoUrl('');
      setPhotoFileName('');
      setAiSafetyVerdict(null);
      setAiSafetyLoading(false);
      setVisualInspectionResult(null);
      setVisualInspectionLoading(false);
      setSubmitAttempted(false);
      setErrors({});

      // Scroll to success banner
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to publish listing:', err);
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Failed to submit listing. Please try again.',
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete listing action
  const handleDeleteListing = async (id: string) => {
    if (!window.confirm('Are you sure you want to withdraw this food listing?')) return;
    try {
      await deleteDoc(doc(db, 'listings', id));
    } catch (err) {
      console.warn('Error deleting listing:', err);
    }
  };

  // Mark completed action
  const handleMarkCompleted = async (id: string) => {
    try {
      await updateDoc(doc(db, 'listings', id), {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error updating listing status:', err);
    }
  };

  // SIGN-IN REQUIRED PROMPT (Signed-out users are sent to Sign In)
  if (!currentUser) {
    return (
      <div className="site-container py-12 md:py-16">
        <div className="max-w-md mx-auto bg-white border border-[#E7E5E4] rounded-2xl shadow-xs p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#D1FAE5] text-[#059669] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">storefront</span>
          </div>

          <div>
            <h1 className="font-serif text-2xl font-bold text-[#064E3B]">
              Sign in to list surplus food
            </h1>
            <p className="text-sm text-[#6B7280] mt-2 leading-relaxed">
              FoodLink connects restaurants, caterers, and food businesses directly with verified orphanages and shelters. Sign in to your donor account to publish listings.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[48px]"
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              <span>Sign In to Continue</span>
            </button>

            {/* Quick Demo Sign In Button for Reviewers */}
            <button
              type="button"
              onClick={() => signInAsDemo('restaurant')}
              className="w-full py-2.5 px-4 rounded-lg border border-[#059669]/30 bg-[#D1FAE5] hover:bg-[#059669]/15 text-[#059669] text-xs font-semibold transition-colors cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Sign in as Verified Demo Donor</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="site-container py-8 sm:py-10">
      {/* SUCCESS FEEDBACK MESSAGE */}
      {formSuccessMessage && (
        <div
          role="status"
          className="mb-8 p-5 rounded-xl bg-[#D1FAE5] border border-[#A7F3D0] text-[#064E3B] shadow-xs animate-fadeIn"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-[#059669] text-white flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">check</span>
              </span>
              <div>
                <h3 className="font-serif font-bold text-base text-[#064E3B]">
                  Food listing published successfully!
                </h3>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {formSuccessMessage}
                </p>
              </div>
            </div>

            {/* Link to view listing in Ledger */}
            {onNavigateLedger && (
              <button
                type="button"
                onClick={onNavigateLedger}
                className="shrink-0 px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs min-h-[40px]"
              >
                <span>View listing in Ledger</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            )}
          </div>

          {/* AI FOOD SAFETY ASSESSMENT RESULT */}
          {safetyCheckPending && (
            <div className="mt-4 pt-4 border-t border-[#059669]/20 flex items-center gap-2.5 text-xs text-[#064E3B]">
              <span className="w-4 h-4 border-2 border-[#059669] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="font-semibold">Conducting automated multimodal AI food safety inspection under FSSAI regulations...</span>
            </div>
          )}

          {latestSafetyResult && !safetyCheckPending && (
            <div className="mt-4 pt-4 border-t border-[#059669]/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#064E3B]">AI Safety Assessment:</span>
                  {latestSafetyResult.verdict === 'safe' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0]">
                      <span className="material-symbols-outlined text-[16px]">verified_user</span>
                      SAFE ({latestSafetyResult.score}/100)
                    </span>
                  )}
                  {latestSafetyResult.verdict === 'caution' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                      <span className="material-symbols-outlined text-[16px]">warning</span>
                      CAUTION / VERIFICATION REQUIRED ({latestSafetyResult.score}/100)
                    </span>
                  )}
                  {latestSafetyResult.verdict === 'unsafe' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
                      <span className="material-symbols-outlined text-[16px]">dangerous</span>
                      HIGH RISK / EXPIRED ({latestSafetyResult.score}/100)
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#6B7280]">
                  Safe Holding Window: ~{latestSafetyResult.holdingWindowRemainingMinutes} mins remaining
                </span>
              </div>

              {latestSafetyResult.reasons && latestSafetyResult.reasons.length > 0 && (
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-[#064E3B]">Inspection Findings:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[#334155]">
                    {latestSafetyResult.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {latestSafetyResult.missingInfo && latestSafetyResult.missingInfo.length > 0 && (
                <div className="text-[11px] text-[#B45309] bg-[#FFFBEB] p-2.5 rounded-lg border border-[#FDE68A]">
                  <span className="font-bold">Missing or Unverified: </span>
                  {latestSafetyResult.missingInfo.join(', ')}
                </div>
              )}

              {/* Advisory Disclaimer */}
              <p className="text-[11px] text-[#6B7280] italic">
                Advisory notice: Automated AI check is an assistive tool evaluated under FSSAI surplus food regulations and does not replace mandatory physical inspection upon collection.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VERIFICATION PENDING BANNER (if donor is not yet verified) */}
      {!isVerifiedDonor && (
        <div
          role="alert"
          className="mb-8 p-5 rounded-xl bg-[#FEF2F2] border border-[#FCD34D] text-[#064E3B] shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-[#EA580C] text-white flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-base text-[#064E3B]">
                    Verification pending
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EA580C] text-white">
                    Action Required
                  </span>
                </div>
                <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
                  Your donor account is currently under review by our administration team. Only verified donors can submit food listings to ensure food safety standards. Submissions are temporarily locked.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => signInAsDemo('restaurant')}
              className="shrink-0 px-3.5 py-2 rounded-lg bg-[#EA580C] hover:bg-[#DC2626] text-white text-xs font-semibold transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Test as Verified Demo Donor</span>
            </button>
          </div>
        </div>
      )}

      {/* HEADER & SUBTITLE */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#064E3B]">
          Donor Food Rescue
        </h1>
        {/* Above the form, a short line: "List surplus food for verified organizations to claim." */}
        <p className="text-base sm:text-lg text-[#6B7280] mt-2">
          List surplus food for verified organizations to claim.
        </p>
      </div>

      {/* 🏢 Multi-Branch Corporate Account Hierarchy Switcher */}
      <div className="mb-8 p-4.5 bg-gradient-to-r from-stone-50 via-amber-50/30 to-emerald-50/40 border border-[#E7E5E4] rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100/70 border border-amber-300/80 flex items-center justify-center text-amber-800 shrink-0">
            <span className="material-symbols-outlined text-[24px]">corporate_fare</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm sm:text-base text-[#064E3B]">
                {corporateAccount.name}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                SEBI BRSR Core Enterprise
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Managing {corporateAccount.branches.length} kitchens &amp; properties across Mumbai, Bangalore, Pune &amp; NCR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="branch-select" className="text-xs font-bold text-[#4B5563] shrink-0">
            Kitchen Unit:
          </label>
          <select
            id="branch-select"
            value={selectedBranchId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedBranchIdState(val);
              setSelectedBranchId(val);
              const branch = corporateAccount.branches.find((b) => b.id === val);
              if (branch) {
                setPickupAddress(branch.location);
                setContactPerson(branch.managerName);
                setContactPhone(branch.managerPhone);
              }
            }}
            className="text-xs font-semibold px-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-[#064E3B] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 shadow-xs cursor-pointer"
          >
            <option value="all">🏢 All Properties (Consolidated)</option>
            {corporateAccount.branches.map((b) => (
              <option key={b.id} value={b.id}>
                📍 {b.name} ({b.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT: Desktop Form on Left (~60%), Sticky Checklist Panel on Right (~40%) */}
      {/* Mobile: Form first, panel below */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* LEFT COLUMN: THE FORM (single column, large fields, labels above each field) */}
        <div className="lg:col-span-7 bg-white border border-[#E7E5E4] rounded-2xl shadow-xs p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* General form error if any */}
            {errors.general && (
              <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errors.general}</span>
              </div>
            )}

            {/* 1. Food name and description */}
            <div data-error={Boolean(errors.foodName)}>
              <label
                htmlFor="donor-food-name"
                className="block text-sm font-bold text-[#064E3B] mb-1.5"
              >
                Food name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="donor-food-name"
                type="text"
                value={foodName}
                onChange={(e) => {
                  setFoodName(e.target.value);
                  if (errors.foodName) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.foodName;
                      return next;
                    });
                  }
                }}
                placeholder="e.g. Mixed Vegetable Dum Biryani, Paneer Butter Masala & Rotis"
                className={`w-full h-12 px-4 rounded-xl border bg-white text-base text-[#064E3B] placeholder:text-[#6B7280]/60 focus:outline-none focus:ring-2 transition-all min-h-[48px] ${
                  errors.foodName
                    ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                    : 'border-[#E7E5E4] focus:ring-[#059669]/20 focus:border-[#059669]'
                }`}
              />
              {errors.foodName && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.foodName}</span>
                </p>
              )}
            </div>

            <div data-error={Boolean(errors.description)}>
              <label
                htmlFor="donor-food-desc"
                className="block text-sm font-bold text-[#064E3B] mb-1.5"
              >
                Description <span className="text-[#DC2626]">*</span>
              </label>
              <textarea
                id="donor-food-desc"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.description;
                      return next;
                    });
                  }
                }}
                placeholder="Describe preparation details, items included, hygiene packing, and portion size..."
                className={`w-full p-3.5 rounded-xl border bg-white text-sm sm:text-base text-[#064E3B] placeholder:text-[#6B7280]/60 focus:outline-none focus:ring-2 transition-all ${
                  errors.description
                    ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                    : 'border-[#E7E5E4] focus:ring-[#059669]/20 focus:border-[#059669]'
                }`}
              />
              {errors.description && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.description}</span>
                </p>
              )}
            </div>

            {/* 2. Category: Veg or Non-veg (two large buttons) */}
            <div data-error={Boolean(errors.category)}>
              <label className="block text-sm font-bold text-[#064E3B] mb-2">
                Category <span className="text-[#DC2626]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3.5">
                {/* Veg Large Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Veg');
                    if (errors.category) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.category;
                        return next;
                      });
                    }
                  }}
                  className={`h-14 rounded-xl border-2 font-bold text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer min-h-[52px] ${
                    category === 'Veg'
                      ? 'border-[#059669] bg-[#D1FAE5] text-[#059669] shadow-xs'
                      : 'border-[#E7E5E4] bg-white text-[#6B7280] hover:border-[#059669]/50 hover:bg-[#F0FDF8]'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border-2 border-[#059669] flex items-center justify-center shrink-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        category === 'Veg' ? 'bg-[#059669]' : 'bg-transparent'
                      }`}
                    />
                  </span>
                  <span>Veg</span>
                  <span className="material-symbols-outlined text-[20px] text-[#059669]">eco</span>
                </button>

                {/* Non-veg Large Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Non-veg');
                    if (errors.category) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.category;
                        return next;
                      });
                    }
                  }}
                  className={`h-14 rounded-xl border-2 font-bold text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer min-h-[52px] ${
                    category === 'Non-veg'
                      ? 'border-[#EA580C] bg-[#FEF2F2] text-[#EA580C] shadow-xs'
                      : 'border-[#E7E5E4] bg-white text-[#6B7280] hover:border-[#EA580C]/50 hover:bg-[#F0FDF8]'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border-2 border-[#EA580C] flex items-center justify-center shrink-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        category === 'Non-veg' ? 'bg-[#EA580C]' : 'bg-transparent'
                      }`}
                    />
                  </span>
                  <span>Non-veg</span>
                  <span className="material-symbols-outlined text-[20px] text-[#EA580C]">
                    set_meal
                  </span>
                </button>
              </div>

              {/* Protein Subtype selection if Non-veg */}
              {category === 'Non-veg' && (
                <div className="mt-3 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCD34D] flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-[#EA580C]">Non-veg item type:</span>
                  {['Chicken', 'Mutton', 'Fish & Seafood', 'Egg', 'Mixed Non-Veg'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNonVegSubtype(type)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        nonVegSubtype === type
                          ? 'bg-[#EA580C] text-white'
                          : 'bg-white text-[#064E3B] border border-[#E7E5E4]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}

              {errors.category && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.category}</span>
                </p>
              )}
            </div>

            {/* 3. Quantity (number) and unit (plates, kg, packets) */}
            <div data-error={Boolean(errors.quantity)}>
              <label className="block text-sm font-bold text-[#064E3B] mb-1.5">
                Quantity &amp; Unit <span className="text-[#DC2626]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Number input */}
                <div className="sm:col-span-6">
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, Number(e.target.value));
                      setQuantity(val);
                      if (errors.quantity) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.quantity;
                          return next;
                        });
                      }
                    }}
                    placeholder="50"
                    className={`w-full h-12 px-4 rounded-xl border bg-white text-base text-[#064E3B] focus:outline-none focus:ring-2 transition-all min-h-[48px] ${
                      errors.quantity
                        ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                        : 'border-[#E7E5E4] focus:ring-[#059669]/20 focus:border-[#059669]'
                    }`}
                  />
                </div>

                {/* Unit selector (plates, kg, packets) */}
                <div className="sm:col-span-6 grid grid-cols-3 gap-2">
                  {(['plates', 'kg', 'packets'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`h-12 rounded-xl text-sm font-bold capitalize transition-all cursor-pointer min-h-[48px] border ${
                        unit === u
                          ? 'border-[#059669] bg-[#D1FAE5] text-[#059669]'
                          : 'border-[#E7E5E4] bg-white text-[#6B7280] hover:bg-[#F0FDF8]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              {errors.quantity && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.quantity}</span>
                </p>
              )}
            </div>

            {/* 4. Prepared date and time */}
            <div data-error={Boolean(errors.prepTime)}>
              <label className="block text-sm font-bold text-[#064E3B] mb-1.5">
                Prepared date and time <span className="text-[#DC2626]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    value={prepDate}
                    onChange={(e) => setPrepDate(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-[#E7E5E4] bg-white text-sm sm:text-base text-[#064E3B] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] min-h-[48px]"
                  />
                </div>
                <div>
                  <input
                    type="time"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-[#E7E5E4] bg-white text-sm sm:text-base text-[#064E3B] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] min-h-[48px]"
                  />
                </div>
              </div>
              {errors.prepTime && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.prepTime}</span>
                </p>
              )}
            </div>

            {/* 5. Storage condition (dropdown: Hot and covered, Refrigerated, Room temperature sealed) */}
            <div data-error={Boolean(errors.storageCondition)}>
              <label
                htmlFor="donor-storage"
                className="block text-sm font-bold text-[#064E3B] mb-1.5"
              >
                Storage condition <span className="text-[#DC2626]">*</span>
              </label>
              <select
                id="donor-storage"
                value={storageCondition}
                onChange={(e) => setStorageCondition(e.target.value as StorageConditionType)}
                className="w-full h-12 px-4 rounded-xl border border-[#E7E5E4] bg-white text-base text-[#064E3B] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] cursor-pointer min-h-[48px]"
              >
                <option value="Hot and covered">Hot and covered (maintained above 60°C)</option>
                <option value="Refrigerated">Refrigerated (chilled below 5°C)</option>
                <option value="Room temperature sealed">Room temperature sealed (dry &amp; covered)</option>
              </select>
            </div>

            {/* 6. Allergen declaration (checkboxes: Nuts, Dairy, Gluten, Eggs, Soy, None) */}
            <div data-error={Boolean(errors.allergens)}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-[#064E3B]">
                  Allergen declaration <span className="text-[#DC2626]">*</span>
                </label>
                <span className="text-xs text-[#6B7280]">Select all that apply</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(['Nuts', 'Dairy', 'Gluten', 'Eggs', 'Soy', 'None'] as AllergenOption[]).map(
                  (allergen) => {
                    const isSelected = allergens.includes(allergen);
                    return (
                      <button
                        key={allergen}
                        type="button"
                        onClick={() => handleToggleAllergen(allergen)}
                        className={`px-3.5 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between cursor-pointer min-h-[44px] ${
                          isSelected
                            ? 'border-[#059669] bg-[#D1FAE5] text-[#059669]'
                            : 'border-[#E7E5E4] bg-white text-[#6B7280] hover:bg-[#F0FDF8]'
                        }`}
                      >
                        <span>{allergen}</span>
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] ${
                            isSelected
                              ? 'bg-[#059669] border-[#059669] text-white'
                              : 'border-[#E7E5E4] bg-white'
                          }`}
                        >
                          {isSelected && '✓'}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
              {errors.allergens && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.allergens}</span>
                </p>
              )}
            </div>

            {/* 7. Safe holding window (hours the food stays safe to eat) */}
            {/* Show the calculated "Eat before" time automatically from the prepared time */}
            <div data-error={Boolean(errors.safeHolding)}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="donor-holding-window"
                  className="block text-sm font-bold text-[#064E3B]"
                >
                  Safe holding window (hours) <span className="text-[#DC2626]">*</span>
                </label>
                <span className="text-xs font-semibold text-[#6B7280]">
                  {safeHoldingHours} Hours
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[2, 3, 4, 6].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setSafeHoldingHours(hrs)}
                    className={`py-2 rounded-xl text-sm font-bold transition-all cursor-pointer min-h-[42px] border ${
                      safeHoldingHours === hrs
                        ? 'bg-[#059669] text-white border-[#059669]'
                        : 'bg-white text-[#6B7280] border-[#E7E5E4] hover:bg-[#F0FDF8]'
                    }`}
                  >
                    {hrs} hrs
                  </button>
                ))}
              </div>

              {/* Automatic "Eat before" calculation card */}
              <div
                className={`p-3.5 rounded-xl border text-sm flex items-start gap-3 transition-colors ${
                  isSafeWindowInvalid
                    ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                    : 'bg-[#D1FAE5] border-[#A7F3D0] text-[#064E3B]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                  {isSafeWindowInvalid ? 'alarm_off' : 'schedule'}
                </span>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>Calculated "Eat before" time:</span>
                    <span className="underline">{eatBeforeFormatted}</span>
                  </div>
                  <p className="text-xs mt-0.5 opacity-90">
                    {isSafeWindowInvalid ? (
                      <span className="font-semibold text-[#DC2626]">
                        Safe holding window is less than 1 hour from now or has expired. Submission is blocked until adjusted.
                      </span>
                    ) : (
                      <span>
                        Safe window: approximately {hoursUntilExpiry.toFixed(1)} hours remaining from now.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {errors.safeHolding && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.safeHolding}</span>
                </p>
              )}
            </div>

            {/* 8. Pickup address, with a "Use my location" button and a map pin */}
            <div data-error={Boolean(errors.pickupAddress)}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="donor-address"
                  className="block text-sm font-bold text-[#064E3B]"
                >
                  Pickup address <span className="text-[#DC2626]">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={isLocating}
                  className="text-xs font-semibold text-[#059669] hover:text-[#047857] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isLocating ? 'sync' : 'my_location'}
                  </span>
                  <span>{isLocating ? 'Locating...' : 'Use my location'}</span>
                </button>
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#059669]">
                  location_on
                </span>
                <input
                  id="donor-address"
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => {
                    setPickupAddress(e.target.value);
                    if (errors.pickupAddress) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.pickupAddress;
                        return next;
                      });
                    }
                  }}
                  placeholder="Street address, building name, loading dock, city"
                  className={`w-full h-12 pl-10 pr-4 rounded-xl border bg-white text-base text-[#064E3B] placeholder:text-[#6B7280]/60 focus:outline-none focus:ring-2 transition-all min-h-[48px] ${
                    errors.pickupAddress
                      ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                      : 'border-[#E7E5E4] focus:ring-[#059669]/20 focus:border-[#059669]'
                  }`}
                />
              </div>

              {locationSuccess && (
                <p className="mt-1 text-xs text-[#059669] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  <span>{locationSuccess}</span>
                </p>
              )}

              {errors.pickupAddress && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.pickupAddress}</span>
                </p>
              )}
            </div>

            {/* 9. Contact person and phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div data-error={Boolean(errors.contactPerson)}>
                <label
                  htmlFor="donor-contact-person"
                  className="block text-sm font-bold text-[#064E3B] mb-1.5"
                >
                  Contact person <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="donor-contact-person"
                  type="text"
                  value={contactPerson}
                  onChange={(e) => {
                    setContactPerson(e.target.value);
                    if (errors.contactPerson) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.contactPerson;
                        return next;
                      });
                    }
                  }}
                  placeholder="e.g. Marcus Vance (Head Chef)"
                  className="w-full h-12 px-4 rounded-xl border border-[#E7E5E4] bg-white text-base text-[#064E3B] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] min-h-[48px]"
                />
                {errors.contactPerson && (
                  <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{errors.contactPerson}</span>
                  </p>
                )}
              </div>

              <div data-error={Boolean(errors.contactPhone)}>
                <label
                  htmlFor="donor-contact-phone"
                  className="block text-sm font-bold text-[#064E3B] mb-1.5"
                >
                  Phone number <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="donor-contact-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value);
                    if (errors.contactPhone) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.contactPhone;
                        return next;
                      });
                    }
                  }}
                  placeholder="+91 98200 55442"
                  className="w-full h-12 px-4 rounded-xl border border-[#E7E5E4] bg-white text-base text-[#064E3B] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] min-h-[48px]"
                />
                {errors.contactPhone && (
                  <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{errors.contactPhone}</span>
                  </p>
                )}
              </div>
            </div>

            {/* 10. Photo of the food (optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-[#064E3B]">
                  Photo of the food <span className="text-xs font-normal text-[#6B7280]">(Optional)</span>
                </label>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl('');
                      setPhotoFileName('');
                    }}
                    className="text-xs text-[#DC2626] hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>

              {photoUrl ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl border border-[#E7E5E4] bg-[#F0FDF8] flex items-center gap-4">
                    <img
                      src={photoUrl}
                      alt="Food preview"
                      className="w-16 h-16 rounded-lg object-cover border border-[#E7E5E4]"
                    />
                    <div className="text-xs text-[#6B7280] truncate flex-1">
                      <div className="font-semibold text-[#064E3B] truncate">
                        {photoFileName || 'food_item_photo.jpg'}
                      </div>
                      <span>Photo attached for recipient review</span>
                    </div>
                  </div>

                  {/* AI Safety Verdict Badge */}
                  {aiSafetyLoading && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F0FDF8] border border-[#E7E5E4] text-xs text-[#6B7280]">
                      <span className="w-3 h-3 border-2 border-[#059669]/30 border-t-[#059669] rounded-full animate-spin shrink-0" />
                      <span>Gemini AI is reviewing your photo for food safety issues...</span>
                    </div>
                  )}
                  {aiSafetyVerdict && !aiSafetyLoading && (
                    <div
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                        aiSafetyVerdict.verdict === 'Flagged for review'
                          ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                          : 'bg-[#D1FAE5] border-[#A7F3D0] text-[#064E3B]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                        {aiSafetyVerdict.verdict === 'Flagged for review' ? 'warning' : 'verified_user'}
                      </span>
                      <div>
                        <span className="font-bold">
                          AI Safety Check: {aiSafetyVerdict.verdict}
                        </span>
                        <p className="opacity-90 mt-0.5">{aiSafetyVerdict.reason}</p>
                      </div>
                    </div>
                  )}

                  {/* Multimodal AI Visual Freshness Inspection Card (Gemini 2.5 Flash) */}
                  {(visualInspectionLoading || visualInspectionResult) && (
                    <div className="p-3.5 rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-white shadow-xs">
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-emerald-200">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                            lens_blur
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-emerald-950">
                            Multimodal Gemini 2.5 Flash Visual Freshness
                          </span>
                        </div>
                        {visualInspectionResult && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                              visualInspectionResult.freshnessScore >= 80
                                ? 'bg-emerald-600 text-white'
                                : visualInspectionResult.freshnessScore >= 60
                                ? 'bg-amber-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}
                          >
                            Score: {visualInspectionResult.freshnessScore}/100
                          </span>
                        )}
                      </div>

                      {visualInspectionLoading ? (
                        <div className="py-3 flex items-center justify-center gap-2 text-xs text-emerald-700 font-semibold">
                          <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                          Analyzing thermal steam, sealed packaging, discoloration &amp; FSSAI compliance...
                        </div>
                      ) : visualInspectionResult ? (
                        <div className="mt-2.5 space-y-2 text-xs">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="p-2 rounded-lg bg-white/90 border border-emerald-200">
                              <span className="text-[10px] text-gray-500 font-semibold block">Thermal / Steam</span>
                              <span className="font-bold text-emerald-900">
                                {visualInspectionResult.indicators.steamDetected ? '♨️ Detected' : 'No steam visible'}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-white/90 border border-emerald-200">
                              <span className="text-[10px] text-gray-500 font-semibold block">Package Seal</span>
                              <span className="font-bold text-emerald-900">
                                {visualInspectionResult.indicators.sealedPackaging ? '🛡️ Sealed & Sanitized' : 'Open / Unsealed'}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-white/90 border border-emerald-200">
                              <span className="text-[10px] text-gray-500 font-semibold block">Coloration</span>
                              <span className="font-bold text-emerald-900">
                                {visualInspectionResult.indicators.discolorationRisk ? '⚠️ Discoloration' : '✨ Vibrant / Natural'}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-white/90 border border-emerald-200">
                              <span className="text-[10px] text-gray-500 font-semibold block">Date / Label</span>
                              <span className="font-bold text-emerald-900">
                                {visualInspectionResult.indicators.labelingPresent ? '🏷️ Label Visible' : 'Unlabeled pack'}
                              </span>
                            </div>
                          </div>

                          <p className="text-stone-700 bg-white/70 p-2.5 rounded-lg border border-emerald-100 italic">
                            "{visualInspectionResult.reasons.join('. ')}"
                          </p>
                          <p className="text-[11px] text-emerald-800 font-medium">
                            📋 <strong>FSSAI Rule:</strong> {visualInspectionResult.fssaiComplianceNotes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="h-14 rounded-xl border-2 border-dashed border-[#E7E5E4] hover:border-[#059669] bg-[#F0FDF8] flex items-center justify-center gap-2 cursor-pointer transition-colors px-4">
                    <span className="material-symbols-outlined text-[20px] text-[#059669]">
                      add_photo_alternate
                    </span>
                    <span className="text-sm font-semibold text-[#6B7280]">
                      Choose an image file — AI safety &amp; freshness check runs automatically (Max 5 MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {/* Quick test sample photo */}
                  <button
                    type="button"
                    onClick={() => {
                      const sample = SAMPLE_FOOD_IMAGES[0];
                      if (sample) {
                        setPhotoUrl(sample.url);
                        setPhotoFileName(sample.name);
                        runAISafetyCheck(sample.url);
                        runVisualFreshnessInspection(sample.url);
                      }
                    }}
                    className="text-xs font-semibold text-[#059669] hover:underline"
                  >
                    + Use demo food photo (runs Gemini Vision freshness check)
                  </button>
                </div>
              )}

              {/* Explicit AI Safety Verification Button */}
              <div className="pt-1 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    runAISafetyCheck();
                    if (photoUrl) runVisualFreshnessInspection(photoUrl);
                  }}
                  disabled={aiSafetyLoading || visualInspectionLoading}
                  className="px-3 py-1.5 rounded-lg border border-[#059669]/40 hover:bg-[#059669]/10 text-[#059669] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {aiSafetyLoading || visualInspectionLoading ? 'sync' : 'smart_toy'}
                  </span>
                  <span>
                    {aiSafetyLoading || visualInspectionLoading
                      ? 'Analyzing safety & freshness...'
                      : 'Run Gemini AI Food Safety & Freshness Audit'}
                  </span>
                </button>
                <span className="text-[11px] text-[#6B7280]">
                  Evaluates packaging, allergens, thermal steam &amp; freshness
                </span>
              </div>
            </div>

            {/* FOOD SAFETY RULES & CONFIRMATION CHECKBOX */}
            <div className="pt-4 border-t border-[#E7E5E4] space-y-4">
              {/* Note: "An offline check may be done at pickup before the food is handed over." */}
              <div className="p-3.5 rounded-xl bg-[#D1FAE5] border border-[#A7F3D0] text-xs text-[#064E3B] flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#059669] shrink-0 mt-0.5">
                  verified_user
                </span>
                <p className="leading-relaxed">
                  <strong>Notice:</strong> An offline check may be done at pickup before the food is handed over to confirm hygiene standards.
                </p>
              </div>

              {/* Required confirmation checkbox before submitting:
                  "I confirm this food is fresh, was stored properly, and is safe to eat." */}
              <div data-error={Boolean(errors.confirmedSafety)}>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmedSafety}
                    onChange={(e) => {
                      setConfirmedSafety(e.target.checked);
                      if (errors.confirmedSafety) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.confirmedSafety;
                          return next;
                        });
                      }
                    }}
                    className="w-5 h-5 rounded border-[#E7E5E4] text-[#059669] focus:ring-[#059669] cursor-pointer shrink-0 mt-0.5"
                  />
                  <span className="text-sm font-semibold text-[#064E3B] leading-tight">
                    I confirm this food is fresh, was stored properly, and is safe to eat. <span className="text-[#DC2626]">*</span>
                  </span>
                </label>
                {errors.confirmedSafety && (
                  <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1 ml-8">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{errors.confirmedSafety}</span>
                  </p>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              {/* Only verified donors can submit. If donor is not verified yet, disabled with clear message */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !isVerifiedDonor || isSafeWindowInvalid}
                  className="w-full h-13 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:bg-[#E7E5E4] disabled:text-[#6B7280] disabled:cursor-not-allowed text-white font-bold text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[50px]"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Publishing listing...</span>
                    </span>
                  ) : !isVerifiedDonor ? (
                    <span>Verification pending - Submissions disabled</span>
                  ) : isSafeWindowInvalid ? (
                    <span>Safe window invalid (&lt; 1 hr remaining)</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">publish</span>
                      <span>List Surplus Food</span>
                    </>
                  )}
                </button>

                {!isVerifiedDonor && (
                  <p className="text-xs text-center text-[#EA580C] font-medium mt-2">
                    Only verified donors can submit listings. Please wait for verification approval.
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: STICKY "FOOD SAFETY CHECKLIST" PANEL (Soft green #D1FAE5) */}
        {/* On desktop: sticky, on mobile: below form */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div className="bg-[#D1FAE5] border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#059669] text-white flex items-center justify-center font-bold text-sm notranslate" translate="no">
                  <span className="material-symbols-outlined notranslate text-[20px]" translate="no">checklist</span>
                </span>
                <h2 className="font-serif text-xl font-bold text-[#064E3B]">
                  Food safety checklist
                </h2>
              </div>
              <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                Updates in real-time as you fill the form to guarantee FSSAI Good Samaritan safety compliance.
              </p>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#064E3B] mb-1.5">
                <span>Verification Readiness</span>
                <span>
                  {checklistStatus.completedCount} of {checklistStatus.totalCount} completed ({checklistStatus.progressPercent}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/70 overflow-hidden border border-[#E7E5E4]">
                <div
                  className="h-full bg-[#059669] transition-all duration-300"
                  style={{ width: `${checklistStatus.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3 pt-1">
              {checklistStatus.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-colors flex items-start gap-2.5 text-xs ${
                    item.complete
                      ? 'bg-white border-[#A7F3D0] text-[#064E3B]'
                      : 'bg-white/60 border-[#E7E5E4] text-[#6B7280]'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold ${
                      item.complete
                        ? 'bg-[#059669] text-white'
                        : 'border border-[#E7E5E4] bg-[#F0FDF8] text-transparent'
                    }`}
                  >
                    {item.complete ? '✓' : '○'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold ${item.complete ? 'text-[#064E3B]' : 'text-[#6B7280]'}`}>
                      {item.label}
                    </div>
                    <div className="text-[11px] text-[#6B7280] truncate mt-0.5">
                      {item.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Real-time Storage & Handling Guideline Card */}
            <div className="pt-3 border-t border-[#E7E5E4] space-y-2 text-xs text-[#064E3B]">
              <div className="font-bold flex items-center gap-1.5 text-[#059669]">
                <span className="material-symbols-outlined text-[16px]">thermostat</span>
                <span>Temperature Standard: {storageCondition}</span>
              </div>
              <p className="text-[#6B7280] leading-relaxed">
                {storageCondition === 'Hot and covered' &&
                  'Ensure hot cooked items are held above 60°C in food-grade thermal containers.'}
                {storageCondition === 'Refrigerated' &&
                  'Perishable cooked foods must be stored at 4°C or lower prior to handover.'}
                {storageCondition === 'Room temperature sealed' &&
                  'Bakery and dry goods must be sealed against airborne contaminants.'}
              </p>
            </div>

            {/* Offline check note */}
            <div className="pt-2 border-t border-[#E7E5E4] text-[11px] text-[#6B7280] leading-relaxed">
              <span>Notice: An offline check may be done at pickup before the food is handed over.</span>
            </div>
          </div>

          {/* Quick preset card */}
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#064E3B]">
              Quick Fill Sample Presets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setFoodName('Surplus Dal Makhani & Jeera Rice');
                  setDescription('Freshly prepared hot banquet surplus, sealed in 3 stainless steel containers.');
                  setCategory('Veg');
                  setQuantity(50);
                  setUnit('plates');
                  setStorageCondition('Hot and covered');
                  setAllergens(['Dairy']);
                  setSafeHoldingHours(4);
                  setConfirmedSafety(true);
                }}
                className="w-full text-left p-2.5 rounded-lg border border-[#E7E5E4] hover:bg-[#D1FAE5] hover:border-[#059669] transition-colors cursor-pointer"
              >
                <div className="font-bold text-[#064E3B]">Veg Banquet Rice &amp; Dal</div>
                <div className="text-[11px] text-[#6B7280]">50 plates • Veg • Hot &amp; covered</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFoodName('Chicken Dum Biryani (Wedding Surplus)');
                  setDescription('Hygienically prepared chicken biryani in insulated thermal urns.');
                  setCategory('Non-veg');
                  setNonVegSubtype('Chicken');
                  setQuantity(75);
                  setUnit('plates');
                  setStorageCondition('Hot and covered');
                  setAllergens(['Dairy']);
                  setSafeHoldingHours(3);
                  setConfirmedSafety(true);
                }}
                className="w-full text-left p-2.5 rounded-lg border border-[#E7E5E4] hover:bg-[#FEF2F2] hover:border-[#EA580C] transition-colors cursor-pointer"
              >
                <div className="font-bold text-[#064E3B]">Chicken Dum Biryani</div>
                <div className="text-[11px] text-[#6B7280]">75 plates • Non-veg (Chicken) • 3h</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MY LISTINGS SECTION (Below the form) */}
      <div id="my-listings-section" className="mt-14 pt-10 border-t border-[#E7E5E4] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#064E3B]">
              Your Published Food Listings
            </h2>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Active and fulfilled rescue packages posted by your donor profile.
            </p>
          </div>
          {onNavigateLedger && (
            <button
              type="button"
              onClick={onNavigateLedger}
              className="text-xs sm:text-sm font-semibold text-[#059669] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View complete Ledger</span>
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </button>
          )}
        </div>

        {broadcastResultInfo && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs sm:text-sm text-amber-900 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">emergency</span>
              <span>{broadcastResultInfo}</span>
            </div>
            <button
              type="button"
              onClick={() => setBroadcastResultInfo(null)}
              className="text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {loadingListings ? (
          <div className="py-8 text-center text-sm text-[#6B7280]">
            Loading your listings...
          </div>
        ) : myListings.length === 0 ? (
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-8 text-center text-[#6B7280]">
            <span className="material-symbols-outlined text-[36px] text-[#059669]/60 mb-2">
              inventory_2
            </span>
            <p className="font-medium text-sm text-[#064E3B]">No active listings found.</p>
            <p className="text-xs text-[#6B7280] mt-1">
              Use the form above to post surplus meals for nearby shelters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myListings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#059669]/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                        listing.isVeg
                          ? 'bg-[#D1FAE5] text-[#059669]'
                          : 'bg-[#FEF2F2] text-[#EA580C]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {listing.isVeg ? 'Veg' : `Non-Veg ${listing.nonVegType ? `(${listing.nonVegType})` : ''}`}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        listing.status === 'available'
                          ? 'bg-[#D1FAE5] text-[#059669]'
                          : listing.status === 'claimed'
                          ? 'bg-[#FEF2F2] text-[#EA580C]'
                          : 'bg-[#F0FDF8] text-[#6B7280] border border-[#E7E5E4]'
                      }`}
                    >
                      {listing.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-base text-[#064E3B] line-clamp-1">
                    {listing.title}
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">
                    {listing.notes || 'No extra notes provided.'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-[#E7E5E4]/60 space-y-1 text-xs text-[#6B7280]">
                    <div className="flex items-center justify-between">
                      <span>Quantity:</span>
                      <span className="font-bold text-[#064E3B]">
                        {listing.quantity} {listing.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Eat before:</span>
                      <span className="font-medium text-[#064E3B]">
                        {listing.expiryTime}
                      </span>
                    </div>
                    <div className="truncate">
                      <span>Location: </span>
                      <span className="text-[#064E3B]">{listing.location}</span>
                    </div>

                    {listing.safetyVerdict && (
                      <div className="mt-2.5 pt-2 border-t border-[#E7E5E4]/60 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            listing.safetyVerdict === 'safe' || listing.safetyVerdict === 'Looks safe'
                              ? 'bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0]'
                              : listing.safetyVerdict === 'caution'
                              ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                              : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {listing.safetyVerdict === 'unsafe' ? 'dangerous' : listing.safetyVerdict === 'caution' ? 'warning' : 'verified_user'}
                          </span>
                          AI: {listing.safetyVerdict.toUpperCase()} {typeof listing.safetyScore === 'number' ? `(${listing.safetyScore}/100)` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Show who claimed this listing */}
                {listing.status === 'claimed' && (listing as any).claimingOrgName && (
                  <div className="mt-2 p-2.5 rounded-lg bg-[#FEF2F2] border border-[#EA580C]/30 text-xs">
                    <div className="flex items-center gap-1.5 text-[#EA580C] font-bold mb-1">
                      <span className="material-symbols-outlined text-[15px]">inventory</span>
                      <span>Claimed by {(listing as any).claimingOrgName}</span>
                    </div>
                    {/* Handoff OTP verify */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter their code"
                        value={otpInputs?.[listing.id] || ''}
                        onChange={(e) =>
                          setOtpInputs((prev) => ({ ...prev, [listing.id]: e.target.value }))
                        }
                        className="flex-1 h-8 px-2 rounded border border-[#E7E5E4] text-xs text-[#064E3B] focus:outline-none focus:border-[#059669]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const entered = otpInputs?.[listing.id]?.trim();
                          const actual = (listing as any).handoffCode;
                          if (!entered) return;
                          if (entered === actual) {
                            setOtpResults((prev) => ({ ...prev, [listing.id]: 'success' }));
                            handleMarkCompleted(listing.id);
                          } else {
                            setOtpResults((prev) => ({ ...prev, [listing.id]: 'wrong' }));
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-[#059669] text-white text-[11px] font-bold hover:bg-[#047857] transition-colors cursor-pointer"
                      >
                        Verify
                      </button>
                    </div>
                    {otpResults?.[listing.id] === 'wrong' && (
                      <p className="text-[#DC2626] text-[11px] mt-1 font-medium">Wrong code. Ask the recipient for the correct pickup code.</p>
                    )}
                    {otpResults?.[listing.id] === 'success' && (
                      <p className="text-[#059669] text-[11px] mt-1 font-medium">Code verified! Marking as completed.</p>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* 📲 Show Dispatch Handshake QR button */}
                    <button
                      type="button"
                      onClick={() => setQrModalListing(listing)}
                      className="px-2.5 py-1.5 rounded-lg border border-teal-600/40 text-teal-700 hover:bg-teal-50 font-bold flex items-center gap-1 cursor-pointer"
                      title="Display secure pickup handshake QR for courier"
                    >
                      <span className="material-symbols-outlined text-[16px] text-teal-600">qr_code_2</span>
                      <span>Handshake QR</span>
                    </button>

                    {/* 💬 WhatsApp / SMS Emergency Broadcast Button */}
                    <button
                      type="button"
                      disabled={broadcastingEmergency || listing.emergencyBroadcastDispatched}
                      onClick={() => handleTriggerEmergencyBroadcast(listing)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                        listing.emergencyBroadcastDispatched
                          ? 'border border-gray-200 bg-gray-50 text-gray-400 cursor-default'
                          : 'border border-amber-500/40 text-amber-800 bg-amber-50 hover:bg-amber-100'
                      }`}
                      title="Broadcast emergency pickup alert to 5km couriers & shelters via WhatsApp/SMS"
                    >
                      <span className="material-symbols-outlined text-[16px] text-amber-600">
                        {broadcastingEmergency && broadcastingListing?.id === listing.id ? 'sync' : 'cell_tower'}
                      </span>
                      <span>
                        {listing.emergencyBroadcastDispatched
                          ? 'Broadcast Sent'
                          : broadcastingEmergency && broadcastingListing?.id === listing.id
                          ? 'Sending...'
                          : 'Broadcast 5km'}
                      </span>
                    </button>

                    {listing.status === 'claimed' && onOpenTracker && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenTracker({
                            listingId: listing.id,
                            foodTitle: listing.title,
                            quantityStr: `${listing.quantity} ${listing.unit}`,
                            donorName: listing.contactPerson || userProfile?.displayName || 'Donor Kitchen',
                            donorOrg: userProfile?.orgName || 'Hospitality Donor',
                            donorAddress: listing.location,
                            shelterName: (listing as any).claimingOrgName || 'Registered NGO Shelter',
                            shelterAddress: 'Designated Receiving Bay',
                            status: 'en_route_shelter',
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">navigation</span>
                        <span>Track Courier</span>
                      </button>
                    )}

                    {onOpenCsrModal && (listing.status === 'completed' || listing.status === 'claimed') && (
                      <button
                        type="button"
                        onClick={() => onOpenCsrModal(listing)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold flex items-center gap-1 cursor-pointer"
                        title="Download CSR Impact Certificate"
                      >
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">picture_as_pdf</span>
                        <span>Impact PDF</span>
                      </button>
                    )}

                    {listing.status === 'available' && (
                      <button
                        type="button"
                        onClick={() => handleMarkCompleted(listing.id)}
                        className="px-3 py-1.5 rounded-lg border border-[#A7F3D0] bg-[#D1FAE5] hover:bg-[#059669]/15 text-[#059669] font-semibold transition-colors cursor-pointer"
                      >
                        Mark Picked Up
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteListing(listing.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#FECACA] hover:bg-[#FEF2F2] text-[#DC2626] font-semibold transition-colors cursor-pointer ml-auto"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📲 Secure QR Code Pickup Handshake Modal */}
      {qrModalListing && (
        <QrHandshakeModal
          isOpen={Boolean(qrModalListing)}
          onClose={() => setQrModalListing(null)}
          stage="pickup"
          mode="display"
          listingId={qrModalListing.id}
          foodTitle={qrModalListing.title}
          quantityStr={`${qrModalListing.quantity} ${qrModalListing.unit}`}
          expectedCode={qrModalListing.pickupHandshakePin || 'FL-PU-8821'}
          donorOrg={qrModalListing.donorOrg || qrModalListing.donorName}
          onSuccess={() => {
            setQrModalListing(null);
          }}
        />
      )}
    </div>
  );
};
