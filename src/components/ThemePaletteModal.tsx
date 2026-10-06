import React from 'react';
import { useTheme } from '../theme/ThemeContext';

export interface PaletteDefinition {
  id: 'current' | 'forest_gold' | 'ocean_teal' | 'navy_marigold' | 'crimson_terracotta';
  title: string;
  subtitle: string;
  themeType: string;
  primaryColor: string;
  secondaryColor: string;
  darkCanvas: string;
  darkSurface: string;
  darkBorder: string;
  lightCanvas: string;
  lightBorder: string;
  description: string;
  previewCardClass: string;
}

export const PALETTES: PaletteDefinition[] = [
  {
    id: 'current',
    title: 'Baseline: Warm Amber & Forest Teal',
    subtitle: 'Warm Harvest Palette',
    themeType: 'Harvest Amber & Stone',
    primaryColor: '#059669',
    secondaryColor: '#0F766E',
    darkCanvas: '#071A12',
    darkSurface: '#064E3B',
    darkBorder: '#1E5C38',
    lightCanvas: '#F0FDF8',
    lightBorder: '#E7E5E4',
    description: 'Energetic warm harvest amber with warm stone neutrals and trust teal verified indicators.',
    previewCardClass: 'border-[#059669]/40',
  },
  {
    id: 'forest_gold',
    title: 'Option 1: Warm Harvest & Forest Teal (Active Default)',
    subtitle: 'Nourishment & Community Food Rescue',
    themeType: 'Warm Harvest (Active)',
    primaryColor: '#059669',
    secondaryColor: '#0F766E',
    darkCanvas: '#071A12',
    darkSurface: '#064E3B',
    darkBorder: '#1E5C38',
    lightCanvas: '#F0FDF8',
    lightBorder: '#E7E5E4',
    description: 'Inviting harvest amber and cream canvas paired with trust teal verified tags, urgent coral countdowns, and dark charcoal warm surfaces.',
    previewCardClass: 'border-[#059669]/40',
  },
  {
    id: 'ocean_teal',
    title: 'Option 2: Deep Ocean Teal & Warm Coral',
    subtitle: 'Civic Tech & Rapid Logistics',
    themeType: 'Modern Utility',
    primaryColor: '#0D9488',
    secondaryColor: '#F97316',
    darkCanvas: '#0F172A',
    darkSurface: '#1E293B',
    darkBorder: '#334155',
    lightCanvas: '#F8FAFC',
    lightBorder: '#CBD5E1',
    description: 'Contemporary tech feel with midnight blue canvas, glowing teal branding, and high-visibility coral dispatch buttons.',
    previewCardClass: 'border-[#0D9488]/40',
  },
  {
    id: 'navy_marigold',
    title: 'Option 3: Royal Ink Navy & Radiant Marigold',
    subtitle: 'Institutional Trust & CSR Dignity',
    themeType: 'National Initiative',
    primaryColor: '#F59E0B',
    secondaryColor: '#2563EB',
    darkCanvas: '#0A0F1D',
    darkSurface: '#111827',
    darkBorder: '#1F2937',
    lightCanvas: '#F9FAFB',
    lightBorder: '#E5E7EB',
    description: 'Prestigious corporate CSR look: deep obsidian navy background, golden marigold action badges, and crisp silver cards.',
    previewCardClass: 'border-[#F59E0B]/40',
  },
  {
    id: 'crimson_terracotta',
    title: 'Option 4: Terracotta Crimson & Warm Ivory',
    subtitle: 'Hospitality & Traditional Banquet Food',
    themeType: 'Warm Culinary',
    primaryColor: '#C2410C',
    secondaryColor: '#15803D',
    darkCanvas: '#171311',
    darkSurface: '#231E1B',
    darkBorder: '#382E28',
    lightCanvas: '#F2F7F4',
    lightBorder: '#E5DFD5',
    description: 'Rich espresso charcoal background paired with deep Indian terracotta orange and soothing warm ivory parchment surfaces.',
    previewCardClass: 'border-[#C2410C]/40',
  },
];

interface ThemePaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPaletteId: string;
  onSelectPalette: (paletteId: string) => void;
}

export const ThemePaletteModal: React.FC<ThemePaletteModalProps> = ({
  isOpen,
  onClose,
  selectedPaletteId,
  onSelectPalette,
}) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1715]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-4xl rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto border max-h-[92vh] overflow-y-auto transition-colors ${
          isDark
            ? 'bg-[#0E1715] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#0E1715]'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#CFDED5]/60 dark:border-[#233833]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#059669]/15 text-[#059669] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">palette</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#059669]">
                  Visual Theme Direction
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#059669]/15 text-[#059669]">
                  4 Custom Palettes
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight mt-0.5">
                Compare Visual Color Schemes
              </h2>
              <p className={`text-[13px] mt-0.5 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                Click any option to inspect live UI samples and swatches before selecting your preferred scheme.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 cursor-pointer ${
              isDark
                ? 'bg-[#162421] hover:bg-[#1C2E2A] text-[#F2F7F4]'
                : 'bg-[#F0ECE6] hover:bg-[#E5DFD5] text-[#0E1715]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 4 Palette Option Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          {PALETTES.map((pal) => {
            const isSelected = selectedPaletteId === pal.id;

            return (
              <div
                key={pal.id}
                className={`rounded-2xl p-5 border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'border-[#059669] ring-2 ring-[#059669]/30 shadow-lg'
                    : isDark
                    ? 'bg-[#162421] border-[#233833] hover:border-[#059669]/50'
                    : 'bg-[#EBF2ED] border-[#CFDED5] hover:border-[#059669]/50'
                }`}
              >
                {/* Active Indicator Chip */}
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-[#059669] text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    <span>Active In App</span>
                  </div>
                )}

                <div>
                  {/* Title & Tag */}
                  <span
                    className="text-[10px] font-black uppercase tracking-widest block mb-1"
                    style={{ color: pal.primaryColor }}
                  >
                    {pal.themeType}
                  </span>
                  <h3 className="text-[17px] font-black tracking-tight mb-1 pr-16">
                    {pal.title}
                  </h3>
                  <p className={`text-[12px] leading-relaxed mb-4 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                    {pal.description}
                  </p>

                  {/* High-Fidelity Mini UI Preview Card */}
                  <div
                    className="rounded-xl p-3.5 border shadow-inner mb-4 flex flex-col gap-2.5"
                    style={{
                      backgroundColor: isDark ? pal.darkSurface : '#FFFFFF',
                      borderColor: isDark ? pal.darkBorder : pal.lightBorder,
                    }}
                  >
                    {/* Mock Nav Bar */}
                    <div
                      className="px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px]"
                      style={{
                        backgroundColor: isDark ? pal.darkCanvas : pal.lightCanvas,
                        color: isDark ? '#FFFFFF' : '#0E1715',
                      }}
                    >
                      <div className="flex items-center gap-1.5 font-black">
                        <span
                          className="w-5 h-5 rounded-md text-white flex items-center justify-center text-[10px]"
                          style={{ backgroundColor: pal.primaryColor }}
                        >
                          FL
                        </span>
                        <span>FoodLink</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span
                          className="px-2 py-0.5 rounded-md text-white font-bold"
                          style={{ backgroundColor: pal.primaryColor }}
                        >
                          Get Started
                        </span>
                      </div>
                    </div>

                    {/* Mock Live Rescue Card */}
                    <div
                      className="p-2.5 rounded-lg border flex items-center justify-between text-[11px]"
                      style={{
                        backgroundColor: isDark ? pal.darkCanvas : '#FFFFFF',
                        borderColor: isDark ? pal.darkBorder : pal.lightBorder,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: pal.secondaryColor }}
                        >
                          <span className="material-symbols-outlined text-[16px]">restaurant</span>
                        </div>
                        <div>
                          <span className="font-extrabold block text-[12px]">Grand Banquet Surplus</span>
                          <span className="text-[10px] text-opacity-70" style={{ color: isDark ? '#B8CCC1' : '#4D5C56' }}>
                            180 Servings • 2h 45m left
                          </span>
                        </div>
                      </div>

                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-black"
                        style={{
                          backgroundColor: `${pal.secondaryColor}25`,
                          color: pal.secondaryColor,
                        }}
                      >
                        ● Verified
                      </span>
                    </div>

                    {/* Mock Primary CTA Button */}
                    <button
                      type="button"
                      className="w-full py-2 rounded-lg text-white font-black text-[12px] flex items-center justify-center gap-1 shadow-2xs pointer-events-none"
                      style={{ backgroundColor: pal.primaryColor }}
                    >
                      <span className="material-symbols-outlined text-[15px]">bolt</span>
                      <span>Claim or Deliver Surplus</span>
                    </button>
                  </div>

                  {/* Color Swatches Strip */}
                  <div className="flex items-center gap-2.5 pt-1 mb-4 text-[11px]">
                    <span className={`font-bold text-[10px] uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#827A72]'}`}>
                      Swatches:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: pal.primaryColor }}
                        title={`Primary Accent: ${pal.primaryColor}`}
                      />
                      <div
                        className="w-6 h-6 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: pal.secondaryColor }}
                        title={`Secondary / Status: ${pal.secondaryColor}`}
                      />
                      <div
                        className="w-6 h-6 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: isDark ? pal.darkCanvas : pal.lightCanvas }}
                        title={`Canvas Neutral: ${isDark ? pal.darkCanvas : pal.lightCanvas}`}
                      />
                      <div
                        className="w-6 h-6 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: isDark ? pal.darkSurface : '#FFFFFF' }}
                        title={`Surface Card: ${isDark ? pal.darkSurface : '#FFFFFF'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Select Palette Action Button */}
                <button
                  type="button"
                  onClick={() => onSelectPalette(pal.id)}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-[#0E1715] dark:bg-white text-white dark:text-[#0E1715] font-black'
                      : 'text-white'
                  }`}
                  style={!isSelected ? { backgroundColor: pal.primaryColor } : {}}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isSelected ? 'check_circle' : 'palette'}
                  </span>
                  <span>{isSelected ? 'Currently Selected' : `Apply ${pal.title.split(':')[0]}`}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] ${
            isDark ? 'bg-[#162421] border-[#233833] text-[#B8CCC1]' : 'bg-[#EBF2ED] border-[#CFDED5] text-[#4D5C56]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#059669] text-[18px]">tune</span>
            <span>
              You can switch between any palette live at any time without resetting your data or session.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#DC2626] text-white font-bold cursor-pointer shrink-0"
          >
            Done Viewing
          </button>
        </div>
      </div>
    </div>
  );
};
