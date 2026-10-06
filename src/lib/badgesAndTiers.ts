// Badges and Tiers System for FoodLink

export interface TierInfo {
  id: string;
  name: string;
  minKg: number;
  maxKg: number;
}

export const RESCUE_TIERS: TierInfo[] = [
  { id: 'seedling', name: 'Seedling Rescuer', minKg: 0, maxKg: 50 },
  { id: 'community', name: 'Community Rescuer', minKg: 50, maxKg: 100 },
  { id: 'century', name: 'Century Rescuer', minKg: 100, maxKg: 250 },
  { id: 'half_tonne', name: 'Half-Tonne Titan', minKg: 250, maxKg: 500 },
  { id: 'tonne', name: 'Tonne Champion', minKg: 500, maxKg: 1000 },
  { id: 'legend', name: 'Legend of Relief', minKg: 1000, maxKg: 5000 },
];

export interface BadgePill {
  id: string;
  label: string;
  icon?: string;
  variant: 'emerald' | 'orange' | 'blue' | 'purple';
}

export function getUserTierAndProgress(totalKg: number = 420) {
  const currentKg = Math.max(0, Math.round(totalKg));
  
  // Find current tier
  let activeIndex = 0;
  for (let i = 0; i < RESCUE_TIERS.length; i++) {
    if (currentKg >= RESCUE_TIERS[i].minKg) {
      activeIndex = i;
    }
  }

  const activeTier = RESCUE_TIERS[activeIndex];
  const nextTier = RESCUE_TIERS[Math.min(activeIndex + 1, RESCUE_TIERS.length - 1)];

  const min = activeTier.minKg;
  const max = nextTier.maxKg;
  const span = Math.max(1, max - min);
  const progressPercent = Math.min(100, Math.max(10, Math.round(((currentKg - min) / span) * 100)));

  const nextLabel = activeIndex < RESCUE_TIERS.length - 1
    ? `Next: ${nextTier.name} ${currentKg} / ${nextTier.minKg} kg`
    : `Max Tier Achieved (${currentKg} kg)`;

  return {
    activeTier: activeTier.name,
    nextTier: nextTier.name,
    currentKg,
    targetKg: nextTier.minKg,
    progressPercent,
    nextLabel,
  };
}

export function getUserBadges(role?: string, kg: number = 420): BadgePill[] {
  const badges: BadgePill[] = [];

  if (kg >= 100) {
    badges.push({ id: 'century', label: 'Century Rescuer', variant: 'emerald' });
  }
  
  // Speed / Rapid dispatch badge
  badges.push({ id: 'rapid', label: 'Rapid', variant: 'orange' });

  if (role === 'volunteer') {
    badges.push({ id: 'courier_hero', label: 'Thermal Guard', variant: 'blue' });
  } else if (role === 'ngo' || role === 'recipient') {
    badges.push({ id: 'verified_ngo', label: 'Verified NGO', variant: 'purple' });
  } else {
    badges.push({ id: 'zero_waste', label: 'Zero Waste', variant: 'emerald' });
  }

  return badges;
}
