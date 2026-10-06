import React, { useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';

export const CookieNotice: React.FC = () => {
  const { isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const preference = localStorage.getItem('foodlink_cookie_preference');
    if (!preference) {
      // Delay showing slightly so it does not distract during initial render
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (type: 'all' | 'essential') => {
    localStorage.setItem('foodlink_cookie_preference', type);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className={`fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100vw-32px)] p-4 rounded-xl border shadow-lg transition-all ${
        isDark
          ? 'bg-[#064E3B] border-[#1E5C38] text-[#F0FDF8]'
          : 'bg-[#FFFFFF] border-[#E7E5E4] text-[#064E3B]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-[#059669] shrink-0 mt-0.5">
          cookie
        </span>
        <div className="flex-1 text-xs">
          <p className="font-semibold text-sm mb-1">We value your privacy</p>
          <p className={`leading-relaxed ${isDark ? 'text-[#D1DDD5]' : 'text-[#6B7280]'}`}>
            We use essential cookies to keep your session secure and optional cookies to improve food dispatch routing.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleChoice('all')}
              className="px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => handleChoice('essential')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#1E5C38] text-[#D1DDD5] hover:bg-[#134025]'
                  : 'border-[#E7E5E4] text-[#6B7280] hover:bg-[#D1FAE5] hover:text-[#064E3B]'
              }`}
            >
              Essential only
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
