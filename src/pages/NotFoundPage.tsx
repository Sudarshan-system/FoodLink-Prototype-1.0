import React from 'react';
import { useTheme } from '../theme/ThemeContext';

interface NotFoundPageProps {
  onNavigateHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigateHome }) => {
  const { isDark } = useTheme();

  return (
    <div className="site-container py-16 sm:py-24 flex flex-col items-center justify-center text-center min-h-[50vh]">
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border ${
          isDark
            ? 'bg-[#064E3B] border-[#1E5C38] text-[#059669]'
            : 'bg-[#D1FAE5] border-[#E7E5E4] text-[#059669]'
        }`}
      >
        <span className="material-symbols-outlined text-[36px]">search_off</span>
      </div>

      <span className="text-xs uppercase tracking-wider font-bold text-[#EA580C] mb-2">
        Error 404
      </span>

      <h1
        className={`font-serif text-3xl sm:text-4xl font-bold mb-3 ${
          isDark ? 'text-[#F0FDF8]' : 'text-[#064E3B]'
        }`}
      >
        Page not found
      </h1>

      <p
        className={`text-base max-w-[45ch] mb-8 leading-relaxed ${
          isDark ? 'text-[#D1DDD5]' : 'text-[#6B7280]'
        }`}
      >
        The page you are looking for does not exist or may have been moved.
      </p>

      <button
        type="button"
        onClick={onNavigateHome}
        className="px-6 py-3 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">home</span>
        <span>Back to Home</span>
      </button>
    </div>
  );
};
