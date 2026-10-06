import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Sparkles, ArrowRight, Heart } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SEED_LEADERBOARD_DONORS, LeaderboardDonor } from '../../features/leaderboard/Leaderboard';

interface TopDonorsTickerProps {
  onNavigateLeaderboard?: () => void;
  onNavigateDonor?: () => void;
}

export const TopDonorsTicker: React.FC<TopDonorsTickerProps> = ({
  onNavigateLeaderboard,
  onNavigateDonor,
}) => {
  const [realtimeDonors, setRealtimeDonors] = useState<Record<string, LeaderboardDonor>>({});

  // Sync real-time donations from Firestore if available
  useEffect(() => {
    try {
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

            let plateCount = qty;
            if (unit.includes('kg') || unit.includes('kilo')) {
              plateCount = qty * 4;
            }
            const kgEstimate = Math.round(plateCount * 0.25);
            const donationScore = plateCount * 10 + 50;

            if (!donorAggregates[donorKey]) {
              const orgTitle = data.donorOrg || data.donorName || 'Independent Food Rescuer';
              const contactName = data.donorName || orgTitle;
              const donorCat = data.donorType === 'restaurant' ? 'restaurant' : 'banquet';

              donorAggregates[donorKey] = {
                id: donorKey,
                name: contactName,
                orgName: orgTitle,
                category: donorCat,
                categoryLabel: donorCat === 'restaurant' ? 'Restaurant Partner' : 'Event Caterer',
                location: data.location || 'Local Center',
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
              };
            } else {
              donorAggregates[donorKey].totalDonationsCount += 1;
              donorAggregates[donorKey].totalPlates += plateCount;
              donorAggregates[donorKey].totalKg += kgEstimate;
              donorAggregates[donorKey].score += donationScore;
              donorAggregates[donorKey].co2SavedKg += Math.round(kgEstimate * 2.5);
            }
          });

          setRealtimeDonors(donorAggregates);
        },
        (err) => {
          console.warn('TopDonorsTicker Firestore sync:', err);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('TopDonorsTicker Firestore listener setup failed:', e);
    }
  }, []);

  // Compute top 3 donors by combining baseline seed and live data
  const topThreeDonors = useMemo(() => {
    const list: LeaderboardDonor[] = [...SEED_LEADERBOARD_DONORS];

    Object.values(realtimeDonors).forEach((rtDonor) => {
      const existingIdx = list.findIndex(
        (d) => d.orgName.toLowerCase() === rtDonor.orgName.toLowerCase() || d.id === rtDonor.id
      );
      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          totalDonationsCount: list[existingIdx].totalDonationsCount + rtDonor.totalDonationsCount,
          totalPlates: list[existingIdx].totalPlates + rtDonor.totalPlates,
          totalKg: list[existingIdx].totalKg + rtDonor.totalKg,
          score: list[existingIdx].score + rtDonor.score,
        };
      } else {
        list.push(rtDonor);
      }
    });

    // Sort descending by total portions/score
    return list.sort((a, b) => b.totalPlates - a.totalPlates).slice(0, 3);
  }, [realtimeDonors]);

  const rankBadges = [
    { rank: '1st', medal: '🥇' },
    { rank: '2nd', medal: '🥈' },
    { rank: '3rd', medal: '🥉' },
  ];

  const renderDonorCards = () => (
    <>
      {topThreeDonors.map((donor, idx) => {
        const badge = rankBadges[idx] || rankBadges[0];
        return (
          <div
            key={`${donor.id}-${idx}`}
            onClick={onNavigateLeaderboard}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 mx-2.5 rounded-full bg-white dark:bg-[#142D21] border border-[#F3E8DC] dark:border-[#204E35] shadow-xs hover:border-[#E8672C] dark:hover:border-[#E8672C] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-1 font-bold text-xs">
              <span className="text-sm leading-none">{badge.medal}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-[#FEF3C7] dark:bg-[#2D2A18] text-[#92400E] dark:text-[#FCD34D] font-black">
                #{idx + 1}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#1A1714] dark:text-[#F2EDE4] group-hover:text-[#E8672C] dark:group-hover:text-[#E8672C] transition-colors">
                {donor.name}
              </span>
              <span className="text-[11px] text-[#78716C] dark:text-[#9CA3AF] hidden sm:inline">
                ({donor.orgName})
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold text-[#059669] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-[#064E3B]/40 px-2 py-0.5 rounded-full">
              <Heart className="w-3 h-3 text-[#E8672C] fill-[#E8672C]" />
              <span>
                {donor.totalPlates.toLocaleString()} meals ({donor.totalKg.toLocaleString()} kg)
              </span>
            </div>
          </div>
        );
      })}

      {/* Promotional Prompt for Other Donors */}
      <div
        onClick={onNavigateDonor || onNavigateLeaderboard}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 mx-2.5 rounded-full bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] dark:from-[#2A2315] dark:to-[#332515] border border-[#FDBA74] dark:border-[#92400E] shadow-xs cursor-pointer group"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#E8672C]" />
        <span className="text-xs font-bold text-[#9A3412] dark:text-[#FDBA74]">
          Spotlight your kitchen: Donate surplus meals to join India&apos;s Top 3!
        </span>
        <ArrowRight className="w-3 h-3 text-[#E8672C] group-hover:translate-x-0.5 transition-transform" />
      </div>
    </>
  );

  return (
    <section
      aria-label="Top Donors Live Ticker"
      className="relative w-full border-b border-[#EADFD5] dark:border-[#1E4D34] bg-[#FFFBF7] dark:bg-[#0D2017] overflow-hidden select-none py-2 z-10 transition-colors"
    >
      <div className="w-full flex items-center">
        {/* Fixed Title Label on the Left */}
        <div className="shrink-0 flex items-center gap-2 pl-3 sm:pl-5 pr-3 py-0.5 border-r border-[#EADFD5] dark:border-[#1E4D34] bg-[#FFFBF7] dark:bg-[#0D2017] z-20 shadow-[4px_0_10px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#E8672C]/10 text-[#E8672C]">
            <Trophy className="w-3.5 h-3.5 text-[#E8672C]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#E8672C]">
              Top Donors
            </span>
            <span className="text-[10px] text-[#78716C] dark:text-[#9CA3AF] hidden md:inline font-medium">
              Honor Roll
            </span>
          </div>
        </div>

        {/* Continuous Auto-Scrolling Track */}
        <div className="flex-1 overflow-hidden relative">
          <div className="foodlink-marquee-track flex items-center">
            {/* Set 1 */}
            <div className="flex items-center shrink-0">
              {renderDonorCards()}
            </div>
            {/* Set 2 (for smooth seamless infinite scroll) */}
            <div className="flex items-center shrink-0" aria-hidden="true">
              {renderDonorCards()}
            </div>
          </div>
        </div>

        {/* Fixed Quick Link on the Right */}
        {onNavigateLeaderboard && (
          <div className="shrink-0 hidden lg:flex items-center pr-4 sm:pr-6 pl-3 border-l border-[#EADFD5] dark:border-[#1E4D34] bg-[#FFFBF7] dark:bg-[#0D2017] z-20">
            <button
              type="button"
              onClick={onNavigateLeaderboard}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A1714] dark:text-[#F2EDE4] hover:text-[#E8672C] dark:hover:text-[#E8672C] transition-colors cursor-pointer"
            >
              <span>Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#E8672C]" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
