import React, { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';

interface CookieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePreferences: (level: 'accepted' | 'essential') => void;
}

export const CookieModal: React.FC<CookieModalProps> = ({
  isOpen,
  onClose,
  onSavePreferences,
}) => {
  const { isDark } = useTheme();

  const [enableMapsCookies, setEnableMapsCookies] = useState(true);
  const [enableAnalytics, setEnableAnalytics] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1715]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto border max-h-[90vh] overflow-y-auto transition-colors ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#0E1715]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-4 pb-3 border-b ${
            isDark ? 'border-[#233833]' : 'border-[#DDE7E1]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">cookie</span>
            </div>
            <div>
              <h2 className="text-[18px] font-extrabold leading-snug">
                Cookie &amp; Privacy Preferences
              </h2>
              <p className={`text-[12px] ${isDark ? 'text-[#7B9487]' : 'text-[#4D5C56]'}`}>
                FoodLink India Privacy &amp; Data Transparency
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#1C2E2A] hover:bg-[#233833] text-[#F2F7F4]'
                : 'bg-[#DEEAE2] hover:bg-[#CFDED5] text-[#0E1715]'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 py-4 text-[13px]">
          <p className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
            We use cookies and browser local storage to provide real-time hyper-local food surplus dispatch, Google Maps Platform geolocation calculations, and authenticated user access.
          </p>

          {/* Essential Cookies */}
          <div
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
              isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <strong className={`text-[13.5px] ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                  Strictly Essential &amp; Auth Cookies
                </strong>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981]">
                  Always Active
                </span>
              </div>
              <p className={`text-[12px] mt-1 ${isDark ? 'text-[#7B9487]' : 'text-[#4D5C56]'}`}>
                Required for Firebase authentication, user security, OTP handoff generation, and basic site operation.
              </p>
            </div>
            <input
              type="checkbox"
              checked
              disabled
              className="w-4 h-4 rounded accent-[#059669] mt-1 cursor-not-allowed opacity-75"
            />
          </div>

          {/* Google Maps & Geolocation Cookies */}
          <div
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
              isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <strong className={`text-[13.5px] ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                  Google Maps Platform &amp; Geolocation
                </strong>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#059669]/15 text-[#059669]">
                  Recommended
                </span>
              </div>
              <p className={`text-[12px] mt-1 ${isDark ? 'text-[#7B9487]' : 'text-[#4D5C56]'}`}>
                Powers real-time map pin display, driving distance calculation to nearest recipient hubs, and route planning.
              </p>
            </div>
            <input
              type="checkbox"
              checked={enableMapsCookies}
              onChange={(e) => setEnableMapsCookies(e.target.checked)}
              className="w-4 h-4 rounded accent-[#059669] mt-1 cursor-pointer"
            />
          </div>

          {/* Anonymized Performance Telemetry */}
          <div
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
              isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <div>
              <strong className={`text-[13.5px] ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                Anonymized Impact Metrics
              </strong>
              <p className={`text-[12px] mt-1 ${isDark ? 'text-[#7B9487]' : 'text-[#4D5C56]'}`}>
                Helps calculate regional food diversion carbon offsets and CSR reports without collecting personal identifiers.
              </p>
            </div>
            <input
              type="checkbox"
              checked={enableAnalytics}
              onChange={(e) => setEnableAnalytics(e.target.value === 'true' || e.target.checked)}
              className="w-4 h-4 rounded accent-[#059669] mt-1 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => {
              onSavePreferences('essential');
              onClose();
            }}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-[12.5px] font-bold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#1C2E2A] border-[#233833] text-[#B8CCC1] hover:text-white'
                : 'bg-[#DEEAE2] border-[#CFDED5] text-[#4D5C56] hover:text-[#0E1715]'
            }`}
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => {
              onSavePreferences('accepted');
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#DC2626] text-white text-[12.5px] font-bold transition-all shadow-sm cursor-pointer"
          >
            Accept All Cookies
          </button>
        </div>
      </div>
    </div>
  );
};
