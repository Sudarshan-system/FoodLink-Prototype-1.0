import React from 'react';

export function LoadingFallback({ message = 'Loading section...' }: { message?: string }) {
  return (
    <div
      className="w-full min-h-[320px] flex items-center justify-center py-16"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-[#D9E2DA] dark:border-[#1E5C38] border-t-[#2E7D4F] dark:border-t-[#34D399] rounded-full animate-spin" />
        <span className="text-sm font-medium text-[#4A5D50] dark:text-[#9CA3AF]">
          {message}
        </span>
      </div>
    </div>
  );
}
