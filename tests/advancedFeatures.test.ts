import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectVisualFreshnessFallback,
  buildVisualFreshnessPrompt,
} from '../src/lib/visualFreshness';
import {
  findMatchingCommercialHub,
  bundleSurplusRoutes,
  calculateRouteSavings,
  COMMERCIAL_HUBS,
} from '../src/lib/routeBundling';
import {
  formatEmergencyBroadcastMessage,
  triggerEmergencyBroadcast,
} from '../src/lib/emergencyBroadcast';
import {
  evaluateDietaryMatch,
  checkShelterIntakeCapacity,
  DEFAULT_DIETARY_PROFILE,
  DEFAULT_CAPACITY_SETTINGS,
} from '../src/lib/shelterIntake';
import {
  computeBrsrMetrics,
  formatBrsrCsv,
} from '../src/lib/brsrReporting';
import {
  loadCorporateAccount,
  getBranchById,
  computeCorporateAggregates,
} from '../src/lib/corporateHierarchy';
import { FoodListing } from '../src/features/donor/DonorDashboard';

describe('🛡️ Safety: Multimodal Visual Freshness Inspection', () => {
  it('generates rich inspection prompt for Gemini 2.5 Flash', () => {
    const prompt = buildVisualFreshnessPrompt({
      foodName: 'Paneer Makhani & Butter Naan',
      category: 'Cooked Hot Meals',
      storageCondition: 'Hot and covered',
      safeHoldingHours: 3,
    });
    assert.ok(prompt.includes('FSSAI Surplus Food Safety Inspector'));
    assert.ok(prompt.includes('steamDetected'));
    assert.ok(prompt.includes('sealedPackaging'));
    assert.ok(prompt.includes('Paneer Makhani'));
  });

  it('provides deterministic visual inspection fallback when offline', () => {
    const result = inspectVisualFreshnessFallback({
      foodName: 'Dum Biryani',
      category: 'Cooked Hot Meals',
      storageCondition: 'Hot and covered',
    });
    assert.equal(typeof result.freshnessScore, 'number');
    assert.ok(result.freshnessScore >= 0 && result.freshnessScore <= 100);
    assert.ok(['safe', 'caution', 'unsafe'].includes(result.verdict));
    assert.equal(typeof result.indicators.steamDetected, 'boolean');
    assert.equal(typeof result.indicators.sealedPackaging, 'boolean');
    assert.ok(result.fssaiComplianceNotes.length > 0);
  });
});

describe('🚚 Volunteer Logistics: Multi-Stop Smart Route Bundling', () => {
  it('identifies commercial hubs (e.g. Bandra, BKC, Cyber City)', () => {
    const hubBandra = findMatchingCommercialHub('Linking Road, Bandra West, Mumbai');
    assert.ok(hubBandra);
    assert.equal(hubBandra?.id, 'mumbai-bandra-west');

    const hubCyberCity = findMatchingCommercialHub('DLF Cyber City, Tower B, Gurugram');
    assert.ok(hubCyberCity);
    assert.equal(hubCyberCity?.id, 'delhi-cyber-city');
  });

  it('clusters separate listings within the same hub into an optimized bundle mission', () => {
    const sampleListings: FoodListing[] = [
      {
        id: 'list-1',
        donorId: 'donor-1',
        title: 'Dal Tadka & Rice',
        location: 'Hill Road, Bandra West, Mumbai',
        quantity: 30,
        unit: 'portions',
        foodType: 'Cooked Hot Meals',
        category: 'Cooked Hot Meals',
        pickupWindow: 'Today 5-7 PM',
        expiryTime: 'Within 3 hours',
        donorName: 'Cafe Mondegar Bandra',
        donorOrg: 'Cafe Mondegar',
        donorEmail: 'bistro@bandra.com',
        status: 'available',
        safetyChecklist: { tempSafety: true, freshlyPrepared: true, cleanPackaging: true, hygieneAllergen: true },
      },
      {
        id: 'list-2',
        donorId: 'donor-1',
        title: 'Samosas & Puffs',
        location: 'Pali Naka, Bandra West, Mumbai',
        quantity: 25,
        unit: 'pieces',
        foodType: 'Bakery',
        category: 'Bakery',
        pickupWindow: 'Today 5-7 PM',
        expiryTime: 'Within 4 hours',
        donorName: 'Pali Bakery',
        donorOrg: 'Pali Bakery',
        donorEmail: 'baker@pali.com',
        status: 'available',
        safetyChecklist: { tempSafety: true, freshlyPrepared: true, cleanPackaging: true, hygieneAllergen: true },
      },
    ];

    const bundles = bundleSurplusRoutes(sampleListings);
    assert.ok(bundles.length > 0);
    const bandraBundle = bundles.find((b) => b.hub.id === 'mumbai-bandra-west');
    assert.ok(bandraBundle);
    assert.equal(bandraBundle?.listings.length, 2);
    assert.equal(bandraBundle?.stops.length, 3); // Stop 1 (donor 1) -> Stop 2 (donor 2) -> Dropoff
    assert.ok(bandraBundle?.co2SavingsKg > 0);
  });

  it('calculates transit time and CO2 reduction from bundling', () => {
    const savings = calculateRouteSavings(2, 6.5);
    assert.ok(savings.kmSaved > 0);
    assert.ok(savings.minsSaved > 0);
    assert.ok(savings.co2KgAvoided > 0);
  });
});

describe('💬 Emergency Surplus Broadcasts (WhatsApp / SMS)', () => {
  it('formats emergency broadcast message with urgent holding window', () => {
    const msg = formatEmergencyBroadcastMessage({
      listingId: 'list-urgent-99',
      title: 'Grand Wedding Feast Surplus: 180 Meals',
      donorOrg: 'Royal Orchid Convention',
      quantity: 180,
      unit: 'portions',
      location: 'Andheri East, Mumbai',
      safeUntilMinutes: 75,
      contactPhone: '+91 98200 11223',
    });
    assert.ok(msg.includes('FOODLINK EMERGENCY SURPLUS ALERT'));
    assert.ok(msg.includes('180 portions'));
    assert.ok(msg.includes('1h 15m remaining'));
    assert.ok(msg.includes('list-urgent-99'));
  });

  it('dispatches broadcast simulation notifying nearby couriers & shelters', async () => {
    const res = await triggerEmergencyBroadcast({
      listingId: 'test-emergency-batch',
      title: 'Buffet Surplus',
      donorOrg: 'Hotel Grand',
      quantity: 100,
      unit: 'plates',
      location: 'BKC, Mumbai',
      safeUntilMinutes: 90,
      radiusKm: 5,
    });
    assert.equal(res.success, true);
    assert.ok(res.recipientCount.couriers > 0);
    assert.ok(res.recipientCount.shelters > 0);
    assert.ok(res.broadcastId.startsWith('BC-'));
  });
});

describe('🎯 Recipient Dignity & Dietary Auto-Filtering', () => {
  it('strictly validates Jain dietary profile (blocks onion, garlic, root vegetables)', () => {
    const jainProfile = {
      ...DEFAULT_DIETARY_PROFILE,
      strictVegetarian: true,
      jainCompliant: true,
    };

    const foodWithOnion: FoodListing = {
      id: 'food-onion',
      donorId: 'donor-1',
      title: 'Aloo Pyaz Paratha & Garlic Chutney',
      notes: 'Spiced with chopped onion and garlic.',
      quantity: 20,
      unit: 'plates',
      foodType: 'Cooked Hot Meals',
      category: 'Cooked Hot Meals',
      pickupWindow: 'Today',
      expiryTime: 'Soon',
      location: 'Mumbai',
      donorName: 'Kitchen',
      donorOrg: 'Kitchen',
      donorEmail: 'k@test.com',
      status: 'available',
      safetyChecklist: { tempSafety: true, freshlyPrepared: true, cleanPackaging: true, hygieneAllergen: true },
      isVeg: true,
      dietaryType: 'veg',
    };

    const matchOnion = evaluateDietaryMatch(foodWithOnion, jainProfile);
    assert.equal(matchOnion.isMatch, false);
    assert.ok(matchOnion.incompatibleReasons.some((r) => r.includes('onion') || r.includes('garlic')));

    const pureJainFood: FoodListing = {
      id: 'food-jain',
      donorId: 'donor-1',
      title: 'Moong Dal Khichdi & Gujiya (Satvik Jain Preparation)',
      notes: 'Strict satvik preparation without any root vegetables, onion, or garlic.',
      quantity: 20,
      unit: 'plates',
      foodType: 'Cooked Hot Meals',
      category: 'Cooked Hot Meals',
      pickupWindow: 'Today',
      expiryTime: 'Soon',
      location: 'Mumbai',
      donorName: 'Kitchen',
      donorOrg: 'Kitchen',
      donorEmail: 'k@test.com',
      status: 'available',
      safetyChecklist: { tempSafety: true, freshlyPrepared: true, cleanPackaging: true, hygieneAllergen: true },
      isVeg: true,
      dietaryType: 'veg',
    };

    const matchJain = evaluateDietaryMatch(pureJainFood, jainProfile);
    assert.equal(matchJain.isMatch, true);
    assert.ok(matchJain.matchedTags.some((t) => t.includes('Jain')));
  });

  it('blocks allergens declared in recipient profile (e.g. Nut allergy)', () => {
    const nutFreeProfile = {
      ...DEFAULT_DIETARY_PROFILE,
      nutFree: true,
    };

    const nutDish: FoodListing = {
      id: 'food-nuts',
      donorId: 'donor-1',
      title: 'Shahi Korma with Cashew Gravy',
      allergens: ['Nuts', 'Dairy'],
      quantity: 15,
      unit: 'plates',
      foodType: 'Cooked Hot Meals',
      category: 'Cooked Hot Meals',
      pickupWindow: 'Today',
      expiryTime: 'Soon',
      location: 'Mumbai',
      donorName: 'Kitchen',
      donorOrg: 'Kitchen',
      donorEmail: 'k@test.com',
      status: 'available',
      safetyChecklist: { tempSafety: true, freshlyPrepared: true, cleanPackaging: true, hygieneAllergen: true },
    };

    const match = evaluateDietaryMatch(nutDish, nutFreeProfile);
    assert.equal(match.isMatch, false);
    assert.ok(match.incompatibleReasons.some((r) => r.toLowerCase().includes('nut')));
  });
});

describe('📦 Shelter Capacity & Anti-Dumping Intake Management', () => {
  it('blocks claim and triggers auto-pause when daily intake ceiling is reached', () => {
    const shelterAtLimit = {
      ...DEFAULT_CAPACITY_SETTINGS,
      dailyIntakeCeilingMeals: 50,
      currentIntakeMealsToday: 48,
    };

    const largeSurplus: FoodListing = {
      id: 'large-batch',
      donorId: 'donor-1',
      title: 'Corporate Canteen Rice & Curry',
      quantity: 60,
      unit: 'plates',
      foodType: 'Cooked Hot Meals',
      category: 'Cooked Hot Meals',
      pickupWindow: 'Today',
      expiryTime: 'Soon',
      location: 'Mumbai',
      donorName: 'Canteen',
      donorOrg: 'Canteen',
      donorEmail: 'c@test.com',
      status: 'available',
      safetyChecklist: { tempSafety: true, freshlyPrepared: true, cleanPackaging: true, hygieneAllergen: true },
    };

    const check = checkShelterIntakeCapacity(largeSurplus, shelterAtLimit);
    assert.equal(check.canAccept, false);
    assert.equal(check.mealsExceeded, true);
    assert.ok(check.reason?.includes('ceiling'));
  });

  it('allows claim within remaining intake quota', () => {
    const shelterWithRoom = {
      ...DEFAULT_CAPACITY_SETTINGS,
      dailyIntakeCeilingMeals: 150,
      currentIntakeMealsToday: 40,
    };

    const smallSurplus: FoodListing = {
      id: 'small-batch',
      donorId: 'donor-1',
      title: 'Fresh Bread Rolls',
      quantity: 30,
      unit: 'plates',
      foodType: 'Bakery',
      category: 'Bakery',
      pickupWindow: 'Today',
      expiryTime: 'Soon',
      location: 'Mumbai',
      donorName: 'Bakery',
      donorOrg: 'Bakery',
      donorEmail: 'b@test.com',
      status: 'available',
      safetyChecklist: { tempSafety: true, freshlyPrepared: true, cleanPackaging: true, hygieneAllergen: true },
    };

    const check = checkShelterIntakeCapacity(smallSurplus, shelterWithRoom);
    assert.equal(check.canAccept, true);
    assert.equal(check.mealsExceeded, false);
  });
});

describe('📊 Enterprise CSR & SEBI BRSR Reporting', () => {
  it('computes SEBI BRSR Core Principles 6 & 8 metrics', () => {
    const metrics = computeBrsrMetrics(
      2000, // 2000 kg surplus rescued
      'The Indian Hotels Company Limited (IHCL)',
      'L55101MH1903PLC000199',
      'AABCT1234F',
      5
    );

    assert.equal(metrics.totalSurplusTonnes, 2.0); // 2 MT
    assert.equal(metrics.totalMealsDistributed, 5000); // 2000 * 2.5
    assert.equal(metrics.scope3GhgAvoidedTonnes, 4.9); // 2000 * 2.45 / 1000
    assert.ok(metrics.methaneAvoidedM3 > 0);
    assert.ok(metrics.waterConservedLiters > 0);
    assert.ok(metrics.chainOfCustodyAuditHash.startsWith('SEBI-BRSR-'));
  });

  it('generates compliant SEBI BRSR Core CSV format', () => {
    const metrics = computeBrsrMetrics(1000);
    const csv = formatBrsrCsv(metrics);
    assert.ok(csv.includes('SEBI PRINCIPLE 6: BUSINESS RESPONSIBILITY'));
    assert.ok(csv.includes('SEBI PRINCIPLE 8: INCLUSIVE GROWTH'));
    assert.ok(csv.includes('P6-W1'));
    assert.ok(csv.includes('P8-S1'));
  });
});

describe('🏢 Corporate Hierarchy & Multi-Branch Accounts', () => {
  it('loads multi-branch corporate account with centralized kitchens', () => {
    const corp = loadCorporateAccount();
    assert.ok(corp.branches.length >= 2);
    const branch1 = getBranchById('branch-taj-lands-end');
    assert.ok(branch1);
    assert.equal(branch1?.name, 'Taj Lands End - Bandra West');
    assert.ok(branch1?.fssaiNumber.length > 0);
  });

  it('computes centralized corporate aggregate impact across all branches', () => {
    const corp = loadCorporateAccount();
    const aggregates = computeCorporateAggregates(corp);
    assert.ok(aggregates.totalKgRescued > 0);
    assert.ok(aggregates.totalMealsServed > 0);
    assert.ok(aggregates.totalCo2SavedKg > 0);
    assert.equal(aggregates.activeBranchesCount, corp.branches.filter((b) => b.isActive).length);
  });
});
