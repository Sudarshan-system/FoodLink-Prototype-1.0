// Sample food photos (optimized data URIs) for quick testing of FoodLink listings
// Includes fresh safe meals as well as a demo flagged sample for testing the Gemini safety inspection flow.

export interface SampleFoodImage {
  id: string;
  name: string;
  type: string;
  category: string;
  url: string;
  expectedVerdict: 'Looks safe' | 'Flagged for review';
  expectedReason: string;
}

// Crisp SVG-based food representations encoded as clean data URIs
function createFoodSvgDataUri(
  title: string,
  emoji: string,
  bgColor: string,
  accentColor: string,
  isFlagged = false
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgColor}"/>
        <stop offset="100%" stop-color="${accentColor}"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect width="600" height="400" rx="24" fill="url(#bgGrad)"/>
    <g filter="url(#shadow)">
      <rect x="50" y="50" width="500" height="300" rx="20" fill="#ffffff" fill-opacity="0.12"/>
      <circle cx="300" cy="180" r="85" fill="#ffffff" fill-opacity="0.2"/>
      <text x="300" y="215" font-size="95" text-anchor="middle" font-family="system-ui, sans-serif">${emoji}</text>
      <text x="300" y="305" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="system-ui, sans-serif">${title}</text>
      ${
        isFlagged
          ? `<rect x="180" y="320" width="240" height="28" rx="14" fill="#93000a" fill-opacity="0.85"/>
             <text x="300" y="339" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="system-ui, sans-serif">⚠️ UNSEALED CONTAINER TEST</text>`
          : `<rect x="200" y="320" width="200" height="28" rx="14" fill="#059669" fill-opacity="0.85"/>
             <text x="300" y="339" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="system-ui, sans-serif">✓ FOOD-GRADE SEALED</text>`
      }
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_FOOD_IMAGES: SampleFoodImage[] = [
  {
    id: 'biryani',
    name: 'Vegetable Biryani & Dal',
    type: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    url: createFoodSvgDataUri('Fresh Royal Biryani in Sealed Chafer', '🍲', '#78350F', '#DC2626'),
    expectedVerdict: 'Looks safe',
    expectedReason: 'Food is freshly prepared, hot-held, and packed in food-safe insulated chafers.',
  },
  {
    id: 'bread',
    name: 'Artisan Sourdough Loaves',
    type: 'Bakery & Bread',
    category: 'Bakery & Bread',
    url: createFoodSvgDataUri('Artisan Breads in Kraft Wrappers', '🥖', '#9A5B20', '#C67D34'),
    expectedVerdict: 'Looks safe',
    expectedReason: 'Clean dry bakery batch with intact hygienic paper packaging.',
  },
  {
    id: 'curry',
    name: 'Mixed Veg Curry & Basmati Rice',
    type: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    url: createFoodSvgDataUri('Steamed Rice & Veggie Curry', '🍛', '#7B4119', '#BA6525'),
    expectedVerdict: 'Looks safe',
    expectedReason: 'Sealed container with no visible contaminants; stored within safe temp window.',
  },
  {
    id: 'flagged_test',
    name: 'Sample with Broken Packaging (Inspection Flag Test)',
    type: 'Chilled / Dairy / Deli',
    category: 'Chilled / Dairy / Deli',
    url: createFoodSvgDataUri('Unsealed Deli Tray (Review Test)', '⚠️', '#521D1A', '#8F2822', true),
    expectedVerdict: 'Flagged for review',
    expectedReason: 'Packaging seal appears compromised or open; recommend physical temperature inspection upon pickup.',
  },
];
