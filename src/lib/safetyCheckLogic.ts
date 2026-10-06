/**
 * FoodLink - Food Safety Check Logic
 * Provides deterministic holding window calculations and strict schema validation
 * for automated multimodal Gemini AI assessments under FSSAI surplus food regulations.
 */

export type SafetyVerdict = 'safe' | 'caution' | 'unsafe';

export interface SafetyCheckResult {
  verdict: SafetyVerdict;
  score: number; // 0 - 100
  reasons: string[];
  missingInfo: string[];
  holdingWindowRemainingMinutes: number;
}

export interface HoldingWindowParams {
  prepDate?: string;
  prepTime?: string;
  safeHoldingHours?: number;
  safeUntilMillis?: number;
  safeUntil?: unknown;
  now?: number;
}

export interface HoldingWindowResult {
  isExpired: boolean;
  remainingMinutes: number;
  reason?: string;
  expiryTimestamp?: number;
}

/**
 * Deterministically computes the holding window in minutes and determines expiration.
 * The AI safety assessment must NEVER override a deterministic expired result.
 */
export function computeHoldingWindow(params: HoldingWindowParams): HoldingWindowResult {
  const currentTime = typeof params.now === 'number' ? params.now : Date.now();
  let expiryMs: number | null = null;

  // 1. Direct millisecond timestamp
  if (typeof params.safeUntilMillis === 'number' && !isNaN(params.safeUntilMillis)) {
    expiryMs = params.safeUntilMillis;
  }
  // 2. Firestore Timestamp object with toMillis()
  else if (params.safeUntil && typeof (params.safeUntil as { toMillis?: () => number }).toMillis === 'function') {
    expiryMs = (params.safeUntil as { toMillis: () => number }).toMillis();
  }
  // 3. Date instance or ISO string
  else if (params.safeUntil instanceof Date) {
    expiryMs = params.safeUntil.getTime();
  } else if (typeof params.safeUntil === 'string' && !isNaN(Date.parse(params.safeUntil))) {
    expiryMs = Date.parse(params.safeUntil);
  }
  // 4. Fallback to prepDate + prepTime + safeHoldingHours
  else if (params.prepDate && params.prepTime) {
    try {
      const [year, month, day] = params.prepDate.split('-').map(Number);
      const [hours, minutes] = params.prepTime.split(':').map(Number);
      const prepDate = new Date(year, month - 1, day, hours, minutes);

      if (!isNaN(prepDate.getTime())) {
        const hoursToAdd = typeof params.safeHoldingHours === 'number' && params.safeHoldingHours > 0
          ? params.safeHoldingHours
          : 4; // FSSAI recommended max standard hot/cold holding window
        expiryMs = prepDate.getTime() + hoursToAdd * 60 * 60 * 1000;
      }
    } catch {
      expiryMs = null;
    }
  }

  // If no valid time could be established
  if (expiryMs === null || isNaN(expiryMs)) {
    return {
      isExpired: true,
      remainingMinutes: 0,
      reason: 'Preparation timestamp or holding window duration is missing or unparseable.',
      expiryTimestamp: undefined,
    };
  }

  const diffMs = expiryMs - currentTime;
  const remainingMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMs <= 0) {
    const elapsedMins = Math.abs(remainingMinutes);
    return {
      isExpired: true,
      remainingMinutes: 0,
      reason: `Safe holding window has expired (exceeded by ${elapsedMins} minute${elapsedMins === 1 ? '' : 's'}).`,
      expiryTimestamp: expiryMs,
    };
  }

  return {
    isExpired: false,
    remainingMinutes,
    reason: undefined,
    expiryTimestamp: expiryMs,
  };
}

/**
 * Validates the raw JSON output from the Gemini AI model against the required schema.
 * If invalid or malformed, gracefully falls back to verdict "caution" with reason "AI check unavailable".
 * If deterministic holding window is expired, the verdict is strictly forced to "unsafe".
 */
export function validateAndSanitizeGeminiOutput(
  rawText: string | unknown,
  deterministicWindow: HoldingWindowResult
): SafetyCheckResult {
  let parsed: unknown = null;

  if (typeof rawText === 'string') {
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      parsed = null;
    }
  } else if (rawText && typeof rawText === 'object') {
    parsed = rawText;
  }

  const fallback: SafetyCheckResult = {
    verdict: 'caution',
    score: 50,
    reasons: ['AI check unavailable'],
    missingInfo: [],
    holdingWindowRemainingMinutes: deterministicWindow.remainingMinutes,
  };

  if (!parsed || typeof parsed !== 'object') {
    return applyDeterministicOverride(fallback, deterministicWindow);
  }

  const candidate = parsed as Record<string, unknown>;

  // Check required verdict
  const verdictRaw = String(candidate.verdict || '').toLowerCase().trim();
  const validVerdicts: SafetyVerdict[] = ['safe', 'caution', 'unsafe'];
  if (!validVerdicts.includes(verdictRaw as SafetyVerdict)) {
    return applyDeterministicOverride(fallback, deterministicWindow);
  }
  const verdict = verdictRaw as SafetyVerdict;

  // Check score (0 - 100 integer)
  let score = typeof candidate.score === 'number' && !isNaN(candidate.score)
    ? Math.round(candidate.score)
    : 50;
  score = Math.max(0, Math.min(100, score));

  // Check reasons array
  const reasons: string[] = Array.isArray(candidate.reasons)
    ? candidate.reasons
        .filter((r) => typeof r === 'string' && r.trim().length > 0)
        .map((r) => String(r).trim().slice(0, 300))
    : [];

  if (reasons.length === 0) {
    if (verdict === 'safe') {
      reasons.push('Food preparation parameters, clean packaging, and declared holding window meet safety standards.');
    } else if (verdict === 'caution') {
      reasons.push('Food requires physical hygiene inspection prior to recipient intake.');
    } else {
      reasons.push('Food fails safety criteria based on holding window or hygiene parameters.');
    }
  }

  // Check missingInfo array
  const missingInfo: string[] = Array.isArray(candidate.missingInfo)
    ? candidate.missingInfo
        .filter((m) => typeof m === 'string' && m.trim().length > 0)
        .map((m) => String(m).trim().slice(0, 200))
    : [];

  // Compute remaining minutes: prefer deterministic calculation over AI guess
  const holdingWindowRemainingMinutes = deterministicWindow.remainingMinutes;

  const result: SafetyCheckResult = {
    verdict,
    score,
    reasons,
    missingInfo,
    holdingWindowRemainingMinutes,
  };

  return applyDeterministicOverride(result, deterministicWindow);
}

/**
 * Enforces the deterministic holding window override:
 * The AI must NEVER override a deterministic "expired" result.
 */
function applyDeterministicOverride(
  result: SafetyCheckResult,
  deterministicWindow: HoldingWindowResult
): SafetyCheckResult {
  if (deterministicWindow.isExpired) {
    const expiredReason = deterministicWindow.reason || 'Safe holding window has expired.';
    const reasons = [
      expiredReason,
      ...result.reasons.filter((r) => r !== expiredReason && r !== 'AI check unavailable'),
    ];

    return {
      verdict: 'unsafe',
      score: Math.min(result.score, 20),
      reasons,
      missingInfo: result.missingInfo,
      holdingWindowRemainingMinutes: 0,
    };
  }

  return result;
}

/**
 * Builds the multimodal inspection context prompt for Gemini.
 */
export function buildSafetyPrompt(listing: {
  title?: string;
  category?: string;
  foodType?: string;
  quantity?: number;
  unit?: string;
  prepDate?: string;
  prepTime?: string;
  storageCondition?: string;
  allergens?: string[];
  safeHoldingHours?: number;
  notes?: string;
  location?: string;
}): string {
  const safeTitle = listing.title || 'Surplus Meal';
  const safeCategory = listing.category || 'Cooked food';
  const safeStorage = listing.storageCondition || 'Room temperature';
  const safeAllergens = Array.isArray(listing.allergens) && listing.allergens.length > 0
    ? listing.allergens.join(', ')
    : 'None declared';
  const safeQuantity = listing.quantity ? `${listing.quantity} ${listing.unit || 'portions'}` : 'Not specified';
  const safePrep = listing.prepDate && listing.prepTime
    ? `${listing.prepDate} at ${listing.prepTime}`
    : 'Not declared';
  const safeWindow = listing.safeHoldingHours ? `${listing.safeHoldingHours} hours` : 'Standard 4h window';
  const safeNotes = listing.notes || 'None';

  return `You are a certified food hygiene and safety expert inspecting surplus food donations for recipient charities, orphanages, and shelters in India under FSSAI surplus food regulations.

Listing Food Details:
- Title: ${safeTitle}
- Category: ${safeCategory} (Veg / Non-veg)
- Storage Condition: ${safeStorage}
- Declared Allergens: ${safeAllergens}
- Quantity: ${safeQuantity}
- Preparation Timestamp: ${safePrep}
- Declared Safe Holding Window: ${safeWindow}
- Donor Notes: ${safeNotes}

Task Instructions:
1. Review the food details and inspect any provided photo(s) for visual freshness, clean food-grade packaging, and spoilage indicators (discoloration, mold, separation, steam/heat seal, slime, exposure to dust/pests).
2. Evaluate compliance with FSSAI hygiene guidelines for surplus food redistribution:
   - Hot food must be stored and transported above 60°C.
   - Chilled food must be held below 5°C.
   - Cooked food held at ambient room temperature must be consumed within a maximum 4-hour window.
3. Return a strict JSON response conforming to this exact schema:
{
  "verdict": "safe" | "caution" | "unsafe",
  "score": number between 0 and 100,
  "reasons": ["Concise, factual reason 1", "Reason 2"],
  "missingInfo": ["Any unverified critical parameter, e.g. lack of cold-chain declaration"],
  "holdingWindowRemainingMinutes": number of estimated minutes safe to eat
}
- "safe": Food appears freshly prepared, appropriately stored in hygienic packaging, with ample holding window.
- "caution": Visual inspection required; minor ambiguities in storage temperature, missing allergen or packaging details.
- "unsafe": Visible degradation, spoilage signs, improper thermal holding, or excessive holding duration.`;
}
