import React from 'react';

export interface FoodLinkLogoProps {
  /** Size in pixels of the logo mark */
  size?: number;
  /** Whether to show the text wordmark "FoodLink" */
  showWordmark?: boolean;
  /** Wordmark font size */
  textSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  /** Additional CSS class */
  className?: string;
  /** Optional subtitle below wordmark */
  subtitle?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional style variant */
  variant?: string;
}

export const FoodLinkLogo: React.FC<FoodLinkLogoProps> = ({
  size = 38,
  showWordmark = true,
  textSize = 'xl',
  className = '',
  subtitle,
  onClick,
}) => {
  const textSizes = {
    sm: 'text-base',
    base: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
    '2xl': 'text-3xl',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Mint Tile Logo Mark */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-label="FoodLink Logo"
        >
          {/* Rounded-square mint tile with soft border */}
          <rect
            x="0.75"
            y="0.75"
            width="34.5"
            height="34.5"
            rx="9.5"
            fill="#EAF3EC"
            stroke="#D1E2D7"
            strokeWidth="1.2"
            className="dark:fill-[#14261D] dark:stroke-[#234233]"
          />

          {/* Saffron Orange Half-Sun Dome rising from the plate */}
          <path
            d="M11 19 C11 14.5 14.1 11.5 18 11.5 C21.9 11.5 25 14.5 25 19 Z"
            fill="#F28C1B"
          />

          {/* Sun Rays Accents */}
          <path
            d="M18 8.5 V10.5M12.5 10.5 L14 12M23.5 10.5 L22 12"
            stroke="#F28C1B"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Small Green Leaf Accent sprouting from the side */}
          <path
            d="M23 15 C26 13 28 14 28 14 C28 14 27.5 17 24.5 17.5 C23.5 17.8 23 16 23 15 Z"
            fill="#0B8F5F"
          />
          <path
            d="M23.5 16 C25 15 26.5 14.5 26.5 14.5"
            stroke="#EAF3EC"
            strokeWidth="0.6"
            strokeLinecap="round"
          />

          {/* Nourishing Food Bowl / Plate */}
          <path
            d="M7.5 19 C7.5 18.2 8.2 17.5 9 17.5 H27 C27.8 17.5 28.5 18.2 28.5 19 C28.5 24.2 24.2 26.5 18 26.5 C11.8 26.5 7.5 24.2 7.5 19 Z"
            fill="#0B8F5F"
          />

          {/* Plate Rim Highlight */}
          <path
            d="M7 18.2 C7 17.7 7.4 17.2 8 17.2 H28 C28.6 17.2 29 17.7 29 18.2 C29 18.7 28.6 19.2 28 19.2 H8 C7.4 19.2 7 18.7 7 18.2 Z"
            fill="#09774F"
          />

          {/* Plate Inner Food Glow */}
          <ellipse
            cx="18"
            cy="19"
            rx="7"
            ry="1.4"
            fill="#FAFBF8"
            fillOpacity="0.45"
          />
        </svg>
      </div>

      {/* Wordmark: "Food" in dark serif, "Link" in green serif, small orange dot */}
      {showWordmark && (
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-baseline tracking-tight">
            <span
              className={`font-serif font-bold text-[#10231A] dark:text-[#F4F7F5] ${textSizes[textSize]}`}
            >
              Food
            </span>
            <span
              className={`font-serif font-bold text-[#0B8F5F] dark:text-[#10A771] ${textSizes[textSize]}`}
            >
              Link
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#F28C1B] inline-block ml-0.5" />
          </div>
          {subtitle && (
            <span className="text-[10px] font-semibold tracking-wider text-[#5B6B62] dark:text-[#9AA7A0] mt-0.5 uppercase">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
