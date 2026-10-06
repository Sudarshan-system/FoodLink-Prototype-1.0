import React, { useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';

export const PwaInstallPrompt: React.FC = () => {
  const { isDark } = useTheme();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check if already running as installed standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register PWA service worker if supported
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('PWA service worker registration notice:', err);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Guide iOS or other browsers
      alert(
        'To install FoodLink on your device: Tap the Share / Options button in your browser, then select "Add to Home Screen".'
      );
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      {/* Offline Alert Ribbon */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-md">
          <span className="material-symbols-outlined text-[18px]">wifi_off</span>
          <span>You are currently offline. FoodLink cached data and emergency records remain accessible.</span>
        </div>
      )}

      {/* Floating PWA Install Banner */}
      {isInstallable && !isInstalled && !isDismissed && (
        <div
          className={`fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 rounded-2xl p-4 shadow-2xl border flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
            isDark
              ? 'bg-[#14211E]/95 backdrop-blur-md border-[#233833] text-[#F2F7F4]'
              : 'bg-white/95 backdrop-blur-md border-[#CFDED5] text-[#111A17]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <span className="material-symbols-outlined text-[24px]">install_mobile</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-xs sm:text-sm tracking-tight truncate">
                Install FoodLink App
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 leading-snug">
                Instant alerts for couriers &amp; kitchen staff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition-all active:scale-95"
            >
              Install
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white"
              title="Dismiss"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
