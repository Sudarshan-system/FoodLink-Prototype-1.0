import { FoodListing } from '../features/donor/DonorDashboard';

export interface RecipientDietaryProfile {
  strictVegetarian: boolean;
  jainCompliant: boolean;      // No onion, garlic, or root vegetables
  halalCertified: boolean;
  diabeticFriendly: boolean;   // Low glycemic index, whole grains
  nutFree: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
}

export interface ShelterCapacitySettings {
  dailyIntakeCeilingMeals: number; // e.g. 80 meals
  coldStorageCapacityKg: number;   // e.g. 50 kg
  hasActiveRefrigerator: boolean;
  currentIntakeMealsToday: number;
  currentColdStorageUsedKg: number;
  lastResetDate: string;
  organizationName?: string;
  dailyIntakeCeiling: number;
  coldStorageKg: number;
  coldStorageUsedKg: number;
  currentMealsReceived: number;
}

export type DietaryProfile = RecipientDietaryProfile;
export type ShelterCapacity = ShelterCapacitySettings;

export const DEFAULT_DIETARY_PROFILE: RecipientDietaryProfile = {
  strictVegetarian: false,
  jainCompliant: false,
  halalCertified: false,
  diabeticFriendly: false,
  nutFree: false,
  glutenFree: false,
  dairyFree: false,
};

export const DEFAULT_CAPACITY_SETTINGS: ShelterCapacitySettings = {
  dailyIntakeCeilingMeals: 80,
  coldStorageCapacityKg: 40,
  hasActiveRefrigerator: true,
  currentIntakeMealsToday: 45,
  currentColdStorageUsedKg: 18,
  lastResetDate: new Date().toISOString().slice(0, 10),
  organizationName: 'Mission Hope Community Shelter',
  dailyIntakeCeiling: 80,
  coldStorageKg: 40,
  coldStorageUsedKg: 18,
  currentMealsReceived: 45,
};

const STORAGE_KEY_DIETARY = 'foodlink_recipient_dietary_profile';
const STORAGE_KEY_CAPACITY = 'foodlink_recipient_shelter_capacity';

export function loadDietaryProfile(): RecipientDietaryProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DIETARY);
    if (raw) return { ...DEFAULT_DIETARY_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_DIETARY_PROFILE;
}

export function saveDietaryProfile(profile: RecipientDietaryProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_DIETARY, JSON.stringify(profile));
  } catch {}
}

export function loadShelterCapacity(): ShelterCapacitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAPACITY);
    if (raw) {
      const data = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      // Reset daily counts if new day
      if (data.lastResetDate !== today) {
        data.currentIntakeMealsToday = 0;
        data.currentMealsReceived = 0;
        data.lastResetDate = today;
        saveShelterCapacity(data);
      }
      const dailyIntake = data.dailyIntakeCeiling || data.dailyIntakeCeilingMeals || 80;
      const coldStorage = data.coldStorageKg || data.coldStorageCapacityKg || 40;
      const coldUsed = typeof data.coldStorageUsedKg === 'number' ? data.coldStorageUsedKg : (data.currentColdStorageUsedKg || 18);
      const mealsToday = typeof data.currentMealsReceived === 'number' ? data.currentMealsReceived : (data.currentIntakeMealsToday || 0);

      return {
        ...DEFAULT_CAPACITY_SETTINGS,
        ...data,
        dailyIntakeCeilingMeals: dailyIntake,
        dailyIntakeCeiling: dailyIntake,
        coldStorageCapacityKg: coldStorage,
        coldStorageKg: coldStorage,
        coldStorageUsedKg: coldUsed,
        currentColdStorageUsedKg: coldUsed,
        currentIntakeMealsToday: mealsToday,
        currentMealsReceived: mealsToday,
      };
    }
  } catch {}
  return DEFAULT_CAPACITY_SETTINGS;
}

export function saveShelterCapacity(settings: ShelterCapacitySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_CAPACITY, JSON.stringify(settings));
  } catch {}
}

export interface DietaryMatchAssessment {
  isMatch: boolean;
  score: number; // 0 - 100
  matchedTags: string[];
  incompatibleReasons: string[];
}

/**
 * Checks if a listing meets the shelter's strict dietary profile.
 */
export function evaluateDietaryMatch(
  listing: FoodListing,
  profile: RecipientDietaryProfile
): DietaryMatchAssessment {
  const isVeg = listing.isVeg !== false && (listing.dietaryType === 'veg' || !listing.foodType?.toLowerCase().includes('meat'));
  const text = `${listing.title} ${listing.notes || ''}`.toLowerCase();
  const allergens = listing.allergens || [];

  const matchedTags: string[] = [];
  const incompatibleReasons: string[] = [];

  // 1. Strict Vegetarian check
  if (profile.strictVegetarian) {
    if (!isVeg) {
      incompatibleReasons.push('Contains non-vegetarian ingredients.');
    } else {
      matchedTags.push('Strict Veg');
    }
  }

  // 2. Jain check (no onion, garlic, potatoes)
  if (profile.jainCompliant) {
    const jainScanText = text.replace(
      /(?:without|no|zero|free\s+(?:of|from))\s+[^.!?]*(?:onion|garlic|root\s+vegetables?|potatoes?|aloo|pyaz|lahsun)[^.!?]*/gi,
      ''
    );
    if (!isVeg) {
      incompatibleReasons.push('Not Jain: Contains non-vegetarian elements.');
    } else if (
      jainScanText.includes('onion') ||
      jainScanText.includes('garlic') ||
      jainScanText.includes('pyaz') ||
      jainScanText.includes('lahsun') ||
      jainScanText.includes('potato') ||
      jainScanText.includes('aloo')
    ) {
      incompatibleReasons.push('Contains onion, garlic, or root vegetables.');
    } else {
      matchedTags.push('Jain Safe (No Root Veg/Onion/Garlic)');
    }
  }

  // 3. Halal check
  if (profile.halalCertified) {
    if (!isVeg && !text.includes('halal')) {
      incompatibleReasons.push('Non-veg item without verified Halal certification.');
    } else {
      matchedTags.push('Halal Compliant');
    }
  }

  // 4. Diabetic check
  if (profile.diabeticFriendly) {
    if (text.includes('sweet') || text.includes('dessert') || text.includes('halwa') || text.includes('gulab jamun') || text.includes('sugar')) {
      incompatibleReasons.push('High-sugar confectionery unsuitable for diabetic care.');
    } else {
      matchedTags.push('Diabetic Safe');
    }
  }

  // 5. Nut allergy
  if (profile.nutFree) {
    if (allergens.includes('Nuts') || text.includes('peanut') || text.includes('cashew') || text.includes('kaju') || text.includes('badam')) {
      incompatibleReasons.push('Declared allergen: Contains nuts.');
    } else {
      matchedTags.push('Nut-Free');
    }
  }

  // 6. Gluten allergy
  if (profile.glutenFree) {
    if (allergens.includes('Gluten') || text.includes('wheat') || text.includes('roti') || text.includes('bread') || text.includes('maida')) {
      incompatibleReasons.push('Declared allergen: Contains gluten/wheat.');
    } else {
      matchedTags.push('Gluten-Free');
    }
  }

  // 7. Dairy allergy
  if (profile.dairyFree) {
    if (allergens.includes('Dairy') || text.includes('milk') || text.includes('paneer') || text.includes('ghee') || text.includes('cheese') || text.includes('curd')) {
      incompatibleReasons.push('Declared allergen: Contains milk/dairy.');
    } else {
      matchedTags.push('Dairy-Free');
    }
  }

  const isMatch = incompatibleReasons.length === 0;
  const score = isMatch ? 100 : Math.max(0, 100 - incompatibleReasons.length * 35);

  return {
    isMatch,
    score,
    matchedTags,
    incompatibleReasons,
  };
}

export interface IntakeCapacityCheck {
  canAccept: boolean;
  mealsExceeded: boolean;
  coldStorageExceeded: boolean;
  mealsToClaim: number;
  remainingMealAllowance: number;
  reason?: string;
}

/**
 * Validates whether the shelter has remaining meal ceiling & refrigerator capacity.
 */
export function checkShelterIntakeCapacity(
  listing: FoodListing,
  capacity: ShelterCapacitySettings
): IntakeCapacityCheck {
  const mealsToClaim = Math.round((Number(listing.quantity) || 20) * (listing.unit === 'plates' ? 1 : 2.5));
  const remainingMealAllowance = Math.max(0, capacity.dailyIntakeCeilingMeals - capacity.currentIntakeMealsToday);

  const mealsExceeded = mealsToClaim > remainingMealAllowance;

  // Check if cold storage is required
  const storageReq = (listing.storageCondition || '').toLowerCase();
  const requiresColdStorage = storageReq.includes('refriger') || storageReq.includes('cold') || storageReq.includes('chill');
  const coldStorageKgNeeded = Number(listing.quantity) || 10;
  const remainingColdStorageKg = Math.max(0, capacity.coldStorageCapacityKg - capacity.currentColdStorageUsedKg);

  const coldStorageExceeded = requiresColdStorage && (!capacity.hasActiveRefrigerator || coldStorageKgNeeded > remainingColdStorageKg);

  if (mealsExceeded) {
    return {
      canAccept: false,
      mealsExceeded: true,
      coldStorageExceeded: false,
      mealsToClaim,
      remainingMealAllowance,
      reason: `Intake ceiling reached: This batch (~${mealsToClaim} meals) exceeds your remaining intake capacity of ${remainingMealAllowance} meals today (${capacity.currentIntakeMealsToday}/${capacity.dailyIntakeCeilingMeals} claimed).`,
    };
  }

  if (coldStorageExceeded) {
    return {
      canAccept: false,
      mealsExceeded: false,
      coldStorageExceeded: true,
      mealsToClaim,
      remainingMealAllowance,
      reason: `Cold Storage Capacity Reached: This item requires refrigeration, but your cold storage is currently at ${capacity.currentColdStorageUsedKg}/${capacity.coldStorageCapacityKg} kg.`,
    };
  }

  return {
    canAccept: true,
    mealsExceeded: false,
    coldStorageExceeded: false,
    mealsToClaim,
    remainingMealAllowance,
  };
}
