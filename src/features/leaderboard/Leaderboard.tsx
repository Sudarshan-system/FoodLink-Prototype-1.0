import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/AuthContext';

export interface LeaderboardDonor {
  id: string;
  name: string;
  orgName: string;
  category: 'restaurant' | 'banquet' | 'corporate' | 'individual' | 'retail';
  categoryLabel: string;
  location: string;
  city: string;
  totalDonationsCount: number;
  totalPlates: number; // Quantity in portions/plates
  totalKg: number; // Estimated weight in kilograms
  score: number; // Calculated highest score / impact points
  co2SavedKg: number; // Environmental emissions avoided
  rank?: number;
  badge?: string;
  verified: boolean;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  onNavigateDonor?: () => void;
  onOpenAuth?: (role?: 'donor' | 'recipient') => void;
}

// Baseline top community donors across India
export const SEED_LEADERBOARD_DONORS: LeaderboardDonor[] = [
  {
    id: 'donor_seed_1',
    name: 'Chef Marcus Vance',
    orgName: 'The Grand Bistro & Banquet',
    category: 'restaurant',
    categoryLabel: 'Restaurant & Banquet',
    location: 'Bandra West, Mumbai',
    city: 'Mumbai',
    totalDonationsCount: 142,
    totalPlates: 14850,
    totalKg: 3712,
    score: 148500,
    co2SavedKg: 9280,
    badge: 'Grand Champion Donor',
    verified: true,
  },
  {
    id: 'donor_seed_2',
    name: 'Rajiv Singhania',
    orgName: 'Taj Palace & Banquet Caterers',
    category: 'banquet',
    categoryLabel: 'Wedding Banquet & Catering',
    location: 'Connaught Place, Delhi NCR',
    city: 'Delhi NCR',
    totalDonationsCount: 118,
    totalPlates: 12400,
    totalKg: 3100,
    score: 124000,
    co2SavedKg: 7750,
    badge: 'Diamond Benefactor',
    verified: true,
  },
  {
    id: 'donor_seed_3',
    name: 'Ananya Sharma',
    orgName: 'TechPark Corporate Dining',
    category: 'corporate',
    categoryLabel: 'Corporate Cafeteria',
    location: 'Electronic City, Bengaluru',
    city: 'Bengaluru',
    totalDonationsCount: 94,
    totalPlates: 9600,
    totalKg: 2400,
    score: 96000,
    co2SavedKg: 6000,
    badge: 'CSR Food Guardian',
    verified: true,
  },
  {
    id: 'donor_seed_4',
    name: 'Vikramaditya Roy',
    orgName: 'ITC Gardenia Hospitality',
    category: 'restaurant',
    categoryLabel: 'Five Star Hospitality',
    location: 'Residency Road, Bengaluru',
    city: 'Bengaluru',
    totalDonationsCount: 76,
    totalPlates: 7850,
    totalKg: 1962,
    score: 78500,
    co2SavedKg: 4905,
    badge: 'Gold Food Hero',
    verified: true,
  },
  {
    id: 'donor_seed_5',
    name: 'Debashis Mukherjee',
    orgName: 'Oberoi Grand Banquets',
    category: 'banquet',
    categoryLabel: 'Banquet & Events',
    location: 'Esplanade, Kolkata',
    city: 'Kolkata',
    totalDonationsCount: 65,
    totalPlates: 6420,
    totalKg: 1605,
    score: 64200,
    co2SavedKg: 4012,
    badge: 'Community Anchor',
    verified: true,
  },
  {
    id: 'donor_seed_6',
    name: 'Sunil Agrawal',
    orgName: 'Haldiram Central Kitchen',
    category: 'retail',
    categoryLabel: 'Food Manufacturer',
    location: 'Sector 62, Noida (Delhi NCR)',
    city: 'Delhi NCR',
    totalDonationsCount: 52,
    totalPlates: 5300,
    totalKg: 1325,
    score: 53000,
    co2SavedKg: 3312,
    badge: 'Surplus Lifeline',
    verified: true,
  },
  {
    id: 'donor_seed_7',
    name: 'Pooja Deshmukh',
    orgName: 'Sayaji Hotels & Convention',
    category: 'restaurant',
    categoryLabel: 'Hotel & Convention',
    location: 'Wakad, Pune',
    city: 'Pune',
    totalDonationsCount: 48,
    totalPlates: 4750,
    totalKg: 1188,
    score: 47500,
    co2SavedKg: 2970,
    badge: 'Silver Sustainer',
    verified: true,
  },
  {
    id: 'donor_seed_8',
    name: 'Ketan Shah',
    orgName: 'FreshProduce Logistics Hub',
    category: 'retail',
    categoryLabel: 'Produce & Grocery Wholesale',
    location: 'Sanand, Ahmedabad',
    city: 'Ahmedabad',
    totalDonationsCount: 39,
    totalPlates: 3900,
    totalKg: 975,
    score: 39000,
    co2SavedKg: 2438,
    badge: 'Harvest Guardian',
    verified: true,
  },
];

export const Leaderboard: React.FC<LeaderboardProps> = ({
  onNavigateDonor,
  onOpenAuth,
}) => {
  const { currentUser, userProfile } = useAuth();

  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'restaurant' | 'banquet' | 'corporate' | 'retail'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [realtimeDonors, setRealtimeDonors] = useState<Record<string, LeaderboardDonor>>({});

  // Real-time listener for Firestore listings to aggregate actual user donations
  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const unsubscribe = onSnapshot(
      listingsRef,
      (snapshot) => {
        const donorAggregates: Record<string, LeaderboardDonor> = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const donorKey = data.donorId || data.donorEmail || data.donorName || 'unknown_donor';
          const qty = Number(data.quantity) || 0;
          const unit = (data.unit || 'plates').toLowerCase();

          // Approximate portions count
          let plateCount = qty;
          if (unit.includes('kg') || unit.includes('kilo')) {
            plateCount = qty * 4; // Approx 250g per meal portion
          }

          const kgEstimate = Math.round(plateCount * 0.25);
          // Score formula: 10 points per portion + 50 points per rescue mission
          const donationScore = plateCount * 10 + 50;

          if (!donorAggregates[donorKey]) {
            const orgTitle = data.donorOrg || data.donorName || 'Independent Donor';
            const contactName = data.donorName || orgTitle;
            const donorCat = data.donorType === 'restaurant' ? 'restaurant' : 'banquet';

            donorAggregates[donorKey] = {
              id: donorKey,
              name: contactName,
              orgName: orgTitle,
              category: donorCat,
              categoryLabel: donorCat === 'restaurant' ? 'Restaurant Partner' : 'Event Organizer',
              location: data.location || 'Local Donor Center',
              city: data.location?.includes('Mumbai')
                ? 'Mumbai'
                : data.location?.includes('Delhi')
                ? 'Delhi NCR'
                : data.location?.includes('Bengaluru')
                ? 'Bengaluru'
                : 'National Partner',
              totalDonationsCount: 1,
              totalPlates: plateCount,
              totalKg: kgEstimate,
              score: donationScore,
              co2SavedKg: Math.round(kgEstimate * 2.5),
              verified: true,
              isCurrentUser: currentUser ? (data.donorId === currentUser.uid || data.donorEmail === currentUser.email) : false,
            };
          } else {
            donorAggregates[donorKey].totalDonationsCount += 1;
            donorAggregates[donorKey].totalPlates += plateCount;
            donorAggregates[donorKey].totalKg += kgEstimate;
            donorAggregates[donorKey].score += donationScore;
            donorAggregates[donorKey].co2SavedKg += Math.round(kgEstimate * 2.5);
            if (currentUser && (data.donorId === currentUser.uid || data.donorEmail === currentUser.email)) {
              donorAggregates[donorKey].isCurrentUser = true;
            }
          }
        });

        setRealtimeDonors(donorAggregates);
      },
      (err) => {
        console.warn('Leaderboard Firestore sync:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Combine baseline community donors with real-time aggregates
  const combinedDonors = useMemo(() => {
    const list: LeaderboardDonor[] = [...SEED_LEADERBOARD_DONORS];

    // Merge or add real-time aggregates
    Object.values(realtimeDonors).forEach((rtDonor) => {
      const existingIdx = list.findIndex(
        (d) => d.orgName.toLowerCase() === rtDonor.orgName.toLowerCase() || (d.id === rtDonor.id)
      );

      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          totalDonationsCount: list[existingIdx].totalDonationsCount + rtDonor.totalDonationsCount,
          totalPlates: list[existingIdx].totalPlates + rtDonor.totalPlates,
          totalKg: list[existingIdx].totalKg + rtDonor.totalKg,
          score: list[existingIdx].score + rtDonor.score,
          co2SavedKg: list[existingIdx].co2SavedKg + rtDonor.co2SavedKg,
          isCurrentUser: rtDonor.isCurrentUser || list[existingIdx].isCurrentUser,
        };
      } else {
        list.push(rtDonor);
      }
    });

    // If current logged in user is a donor and not in list yet, ensure they are represented
    if (currentUser && userProfile?.role === 'donor') {
      const userAlreadyInList = list.some((d) => d.isCurrentUser);
      if (!userAlreadyInList) {
        list.push({
          id: currentUser.uid,
          name: currentUser.displayName || 'You',
          orgName: userProfile.orgName || currentUser.displayName || 'Your Kitchen',
          category: 'restaurant',
          categoryLabel: 'Registered Donor',
          location: userProfile.city || 'Your Area',
          city: userProfile.city || 'Local',
          totalDonationsCount: 1,
          totalPlates: 50,
          totalKg: 13,
          score: 550,
          co2SavedKg: 32,
          verified: true,
          isCurrentUser: true,
          badge: 'Rising Contributor',
        });
      }
    }

    // Sort strictly by score descending (Highest Score at the top)
    list.sort((a, b) => b.score - a.score);

    // Assign rank numbers
    return list.map((donor, index) => ({
      ...donor,
      rank: index + 1,
    }));
  }, [realtimeDonors, currentUser, userProfile]);

  // Apply search and filter controls
  const filteredDonors = useMemo(() => {
    return combinedDonors.filter((donor) => {
      if (categoryFilter !== 'all' && donor.category !== categoryFilter) {
        return false;
      }
      if (cityFilter !== 'all' && donor.city.toLowerCase() !== cityFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = donor.name.toLowerCase().includes(q);
        const matchOrg = donor.orgName.toLowerCase().includes(q);
        const matchLoc = donor.location.toLowerCase().includes(q);
        if (!matchName && !matchOrg && !matchLoc) {
          return false;
        }
      }
      return true;
    });
  }, [combinedDonors, categoryFilter, cityFilter, searchQuery]);

  // Top 3 champions for podium
  const top1 = filteredDonors[0];
  const top2 = filteredDonors[1];
  const top3 = filteredDonors[2];

  // Aggregated totals
  const totalMealsAllTime = useMemo(
    () => combinedDonors.reduce((acc, curr) => acc + curr.totalPlates, 0),
    [combinedDonors]
  );
  const totalCo2AllTime = useMemo(
    () => Math.round(combinedDonors.reduce((acc, curr) => acc + curr.co2SavedKg, 0) / 1000),
    [combinedDonors]
  );

  return (
    <div className="w-full space-y-8">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D1FAE5] text-[#059669] border border-[#059669]/30 mb-2">
            <span className="material-symbols-outlined text-[16px]">leaderboard</span>
            <span>Food Rescue Impact Honor Roll</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#064E3B] dark:text-[#F0FDF8]">
            Donor Impact Leaderboard
          </h1>
          <p className="text-sm sm:text-base text-[#6B7280] dark:text-[#9CA3AF] mt-1.5 max-w-[70ch] leading-relaxed">
            Celebrating restaurants, banquet caterers, corporate kitchens, and community champions donating the highest quantity of fresh surplus food.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateDonor}
            className="px-5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-sm transition-colors min-h-[44px] flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
            <span>Donate Food to Rank</span>
          </button>
        </div>
      </div>

      {/* 2. STATS SUMMARY BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] shadow-2xs">
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium uppercase tracking-wide">
            Total Meals Rescued
          </span>
          <p className="text-2xl font-serif font-bold text-[#064E3B] dark:text-[#F0FDF8] mt-1">
            {totalMealsAllTime.toLocaleString()}
          </p>
          <span className="text-xs text-[#059669] font-semibold mt-0.5 inline-block">
            Portions distributed
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] shadow-2xs">
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium uppercase tracking-wide">
            Highest Score
          </span>
          <p className="text-2xl font-serif font-bold text-[#059669] mt-1">
            {combinedDonors[0]?.score ? combinedDonors[0].score.toLocaleString() : '0'} pts
          </p>
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5 inline-block truncate">
            Held by {combinedDonors[0]?.orgName || 'Top Donor'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] shadow-2xs">
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium uppercase tracking-wide">
            Active Donors
          </span>
          <p className="text-2xl font-serif font-bold text-[#064E3B] dark:text-[#F0FDF8] mt-1">
            {combinedDonors.length}
          </p>
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5 inline-block">
            Verified kitchens & caterers
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] shadow-2xs">
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium uppercase tracking-wide">
            CO₂ Averted
          </span>
          <p className="text-2xl font-serif font-bold text-[#064E3B] dark:text-[#F0FDF8] mt-1">
            {totalCo2AllTime} Tons
          </p>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 inline-block">
            Emissions prevented
          </span>
        </div>
      </div>

      {/* 3. PODIUM / TOP 3 HIGHEST SCORES */}
      {filteredDonors.length >= 3 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#064E3B] dark:text-[#F0FDF8] flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-[#059669]">emoji_events</span>
              <span>Top Donors by Highest Score</span>
            </h2>
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium">
              Ranked by total quantity donated & impact score
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Rank 2 (Silver) */}
            <div className="order-2 md:order-1 p-5 rounded-2xl bg-white dark:bg-[#064E3B] border-2 border-[#E7E5E4] dark:border-[#1E5C38] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm shadow-2xs border border-slate-300 dark:border-slate-600">
                    🥈 #2
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    Runner-up
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] truncate">
                  {top2.orgName}
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                  {top2.name} • {top2.location}
                </p>

                <div className="mt-4 pt-3 border-t border-[#E7E5E4] dark:border-[#1E5C38] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Quantity Donated:</span>
                    <span className="font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                      {top2.totalPlates.toLocaleString()} plates ({top2.totalKg.toLocaleString()} kg)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Highest Score:</span>
                    <span className="font-bold text-[#059669] text-sm">
                      {top2.score.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                <span className="material-symbols-outlined text-[15px] text-[#059669]">verified</span>
                <span>{top2.totalDonationsCount} rescue missions completed</span>
              </div>
            </div>

            {/* Rank 1 (Gold Champion - Center / Prominent) */}
            <div className="order-1 md:order-2 p-6 rounded-2xl bg-[#F0FDF8] dark:bg-[#1E1B18] border-2 border-[#059669] shadow-md relative -translate-y-1 md:-translate-y-2">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#059669] text-white px-3.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">military_tech</span>
                <span>Highest Score Champion</span>
              </div>

              <div className="flex items-center justify-between mt-1 mb-3">
                <span className="w-11 h-11 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center font-bold text-base shadow-xs border-2 border-[#059669]/40">
                  👑 #1
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#D1FAE5] text-[#059669] border border-[#059669]/30">
                  {top1.badge || 'Grand Champion'}
                </span>
              </div>

              <h3 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                {top1.orgName}
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                {top1.name} • {top1.location}
              </p>

              <div className="mt-5 p-3.5 rounded-xl bg-white dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#1E5C38] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF] font-medium">Quantity of Food Donated:</span>
                  <span className="font-bold text-[#064E3B] dark:text-[#F0FDF8] text-sm">
                    {top1.totalPlates.toLocaleString()} plates ({top1.totalKg.toLocaleString()} kg)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E7E5E4] dark:border-[#1E5C38]">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF] font-semibold">Highest Score:</span>
                  <span className="font-serif font-extrabold text-[#059669] text-lg">
                    {top1.score.toLocaleString()} pts
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span className="material-symbols-outlined text-[15px]">eco</span>
                  {top1.co2SavedKg.toLocaleString()} kg CO₂ averted
                </span>
                <span>{top1.totalDonationsCount} rescues</span>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="order-3 md:order-3 p-5 rounded-2xl bg-white dark:bg-[#064E3B] border-2 border-[#E7E5E4] dark:border-[#1E5C38] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 flex items-center justify-center font-bold text-sm shadow-2xs border border-amber-300 dark:border-amber-700">
                    🥉 #3
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                    3rd Place
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] truncate">
                  {top3.orgName}
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                  {top3.name} • {top3.location}
                </p>

                <div className="mt-4 pt-3 border-t border-[#E7E5E4] dark:border-[#1E5C38] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Quantity Donated:</span>
                    <span className="font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                      {top3.totalPlates.toLocaleString()} plates ({top3.totalKg.toLocaleString()} kg)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Highest Score:</span>
                    <span className="font-bold text-[#059669] text-sm">
                      {top3.score.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                <span className="material-symbols-outlined text-[15px] text-[#059669]">verified</span>
                <span>{top3.totalDonationsCount} rescue missions completed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. FILTER CONTROLS & SEARCH */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search donor name, restaurant, banquet, or city..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#141210] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:border-[#059669] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280] hover:text-[#064E3B]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="h-11 px-3 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#141210] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:border-[#059669] cursor-pointer"
            >
              <option value="all">All Donor Categories</option>
              <option value="restaurant">Restaurants & Hospitality</option>
              <option value="banquet">Wedding & Banquets</option>
              <option value="corporate">Corporate Cafeterias</option>
              <option value="retail">Wholesale & Retail</option>
            </select>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-11 px-3 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#141210] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:border-[#059669] cursor-pointer"
            >
              <option value="all">All Cities</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Delhi NCR">Delhi NCR</option>
              <option value="Bengaluru">Bengaluru</option>
              <option value="Kolkata">Kolkata</option>
              <option value="Pune">Pune</option>
              <option value="Ahmedabad">Ahmedabad</option>
            </select>
          </div>
        </div>

        {/* Quick Time Range Chips */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E7E5E4] dark:border-[#1E5C38] text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#6B7280] dark:text-[#9CA3AF] font-medium mr-1">Time Horizon:</span>
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-[#064E3B] text-white dark:bg-[#F0FDF8] dark:text-[#064E3B]'
                  : 'bg-stone-100 dark:bg-stone-800 text-[#6B7280] hover:text-[#064E3B]'
              }`}
            >
              All-Time
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                timeFilter === 'month'
                  ? 'bg-[#064E3B] text-white dark:bg-[#F0FDF8] dark:text-[#064E3B]'
                  : 'bg-stone-100 dark:bg-stone-800 text-[#6B7280] hover:text-[#064E3B]'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                timeFilter === 'week'
                  ? 'bg-[#064E3B] text-white dark:bg-[#F0FDF8] dark:text-[#064E3B]'
                  : 'bg-stone-100 dark:bg-stone-800 text-[#6B7280] hover:text-[#064E3B]'
              }`}
            >
              This Week
            </button>
          </div>

          <span className="text-[#6B7280] dark:text-[#9CA3AF]">
            Showing {filteredDonors.length} of {combinedDonors.length} donors
          </span>
        </div>
      </div>

      {/* 5. FULL LEADERBOARD TABLE */}
      <div className="rounded-xl border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F0FDF8] dark:bg-[#141210] border-b border-[#E7E5E4] dark:border-[#1E5C38] text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">Rank</th>
                <th className="py-3.5 px-4">Donor Name & Organization</th>
                <th className="py-3.5 px-4">Category & Location</th>
                <th className="py-3.5 px-4 text-right">Quantity of Food Donated</th>
                <th className="py-3.5 px-4 text-right">Highest Score</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4] dark:divide-[#1E5C38] text-sm">
              {filteredDonors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#6B7280]">
                    No donors matching your search or filters.
                  </td>
                </tr>
              ) : (
                filteredDonors.map((donor) => {
                  const isTop1 = donor.rank === 1;
                  const isTop2 = donor.rank === 2;
                  const isTop3 = donor.rank === 3;

                  return (
                    <tr
                      key={donor.id}
                      className={`hover:bg-[#F0FDF8] dark:hover:bg-[#1E1B18] transition-colors ${
                        donor.isCurrentUser ? 'bg-[#D1FAE5]/40 dark:bg-amber-950/20 font-medium' : ''
                      }`}
                    >
                      {/* Rank Column */}
                      <td className="py-4 px-4 text-center">
                        {isTop1 ? (
                          <span className="inline-flex w-7 h-7 rounded-full bg-[#D1FAE5] text-[#059669] font-bold text-xs items-center justify-center border border-[#059669]/40">
                            🥇
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs items-center justify-center border border-slate-300">
                            🥈
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold text-xs items-center justify-center border border-amber-300">
                            🥉
                          </span>
                        ) : (
                          <span className="font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                            #{donor.rank}
                          </span>
                        )}
                      </td>

                      {/* Donor Name & Org */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] flex items-center justify-center font-bold text-sm shrink-0">
                            {donor.orgName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                                {donor.orgName}
                              </span>
                              {donor.isCurrentUser && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#059669] text-white">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                              {donor.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category & Location */}
                      <td className="py-4 px-4">
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-[#57534E] dark:text-[#D6D3D1]">
                          {donor.categoryLabel}
                        </span>
                        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span className="truncate max-w-[200px]">{donor.location}</span>
                        </p>
                      </td>

                      {/* Quantity of Food Donated */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-[#064E3B] dark:text-[#F0FDF8] text-sm">
                          {donor.totalPlates.toLocaleString()} portions
                        </div>
                        <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                          ~{donor.totalKg.toLocaleString()} kg food
                        </div>
                      </td>

                      {/* Highest Score */}
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] font-bold text-sm">
                          <span className="material-symbols-outlined text-[16px]">stars</span>
                          <span>{donor.score.toLocaleString()} pts</span>
                        </div>
                        <div className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-0.5 font-medium">
                          {donor.totalDonationsCount} rescues
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#D1FAE5] text-[#059669] border border-[#059669]/30">
                          <span className="material-symbols-outlined text-[13px]">verified</span>
                          <span>Verified</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. HOW SCORES ARE CALCULATED & CALL TO ACTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-[#059669]">calculate</span>
            <h3 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8]">
              How Leaderboard Scores are Calculated
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
            The FoodLink Impact Score ranks organizations objectively to recognize commitment to eliminating hunger and food waste.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-[#F0FDF8] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#1E5C38]">
              <span className="text-xs font-bold text-[#059669]">10 Pts per Meal</span>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Every verified portion or plate donated awards 10 points.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F0FDF8] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#1E5C38]">
              <span className="text-xs font-bold text-[#059669]">50 Pts per Mission</span>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Completed pickup missions receive a consistency multiplier.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F0FDF8] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#1E5C38]">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">CO₂ Reductions</span>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Tracks exact greenhouse gas emissions kept out of landfills.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-6 rounded-2xl bg-[#D1FAE5] dark:bg-[#1E1B18] border border-[#059669]/30 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#059669]">
              Join the Network
            </span>
            <h3 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mt-1 mb-2">
              Ready to see your kitchen on the Leaderboard?
            </h3>
            <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
              Every surplus tray, unserved banquet banquet batch, or batch of prepared meals you list helps families in need and climbs the leaderboard rankings.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={onNavigateDonor}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-sm transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs"
            >
              List Surplus Food
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth && onOpenAuth('donor')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] hover:bg-stone-50 dark:hover:bg-stone-800 text-[#064E3B] dark:text-[#F0FDF8] font-semibold text-sm transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              Register Donor Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
