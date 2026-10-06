import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Compass,
  Trophy,
  Inbox,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Thermometer,
  Truck,
  Building2,
  HeartHandshake,
} from 'lucide-react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface HeroSectionProps {
  onDonateFood: () => void;
  onBrowseMeals?: () => void;
  onViewLeaderboard: () => void;
  onViewRequests?: () => void;
  onViewVerify?: () => void;
  onClaimOrRegister?: () => void;
  isLoggedIn?: boolean;
  t: (key: string, fallback: string) => string;
}

interface ActiveListingCardData {
  title: string;
  quantity: string;
  meals: string;
  kg: string;
  timeLeft: string;
  percentLeft: number;
  donorName: string;
  recipientName: string;
  status: string;
}

export function HeroSection({
  onDonateFood,
  onBrowseMeals,
  onViewLeaderboard,
  onViewRequests,
  onViewVerify,
  onClaimOrRegister,
  isLoggedIn,
  t,
}: HeroSectionProps) {
  // Live or fallback data for "Current Pickup Window" card
  const [liveListing, setLiveListing] = useState<ActiveListingCardData>({
    title: 'Prepared Biryani & Dal Makhani',
    quantity: '85 Portions',
    meals: '85 meals',
    kg: '42.5 kg batch',
    timeLeft: '28:24 left of 45m window',
    percentLeft: 63,
    donorName: 'Grand Banquet Hall, Andheri',
    recipientName: 'Hope Community Shelter, Bandra',
    status: 'Courier En Route',
  });

  // Real-time Firestore listener for live listing
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'listings'),
        where('status', 'in', ['claimed', 'in_transit', 'available']),
        limit(1)
      );
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const docData = snap.docs[0].data();
            const portions = docData.quantity || 75;
            const approxKg = docData.kg || Math.round(portions * 0.5);
            setLiveListing({
              title: docData.title || 'Fresh Cooked Meals',
              quantity: `${portions} Portions`,
              meals: `${portions} meals`,
              kg: `${approxKg} kg batch`,
              timeLeft: '28:24 left of 45m window',
              percentLeft: 63,
              donorName: docData.location || 'Grand Commercial Kitchen, Mumbai',
              recipientName: docData.claimedByName || 'Verified Community Shelter',
              status: docData.status === 'in_transit' ? 'Courier En Route' : 'Ready for Transit',
            });
          }
        },
        () => {
          // Fall back gracefully to preset demo data on permission/connection exceptions
        }
      );
      return () => unsubscribe();
    } catch {
      // Local development fallback
    }
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#F6F8F5] dark:bg-[#0E1A14] pt-8 sm:pt-12 md:pt-16 pb-12 sm:pb-16 lg:pb-20 border-b border-[#E3E8E2] dark:border-[#234233]">
      <div className="site-container">
        {/* Two-Column Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* ================= LEFT COLUMN ================= */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Small uppercase eyebrow with wide letter-spacing */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#0B8F5F] animate-pulse" />
              <span className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase text-[#0B8F5F] dark:text-[#10A771]">
                DIRECT SURPLUS FOOD RESCUE · INDIA
              </span>
            </div>

            {/* Large Serif Headline */}
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-[#10231A] dark:text-[#F4F7F5] leading-[1.15] tracking-tight mb-5">
              Bridging surplus commercial kitchens with verified community shelters.
            </h1>

            {/* Natural English Paragraph */}
            <p className="text-base sm:text-lg text-[#5B6B62] dark:text-[#9AA7A0] leading-relaxed mb-8 max-w-[62ch]">
              Surplus meals from banquet halls, catering hubs and institutional dining are lost to landfills.
              FoodLink orchestrates direct, temperature-verified surplus handoffs to nearby shelters, orphanages
              and community kitchens in under 45 minutes.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 mb-10">
              {/* Primary: Solid Green #0B8F5F, White Text, Rounded-XL, Arrow Icon */}
              <button
                type="button"
                onClick={onDonateFood}
                className="px-6 py-3.5 rounded-xl bg-[#0B8F5F] hover:bg-[#09774F] text-white font-semibold text-sm sm:text-base flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow group min-h-[46px]"
              >
                <span>Donate Surplus Food</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              {/* Secondary: White with Border, Compass Icon */}
              <button
                type="button"
                onClick={onBrowseMeals || onClaimOrRegister || (() => {})}
                className="px-6 py-3.5 rounded-xl bg-white dark:bg-[#14261D] border border-[#E3E8E2] dark:border-[#234233] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] text-[#10231A] dark:text-[#F4F7F5] font-semibold text-sm sm:text-base flex items-center gap-2 transition-all cursor-pointer shadow-xs min-h-[46px]"
              >
                <Compass className="w-4 h-4 text-[#0B8F5F]" />
                <span>Browse Available Meals</span>
              </button>
            </div>

            {/* Three Quick Links with Icons */}
            <div className="pt-6 border-t border-[#E3E8E2] dark:border-[#234233] flex flex-wrap items-center gap-6 sm:gap-8 text-xs sm:text-sm font-semibold text-[#5B6B62] dark:text-[#9AA7A0]">
              <button
                type="button"
                onClick={onViewLeaderboard}
                className="flex items-center gap-2 hover:text-[#0B8F5F] transition-colors cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-[#F28C1B]" />
                <span>Donation Leaderboard</span>
              </button>

              <button
                type="button"
                onClick={onViewRequests || (() => {})}
                className="flex items-center gap-2 hover:text-[#0B8F5F] transition-colors cursor-pointer"
              >
                <Inbox className="w-4 h-4 text-[#0B8F5F]" />
                <span>NGO Meal Requests</span>
              </button>

              <button
                type="button"
                onClick={onViewVerify || (() => {})}
                className="flex items-center gap-2 hover:text-[#0B8F5F] transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#0B8F5F]" />
                <span>Charity Verification</span>
              </button>
            </div>
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="lg:col-span-5 space-y-5 lg:pl-2">
            {/* 1. "Live Rescue Dispatch" card */}
            <div className="bg-white dark:bg-[#14261D] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#E3E8E2] dark:border-[#234233] shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#10231A] dark:text-[#F4F7F5]">
                  Live Rescue Dispatch
                </h3>
                <span className="w-2 h-2 rounded-full bg-[#0B8F5F] animate-ping" />
              </div>
              <p className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] mb-5">
                Active across Indian metro hubs
              </p>

              {/* 3 Numbered Steps */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#EAF3EC] dark:bg-[#1B3327] text-[#0B8F5F] dark:text-[#10A771] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#10231A] dark:text-[#F4F7F5]">
                      Kitchens Log Surplus
                    </h4>
                    <p className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] mt-0.5">
                      Hot prepared meals or cold batches posted with safe consumption window.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#EAF3EC] dark:bg-[#1B3327] text-[#0B8F5F] dark:text-[#10A771] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#10231A] dark:text-[#F4F7F5]">
                      Volunteer Couriers Transit
                    </h4>
                    <p className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] mt-0.5">
                      NGO volunteers verify food temperature at pickup and drop-off in insulated crates.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#EAF3EC] dark:bg-[#1B3327] text-[#0B8F5F] dark:text-[#10A771] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-[#10231A] dark:text-[#F4F7F5]">
                        Shelters Feed People
                      </h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#EAF3EC] text-[#0B8F5F] dark:bg-[#1B3327] dark:text-[#10A771] border border-[#D1E2D7] dark:border-[#234233]">
                        Verified NGOs
                      </span>
                    </div>
                    <p className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] mt-0.5">
                      Secure OTP verification ensures immediate distribution to awaiting residents.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. "Current Pickup Window" live card */}
            <div className="bg-white dark:bg-[#14261D] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#E3E8E2] dark:border-[#234233] shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#5B6B62] dark:text-[#9AA7A0]">
                    Current Pickup Window
                  </span>
                  <h4 className="font-serif font-bold text-base text-[#10231A] dark:text-[#F4F7F5] mt-0.5 line-clamp-1">
                    {liveListing.title}
                  </h4>
                  <p className="text-xs text-[#5B6B62] dark:text-[#9AA7A0]">
                    {liveListing.quantity}
                  </p>
                </div>

                {/* Circular Countdown Ring */}
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  <svg className="w-12 h-12 -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="19"
                      stroke="#E3E8E2"
                      strokeWidth="3.5"
                      fill="none"
                      className="dark:stroke-[#234233]"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="19"
                      stroke="#0B8F5F"
                      strokeWidth="3.5"
                      strokeDasharray={2 * Math.PI * 19}
                      strokeDashoffset={2 * Math.PI * 19 * (1 - liveListing.percentLeft / 100)}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute text-[10px] font-bold text-[#10231A] dark:text-[#F4F7F5]">
                    {liveListing.percentLeft}%
                  </span>
                </div>
              </div>

              {/* Monospace Countdown Line with "Thermal Safe" Chip */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F6F8F5] dark:bg-[#0E1A14] border border-[#E3E8E2] dark:border-[#234233] mb-3.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#0B8F5F]" />
                  <span className="font-mono text-xs font-semibold text-[#10231A] dark:text-[#F4F7F5]">
                    {liveListing.timeLeft}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF3EC] text-[#0B8F5F] dark:bg-[#1B3327] dark:text-[#10A771] border border-[#D1E2D7] dark:border-[#234233]">
                  <Thermometer className="w-3 h-3" />
                  Thermal Safe
                </span>
              </div>

              {/* Route: Donor -> Recipient */}
              <div className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] space-y-1 mb-4">
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-[#5B6B62] shrink-0" />
                  <span className="truncate">{liveListing.donorName}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate pl-4">
                  <span className="text-[#0B8F5F]">↓</span>
                  <span className="truncate font-medium text-[#10231A] dark:text-[#F4F7F5]">
                    {liveListing.recipientName}
                  </span>
                </div>
              </div>

              {/* Footer: kg batch, meals count, orange status chip */}
              <div className="pt-3 border-t border-[#E3E8E2] dark:border-[#234233] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#5B6B62] dark:text-[#9AA7A0]">
                  <span className="font-semibold text-[#10231A] dark:text-[#F4F7F5]">{liveListing.kg}</span>
                  <span>·</span>
                  <span>{liveListing.meals}</span>
                </div>

                {/* Saffron Orange Status Chip */}
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FFF7ED] text-[#F28C1B] border border-[#F28C1B]/30 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-[#F28C1B]" />
                  <span>{liveListing.status}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
