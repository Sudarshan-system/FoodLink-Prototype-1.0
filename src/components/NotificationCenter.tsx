import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, AppNotification } from '../lib/notifications';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../features/auth/AuthContext';

interface NotificationCenterProps {
  onNavigateTab?: (tab: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigateTab }) => {
  const { isDark } = useTheme();
  const { currentUser } = useAuth();
  const {
    notifications,
    unreadCount,
    permission,
    markAsRead,
    markAllAsRead,
    clearAll,
    enableNotifications,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'surplus' | 'courier' | 'ngo'>('all');
  const [isRequesting, setIsRequesting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleEnablePush = async () => {
    setIsRequesting(true);
    try {
      await enableNotifications(currentUser?.uid);
    } finally {
      setIsRequesting(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'surplus') return n.type === 'surplus_new' || n.type === 'surplus_claimed';
    if (filter === 'courier') return n.type === 'courier_dispatched' || n.type === 'courier_arrived';
    if (filter === 'ngo') return n.type === 'ngo_request';
    return true;
  });

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'surplus_new':
        return { name: 'restaurant', color: 'text-emerald-500 bg-emerald-500/10' };
      case 'surplus_claimed':
        return { name: 'task_alt', color: 'text-amber-500 bg-amber-500/10' };
      case 'courier_dispatched':
      case 'courier_arrived':
        return { name: 'local_shipping', color: 'text-blue-500 bg-blue-500/10' };
      case 'ngo_request':
        return { name: 'campaign', color: 'text-purple-500 bg-purple-500/10' };
      default:
        return { name: 'notifications', color: 'text-emerald-500 bg-emerald-500/10' };
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative inline-block shrink-0 notranslate" translate="no" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        translate="no"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        className={`notranslate relative w-10 h-10 min-w-10 min-h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
          isDark
            ? 'bg-[#162421] hover:bg-[#1E332E] text-[#B8CCC1] hover:text-white border border-[#233833]'
            : 'bg-[#F0FDF8] hover:bg-[#D1FAE5] text-[#064E3B] border border-[#CFDED5]'
        }`}
      >
        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">
          {unreadCount > 0 ? 'notifications_active' : 'notifications'}
        </span>

        {unreadCount > 0 && (
          <span
            className="notranslate absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white shadow-xs animate-pulse pointer-events-none"
            translate="no"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-[340px] sm:w-[400px] rounded-2xl shadow-2xl border z-50 overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
            isDark
              ? 'bg-[#14211E] border-[#233833] text-[#F2F7F4]'
              : 'bg-white border-[#CFDED5] text-[#111A17]'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#CFDED5]/50 dark:border-[#233833] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">notifications</span>
              <h3 className="font-bold text-sm tracking-tight">Live Activity &amp; Push Alerts</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-medium text-emerald-600 hover:underline cursor-pointer"
                >
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* FCM Push Permission Banner */}
          {permission !== 'granted' && (
            <div className="p-3 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border-b border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">
                  circle_notifications
                </span>
                <p className="font-medium text-[11px] leading-tight truncate">
                  Get instant sound &amp; background push alerts
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isRequesting}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shrink-0 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isRequesting ? 'Connecting...' : 'Enable FCM'}
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="px-4 py-2 flex items-center gap-1.5 border-b border-[#CFDED5]/40 dark:border-[#233833]/60 text-[11px]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('surplus')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filter === 'surplus'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Surplus
            </button>
            <button
              type="button"
              onClick={() => setFilter('ngo')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filter === 'ngo'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              NGO Needs
            </button>
            <button
              type="button"
              onClick={() => setFilter('courier')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filter === 'courier'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Couriers
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[#CFDED5]/30 dark:divide-[#233833]/60">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                <span className="material-symbols-outlined text-[32px] text-gray-400 block mb-1">
                  notifications_off
                </span>
                No alerts in this category yet.
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const iconInfo = getIcon(notif.type);
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      markAsRead(notif.id);
                      if (notif.linkTab && onNavigateTab) {
                        onNavigateTab(notif.linkTab);
                        setIsOpen(false);
                      }
                    }}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      notif.read
                        ? isDark
                          ? 'hover:bg-[#1A2C28]/60 opacity-80'
                          : 'hover:bg-[#F9FBFA] opacity-85'
                        : isDark
                        ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                        : 'bg-emerald-50/50 hover:bg-emerald-50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconInfo.color}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {iconInfo.name}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="font-bold text-xs truncate">{notif.title}</h4>
                        <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-[#A7BCB0] leading-snug line-clamp-2">
                        {notif.body}
                      </p>
                      {notif.linkTab && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <span>View Details</span>
                          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                        </div>
                      )}
                    </div>

                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#F4F8F5] dark:bg-[#0E1715] border-t border-[#CFDED5]/50 dark:border-[#233833] flex items-center justify-between text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>FCM Connected • Live</span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) onNavigateTab('settings');
                setIsOpen(false);
              }}
              className="text-emerald-600 font-bold hover:underline"
            >
              Alert Settings &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
