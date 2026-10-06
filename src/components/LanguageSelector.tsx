import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, SUPPORTED_LANGUAGES, SupportedLanguage, syncGoogleTranslate } from '../lib/i18n';
import { useTheme } from '../theme/ThemeContext';

export interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
  onLanguageSelected?: (lang: SupportedLanguage) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  compact = false,
  className = '',
  onLanguageSelected,
}) => {
  const { language, setLanguage } = useLanguage();
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [justChanged, setJustChanged] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking or touching outside
  useEffect(() => {
    const handleOutsideInteraction = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideInteraction);
      document.addEventListener('touchstart', handleOutsideInteraction);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
    };
  }, [isOpen]);

  const currentOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
    const chosen = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    setJustChanged(chosen ? chosen.nativeName : code);
    setTimeout(() => setJustChanged(null), 2500);
    if (onLanguageSelected) {
      onLanguageSelected(code);
    }
    syncGoogleTranslate(code);
  };

  return (
    <div className={`relative inline-block notranslate ${className}`} translate="no" ref={dropdownRef}>
      {/* Trigger Button */}
      {compact ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title={`Change Language / भाषा बदलें (${currentOption.nativeName})`}
          aria-label={`Select language. Currently selected: ${currentOption.name}`}
          className={`w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-all cursor-pointer relative shadow-xs ${
            isDark
              ? 'border-[#234233] bg-[#14261D] text-[#10A771] hover:bg-[#1B3327]'
              : 'border-[#E3E8E2] bg-white text-[#0B8F5F] hover:bg-[#EAF3EC]'
          }`}
        >
          <span className="text-xs font-bold uppercase">{currentOption.code}</span>
          <span className="absolute -bottom-1 -right-1 text-[9px] font-black px-1 rounded-sm bg-[#0B8F5F] text-white shadow-xs leading-tight">
            IN
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title="Change language / भाषा चुनें"
          aria-label={`Select language. Currently selected: ${currentOption.name}`}
          className={`h-11 px-3 rounded-xl flex items-center gap-2 font-medium text-xs transition-colors cursor-pointer border shadow-xs min-h-[44px] ${
            isDark
              ? 'bg-[#14261D] hover:bg-[#1B3327] text-[#F4F7F5] border-[#234233]'
              : 'bg-white hover:bg-[#EAF3EC] text-[#10231A] border-[#E3E8E2]'
          }`}
        >
          <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-[#EAF3EC] text-[#0B8F5F] dark:bg-[#1B3327] dark:text-[#10A771] border border-[#D1E2D7] dark:border-[#234233]">
            IN
          </span>
          <span className="font-medium text-[13px]">{currentOption.nativeName}</span>
          <span className="text-xs opacity-60">▼</span>
        </button>
      )}

      {/* Floating feedback toast */}
      {justChanged && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xl whitespace-nowrap z-[10000] flex items-center gap-1 animate-in fade-in zoom-in-95">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{justChanged}</span>
        </div>
      )}

      {/* Dropdown Menu (Pop-over modal for high visibility) */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 bg-black/25 z-[9998] md:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`fixed md:absolute right-4 md:right-0 top-16 md:top-full mt-2 w-64 md:w-56 rounded-2xl shadow-2xl border z-[9999] py-2 overflow-hidden animate-in fade-in zoom-in-95 ${isDark
                ? 'bg-[#14211E] border-[#233833] text-[#F2F7F4]'
                : 'bg-white border-[#CFDED5] text-[#111A17]'
              }`}
          >
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-100 dark:border-[#233833] flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">language</span>
                <span>Select Language</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Language Options List */}
            <div className="py-1 max-h-72 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === language;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full px-4 py-2.5 text-left text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer min-h-[44px] ${isSelected
                        ? 'bg-emerald-600 text-white font-bold'
                        : isDark
                          ? 'hover:bg-[#1C2E2A] text-gray-200'
                          : 'hover:bg-emerald-50 text-gray-800'
                      }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[14px] leading-tight">{lang.nativeName}</span>
                      <span
                        className={`text-[11px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-400'
                          }`}
                      >
                        {lang.name}
                      </span>
                    </div>

                    {isSelected && (
                      <span className="material-symbols-outlined text-[18px] text-white">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
