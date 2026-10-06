import React, { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import {
  Award,
  Share2,
  Download,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Copy,
  X,
  Flame,
  Zap,
  ShieldCheck,
  Moon,
} from 'lucide-react';
import { encodeQrCode, matrixToSvg } from '../lib/qrCode';

export interface VolunteerImpactBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate: string;
  color: string;
}

export interface VolunteerPassData {
  volunteerName: string;
  volunteerId: string;
  passSerialNumber: string;
  joinedDate: string;
  completedRuns: number;
  totalKgRescued: number;
  totalMealsRelieved: number;
  co2SavedKg: number;
  tierTitle: string;
  badges: VolunteerImpactBadge[];
}

interface VolunteerImpactPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  passData?: Partial<VolunteerPassData>;
}

export const VolunteerImpactPassModal: React.FC<VolunteerImpactPassModalProps> = ({
  isOpen,
  onClose,
  passData,
}) => {
  const { isDark } = useTheme();
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'pass' | 'badges' | 'linkedin'>('pass');

  if (!isOpen) return null;

  const effectiveData: VolunteerPassData = {
    volunteerName: passData?.volunteerName || 'Rahul Verma',
    volunteerId: passData?.volunteerId || 'VOL-MUM-8842',
    passSerialNumber: passData?.passSerialNumber || 'FL-PASS-2026-90412',
    joinedDate: passData?.joinedDate || 'October 2025',
    completedRuns: passData?.completedRuns || 18,
    totalKgRescued: passData?.totalKgRescued || 420,
    totalMealsRelieved: passData?.totalMealsRelieved || 1050,
    co2SavedKg: passData?.co2SavedKg || 1029,
    tierTitle: passData?.tierTitle || 'Tier 3 Golden Courier & Zero Waste Champion',
    badges: passData?.badges || [
      {
        id: 'century',
        name: '100kg Rescued',
        description: 'Successfully transported and rescued over 100 kg of fresh edible food.',
        icon: 'trophy',
        earnedDate: 'Nov 2025',
        color: '#059669',
      },
      {
        id: 'night_owl',
        name: 'Night Owl Rescuer',
        description: 'Completed 5+ late-night surplus rescues after 10 PM banquet closings.',
        icon: 'nightlight',
        earnedDate: 'Dec 2025',
        color: '#6366F1',
      },
      {
        id: 'zero_waste',
        name: 'Zero Waste Champion',
        description: 'Diverted > 400 kg organic waste from landfills, saving > 1 Tonne CO2.',
        icon: 'recycling',
        earnedDate: 'Jan 2026',
        color: '#10B981',
      },
      {
        id: 'rapid_responder',
        name: 'Rapid Responder',
        description: 'Claimed and picked up emergency surplus batch in under 20 minutes.',
        icon: 'bolt',
        earnedDate: 'Feb 2026',
        color: '#F59E0B',
      },
      {
        id: 'thermal_guard',
        name: 'Thermal Guard',
        description: '100% adherence to FSSAI temperature holding and food-grade insulated transport.',
        icon: 'ac_unit',
        earnedDate: 'Mar 2026',
        color: '#0EA5E9',
      },
      {
        id: 'handshake_master',
        name: 'Tamper-Proof Master',
        description: 'Completed 15+ dual-party cryptographic QR handshakes with 0 disputes.',
        icon: 'qr_code_scanner',
        earnedDate: 'Apr 2026',
        color: '#8B5CF6',
      },
    ],
  };

  const verificationUrl = `https://foodlink.org/verify/volunteer/${effectiveData.passSerialNumber}`;

  // Generate verification QR SVG
  const qrSvg = (() => {
    try {
      const matrix = encodeQrCode(verificationUrl, 'M');
      return matrixToSvg(matrix, { size: 100, color: '#059669', bgColor: '#FFFFFF', margin: 2 });
    } catch {
      return '';
    }
  })();

  const handleCopyVerification = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleAddToLinkedIn = () => {
    // Official LinkedIn Add to Profile certification deep link
    const certName = encodeURIComponent('FoodLink Certified Surplus Food Rescue Courier');
    const orgName = encodeURIComponent('FoodLink India (Surplus Food Rescue Network)');
    const issueYear = '2026';
    const issueMonth = '10';
    const certUrl = encodeURIComponent(verificationUrl);
    const certId = encodeURIComponent(effectiveData.passSerialNumber);

    const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${certName}&organizationName=${orgName}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${certUrl}&certId=${certId}`;

    window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
      <div
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl transition-all overflow-hidden my-6 ${
          isDark ? 'bg-[#101B18] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
        }`}
      >
        {/* Top Header */}
        <div className="p-6 border-b border-[#CFDED5]/50 dark:border-[#233833] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#059669]/15 text-[#059669] flex items-center justify-center border border-[#059669]/30">
              <Award className="w-5 h-5 text-[#059669]" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Verified Volunteer Impact Pass</h2>
              <p className={`text-xs ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
                Digital Credential &amp; Social Certification ID: {effectiveData.passSerialNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 flex gap-2 border-b border-[#CFDED5]/40 dark:border-[#233833]">
          <button
            type="button"
            onClick={() => setActiveTab('pass')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'pass'
                ? 'border-[#059669] text-[#059669]'
                : 'border-transparent text-[#64748B] hover:text-[#111A17] dark:hover:text-white'
            }`}
          >
            Digital Pass Card
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('badges')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'badges'
                ? 'border-[#059669] text-[#059669]'
                : 'border-transparent text-[#64748B] hover:text-[#111A17] dark:hover:text-white'
            }`}
          >
            Badges Earned ({effectiveData.badges.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('linkedin')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'linkedin'
                ? 'border-[#059669] text-[#059669]'
                : 'border-transparent text-[#64748B] hover:text-[#111A17] dark:hover:text-white'
            }`}
          >
            LinkedIn &amp; Social Share
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: DIGITAL PASS CARD */}
          {activeTab === 'pass' && (
            <div className="space-y-6">
              {/* Luxury Apple-Wallet Style Impact Pass Card */}
              <div
                id="volunteer-impact-pass-card"
                className="relative rounded-3xl p-6 sm:p-7 text-white shadow-xl overflow-hidden border border-emerald-400/30"
                style={{
                  background: 'linear-gradient(135deg, #064E3B 0%, #065F46 45%, #047857 85%, #059669 100%)',
                }}
              >
                {/* Background decorative watermark */}
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 rounded-full bg-black/10 pointer-events-none" />

                {/* Card Top Row */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌿</span>
                    <div>
                      <span className="text-sm font-black tracking-wider uppercase block">FoodLink India</span>
                      <span className="text-[10px] text-emerald-200 uppercase tracking-widest font-semibold block">
                        Official Volunteer Pass
                      </span>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-black uppercase tracking-wider border border-white/20 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Verified Courier</span>
                  </div>
                </div>

                {/* Volunteer Identity & Tier */}
                <div className="mb-6">
                  <h3 className="text-2xl font-black tracking-tight">{effectiveData.volunteerName}</h3>
                  <p className="text-xs text-emerald-200 font-semibold mt-0.5">{effectiveData.tierTitle}</p>
                </div>

                {/* Core Stats Grid */}
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 mb-6">
                  <div>
                    <span className="text-[10px] text-emerald-200 block uppercase font-bold">Food Rescued</span>
                    <span className="text-lg font-black text-white">{effectiveData.totalKgRescued} kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-200 block uppercase font-bold">Meals Delivered</span>
                    <span className="text-lg font-black text-white">{effectiveData.totalMealsRelieved}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-200 block uppercase font-bold">CO2 Avoided</span>
                    <span className="text-lg font-black text-white">{effectiveData.co2SavedKg} kg</span>
                  </div>
                </div>

                {/* Pass Footer with QR and Serial */}
                <div className="flex items-center justify-between pt-3 border-t border-white/15">
                  <div>
                    <span className="text-[9px] text-emerald-200 block uppercase font-bold">Serial Number</span>
                    <span className="text-xs font-mono font-black tracking-wider">{effectiveData.passSerialNumber}</span>
                    <span className="text-[10px] text-emerald-300 block mt-0.5">Active since {effectiveData.joinedDate}</span>
                  </div>

                  {qrSvg && (
                    <div
                      className="p-1.5 rounded-xl bg-white shadow-md cursor-pointer"
                      title="Scan to verify credential"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  )}
                </div>
              </div>

              {/* Action Buttons Below Pass */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyVerification}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 cursor-pointer transition-all ${
                    copiedLink
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : isDark
                      ? 'bg-[#162421] border-[#233833] text-[#B8CCC1] hover:text-white'
                      : 'bg-white border-[#CFDED5] text-[#4D5C56] hover:text-[#111A17]'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Verification URL Copied!' : 'Copy Verification Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddToLinkedIn}
                  className="px-5 py-2.5 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Add to LinkedIn Profile</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BADGES EARNED */}
          {activeTab === 'badges' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className={`text-xs ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
                  Badges are unlocked automatically upon completing verifiable rescue milestones.
                </p>
                <span className="text-xs font-bold text-[#059669]">{effectiveData.badges.length} of 6 Unlocked</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {effectiveData.badges.map((b) => (
                  <div
                    key={b.id}
                    className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all ${
                      isDark ? 'bg-[#162421] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-lg"
                      style={{ backgroundColor: b.color }}
                    >
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-sm font-black">{b.name}</h4>
                        <span className="text-[10px] text-emerald-600 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10">
                          {b.earnedDate}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
                        {b.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: LINKEDIN & SOCIAL SHARE */}
          {activeTab === 'linkedin' && (
            <div className="space-y-5">
              <div
                className={`p-5 rounded-2xl border ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F0FDF8] border-[#A7F3D0]'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center font-bold text-xs">
                    in
                  </div>
                  <div>
                    <h4 className="text-sm font-black">Official LinkedIn 1-Click Credential</h4>
                    <p className={`text-xs ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
                      Pre-fills Certificate Name, Issuing Organization, Issue Date, and Verification ID.
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs space-y-1.5 font-mono">
                  <div>
                    <span className="text-slate-400">Certification: </span>
                    <strong className="text-[#059669]">FoodLink Certified Surplus Food Rescue Courier</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Issuing Org: </span>
                    <span>FoodLink India (National Surplus Food Rescue Network)</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Credential ID: </span>
                    <span>{effectiveData.passSerialNumber}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleAddToLinkedIn}
                    className="w-full py-3 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open LinkedIn &amp; Add to Licenses &amp; Certifications</span>
                  </button>
                </div>
              </div>

              {/* Shareable Post Copy */}
              <div
                className={`p-5 rounded-2xl border ${
                  isDark ? 'bg-[#162421] border-[#233833]' : 'bg-white border-[#CFDED5]'
                }`}
              >
                <h4 className="text-sm font-black mb-1">Pre-formatted Post for LinkedIn / Instagram</h4>
                <p className={`text-xs mb-3 ${isDark ? 'text-[#8EA89D]' : 'text-[#64748B]'}`}>
                  Copy and share to inspire fellow students and young professionals to rescue surplus food:
                </p>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans select-all">
                  Proud to hold a verified FoodLink Impact Pass! 🌿 So far, I have completed {effectiveData.completedRuns} surplus food rescue runs, saving {effectiveData.totalKgRescued} kg of quality edible food (~{effectiveData.totalMealsRelieved} meals) and preventing {effectiveData.co2SavedKg} kg of CO2 emissions from entering landfills. Every surplus banquet meal rescued is a meal served to someone in need. Join as a volunteer courier: https://foodlink.org #FoodRescue #ZeroWaste #Sustainability #SEBI #CSR #India
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      const text = `Proud to hold a verified FoodLink Impact Pass! 🌿 So far, I have completed ${effectiveData.completedRuns} surplus food rescue runs, saving ${effectiveData.totalKgRescued} kg of quality edible food (~${effectiveData.totalMealsRelieved} meals) and preventing ${effectiveData.co2SavedKg} kg of CO2 emissions from entering landfills. Every surplus banquet meal rescued is a meal served to someone in need. Join as a volunteer courier: https://foodlink.org #FoodRescue #ZeroWaste #Sustainability #SEBI #CSR #India`;
                      await navigator.clipboard.writeText(text);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
