import React from 'react';
import { useTheme } from '../theme/ThemeContext';

interface TermsPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FOODLINK_DISCLAIMER_TEXT =
  'I understand FoodLink is a connecting platform only. It does not prepare, inspect, cook, store, or guarantee the safety of any food listed. I accept full responsibility for honestly completing the safety checklist and for checking the safety timestamp and any AI safety flag before donating or accepting food through this platform.';

export const TermsPolicyModal: React.FC<TermsPolicyModalProps> = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1715]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 shadow-2xl relative my-auto border max-h-[92vh] overflow-y-auto transition-colors ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#0E1715]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-4 pb-4 border-b ${
            isDark ? 'border-[#233833]' : 'border-[#DDE7E1]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#059669]/15 text-[#059669] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">policy</span>
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#059669]">
                Legal &amp; Safety Protocol
              </span>
              <h2
                className={`text-[22px] font-extrabold leading-snug ${
                  isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                }`}
              >
                Terms &amp; Safety Policy
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#1C2E2A] hover:bg-[#233833] text-[#F2F7F4]'
                : 'bg-[#DEEAE2] hover:bg-[#CFDED5] text-[#0E1715]'
            }`}
            type="button"
            aria-label="Close Terms & Policy Modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-5 mt-5 text-[14px] leading-relaxed">
          {/* Official Mandatory Platform Disclaimer Callout */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-2.5 ${
              isDark
                ? 'bg-[#3A281E]/40 border-[#059669]/50 text-[#F2F7F4]'
                : 'bg-[#FDF0E9] border-[#059669]/40 text-[#0E1715]'
            }`}
          >
            <div className="flex items-center gap-2 text-[#059669] font-extrabold text-[15px]">
              <span className="material-symbols-outlined text-[22px]">gavel</span>
              <span>Platform Safety &amp; Liability Disclaimer</span>
            </div>
            <p className="font-semibold italic text-[14.5px] leading-relaxed text-[#0E1715] dark:text-[#F2F7F4]">
              &ldquo;{FOODLINK_DISCLAIMER_TEXT}&rdquo;
            </p>
            <div className="text-[12px] opacity-80 pt-1 border-t border-[#059669]/20 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">verified</span>
              <span>
                Mandatory agreement required of all FoodLink Donors and Recipients prior to posting or claiming.
              </span>
            </div>
          </div>

          {/* Section 1: FoodLink Platform Role */}
          <div className="flex flex-col gap-2">
            <h3
              className={`text-[16px] font-extrabold flex items-center gap-2 ${
                isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
              }`}
            >
              <span className="material-symbols-outlined text-[#059669] text-[20px]">
                hub
              </span>
              <span>1. Neutral Technology Intermediary</span>
            </h3>
            <p className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
              FoodLink operates strictly as an open, real-time coordination platform connecting community food donors
              (restaurants, caterers, hotels, institutions) with verified nonprofit food recipients (shelters, pantries,
              soup kitchens). FoodLink is <strong>not</strong> a caterer, food handler, courier, or dining facility,
              and maintains zero physical custody of food items.
            </p>
          </div>

          {/* Section 2: Statutory Protections */}
          <div className="flex flex-col gap-2">
            <h3
              className={`text-[16px] font-extrabold flex items-center gap-2 ${
                isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
              }`}
            >
              <span className="material-symbols-outlined text-[#059669] text-[20px]">
                shield
              </span>
              <span>2. Good Samaritan Legal Protections</span>
            </h3>
            <p className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
              Food donations made in good faith through this utility are protected under the{' '}
              <strong>Bill Emerson Good Samaritan Food Donation Act (42 U.S. Code § 1791)</strong> and corresponding state
              and international charitable liability protection frameworks. Liability protection applies when donors donate
              apparently wholesome food without gross negligence or intentional misconduct.
            </p>
          </div>

          {/* Section 3: 4-Point Safety Protocol */}
          <div className="flex flex-col gap-2">
            <h3
              className={`text-[16px] font-extrabold flex items-center gap-2 ${
                isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
              }`}
            >
              <span className="material-symbols-outlined text-[#059669] text-[20px]">
                health_and_safety
              </span>
              <span>3. Donor 4-Point Food-Safety Self-Declaration</span>
            </h3>
            <p className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
              Every listing created on FoodLink requires donors to self-declare and confirm compliance with:
            </p>
            <ul
              className={`list-disc pl-5 space-y-1 text-[13px] ${
                isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
              }`}
            >
              <li>
                <strong>Temperature Integrity:</strong> Kept hot (&gt;60°C) or chilled (&lt;5°C) outside the danger zone.
              </li>
              <li>
                <strong>Freshness Guarantee:</strong> Prepared freshly within the same operating shift; never unserved customer scraps.
              </li>
              <li>
                <strong>Clean Packaging:</strong> Stored in food-grade, insulated, sealed containers preventing airborne contamination.
              </li>
              <li>
                <strong>Hygiene &amp; Allergens:</strong> Handled following commercial kitchen sanitation guidelines with major allergens declared.
              </li>
            </ul>
          </div>

          {/* Section 4: Safe Window & AI Inspection Disclaimer */}
          <div className="flex flex-col gap-2">
            <h3
              className={`text-[16px] font-extrabold flex items-center gap-2 ${
                isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
              }`}
            >
              <span className="material-symbols-outlined text-[#059669] text-[20px]">
                timer
              </span>
              <span>4. Safe Consumption Timers &amp; Gemini AI Assistance</span>
            </h3>
            <p className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
              FoodLink calculates a default 2-hour safe window from publication. Listings that exceed this safe duration
              are automatically transitioned to &ldquo;expired&rdquo;. Additionally, automated visual inspection powered by
              Gemini assists donors and recipients by identifying potential discoloration or unsealed packaging. AI
              assessments are supplementary aids and do <strong>not</strong> substitute for human sensory evaluation
              (smell, temperature, appearance) upon physical pickup.
            </p>
          </div>

          {/* Section 5: Recipient Verification & Override */}
          <div className="flex flex-col gap-2">
            <h3
              className={`text-[16px] font-extrabold flex items-center gap-2 ${
                isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
              }`}
            >
              <span className="material-symbols-outlined text-[#059669] text-[20px]">
                fact_check
              </span>
              <span>5. Recipient Inspection &amp; Override Rights</span>
            </h3>
            <p className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
              Recipients maintain the unconditional right to reject and report any food donation that does not meet visual
              or hygiene standards. In cases where recipients choose to accept a flagged or expired batch after on-site
              inspection, an explicit warning override is logged permanently in Firestore under the recipient&rsquo;s user ID.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`mt-6 pt-4 border-t flex items-center justify-between gap-3 ${
            isDark ? 'border-[#233833]' : 'border-[#DDE7E1]'
          }`}
        >
          <span className={`text-[12px] ${isDark ? 'text-[#7B9487]' : 'text-[#4D5C56]'}`}>
            Effective: March 2026 • FoodLink Public Utility
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#DC2626] text-white font-bold text-[14px] shadow-sm transition-all cursor-pointer"
          >
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
};
