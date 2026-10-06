import React, { useState, useRef, useEffect } from 'react';
import {
  Trophy,
  Bell,
  Moon,
  Sun,
  Palette,
  ChevronDown,
  LogOut,
  Award,
  Settings,
  Menu,
  X,
  Compass,
  HeartHandshake,
  Truck,
  Inbox,
  ShieldCheck,
  Receipt,
  User as UserIcon,
} from 'lucide-react';
import { FoodLinkLogo } from '../common/FoodLinkLogo';
import { LanguageSelector } from '../LanguageSelector';
import { useAuth } from '../../features/auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../lib/i18n';
import { useNotifications } from '../../lib/notifications';
import { getUserTierAndProgress, getUserBadges } from '../../lib/badgesAndTiers';

export type NavTab =
  | 'home'
  | 'browse'
  | 'donor'
  | 'courier'
  | 'requests'
  | 'leaderboard'
  | 'verify'
  | 'ledger'
  | 'settings'
  | 'admin';

interface NavbarProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  onOpenAuth: (role?: 'donor' | 'recipient' | 'volunteer' | 'admin', mode?: 'signin' | 'signup') => void;
  onOpenPaletteModal: () => void;
  onOpenCertificateModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenAuth,
  onOpenPaletteModal,
  onOpenCertificateModal,
}) => {
  const { currentUser, userProfile, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine user role and friendly display name
  const role = userProfile?.role || 'guest';
  const isDonor = role === 'donor' || role === 'restaurant' || role === 'individual_donor';
  const isRecipient = role === 'recipient' || role === 'ngo' || role === 'individual_recipient';
  const isCourier = role === 'volunteer';
  const isAdmin = role === 'admin';

  const getRoleBadgeLabel = () => {
    if (isAdmin) return 'Admin';
    if (isCourier) return 'Courier';
    if (isDonor) return 'Donor';
    if (isRecipient) return 'NGO / Shelter';
    return 'Guest';
  };

  const displayName =
    userProfile?.displayName ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0] ||
    'Guest User';

  const avatarInitial = displayName.charAt(0).toUpperCase() || 'U';

  // Badges & Tier progress calculation (default 420 kg or user stats)
  const userKg = (userProfile as any)?.totalKgDonated || (userProfile as any)?.totalKgRescued || 420;
  const tierProgress = getUserTierAndProgress(userKg);
  const badges = getUserBadges(role, userKg);

  // Link definitions with role filtering
  const allNavLinks: { id: NavTab; label: string; icon?: React.ReactNode; show: boolean }[] = [
    { id: 'home', label: 'Home', show: true },
    { id: 'browse', label: 'Browse', show: true },
    { id: 'donor', label: 'Donor', show: isDonor || isAdmin || !currentUser },
    { id: 'courier', label: 'Courier Logistics', show: isCourier || isAdmin || !currentUser },
    { id: 'requests', label: 'NGO Requests', show: isRecipient || isDonor || isAdmin || !currentUser },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: <Trophy className="w-4 h-4 text-[#F28C1B]" />,
      show: true,
    },
    { id: 'verify', label: 'Verify', show: true },
    { id: 'ledger', label: 'Ledger', show: true },
  ];

  const visibleLinks = allNavLinks.filter((link) => link.show);

  const handleLinkClick = (tabId: NavTab) => {
    // If guest clicks Donor or Courier, open Auth for that role
    if (!currentUser && tabId === 'donor') {
      onOpenAuth('donor', 'signup');
      return;
    }
    if (!currentUser && tabId === 'courier') {
      onOpenAuth('volunteer', 'signup');
      return;
    }
    onNavigate(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#0E1A14]/95 backdrop-blur-md border-b border-[#E3E8E2] dark:border-[#234233] transition-colors">
      <div className="site-container h-18 flex items-center justify-between gap-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-6 shrink-0">
          <FoodLinkLogo
            size={38}
            showWordmark={true}
            textSize="xl"
            onClick={() => onNavigate('home')}
            className="hover:opacity-95 transition-opacity"
          />
        </div>

        {/* Center: Navigation Links with thick green underline for active */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {visibleLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleLinkClick(link.id)}
                className={`relative px-3.5 py-2 text-sm transition-colors flex items-center gap-1.5 cursor-pointer font-medium ${
                  isActive
                    ? 'text-[#0B8F5F] font-bold dark:text-[#10A771]'
                    : 'text-[#5B6B62] hover:text-[#10231A] dark:text-[#9AA7A0] dark:hover:text-[#F4F7F5]'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-[#0B8F5F] dark:bg-[#10A771] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Notification Bell with Saffron Orange Badge */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label="Notifications"
              className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E3E8E2] dark:border-[#234233] bg-white dark:bg-[#14261D] text-[#5B6B62] dark:text-[#9AA7A0] hover:text-[#0B8F5F] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] transition-colors relative cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#F28C1B] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#14261D] border border-[#E3E8E2] dark:border-[#234233] rounded-2xl shadow-xl p-3 z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E3E8E2] dark:border-[#234233]">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-sm text-[#10231A] dark:text-[#F4F7F5]">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="bg-[#F28C1B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs text-[#0B8F5F] hover:underline font-medium cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-[#5B6B62] hover:text-[#10231A] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-center py-6 text-xs text-[#5B6B62] dark:text-[#9AA7A0]">
                      No notifications yet
                    </p>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.linkTab) onNavigate(n.linkTab as NavTab);
                          setNotifOpen(false);
                        }}
                        className={`p-2.5 rounded-xl border transition-colors cursor-pointer text-left ${
                          !n.read
                            ? 'bg-[#EAF3EC]/60 dark:bg-[#1B3327]/60 border-[#D1E2D7] dark:border-[#234233]'
                            : 'bg-white dark:bg-[#14261D] border-transparent hover:border-[#E3E8E2]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-xs font-bold text-[#10231A] dark:text-[#F4F7F5] line-clamp-1">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-[#5B6B62] shrink-0">
                            {Math.round((Date.now() - n.timestamp) / 60000)}m ago
                          </span>
                        </div>
                        <p className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] line-clamp-2">
                          {n.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dark Mode Moon Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E3E8E2] dark:border-[#234233] bg-white dark:bg-[#14261D] text-[#5B6B62] dark:text-[#9AA7A0] hover:text-[#0B8F5F] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-5 h-5 text-[#F28C1B]" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Palette Theme Picker */}
          <button
            type="button"
            onClick={onOpenPaletteModal}
            aria-label="Theme palette options"
            className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E3E8E2] dark:border-[#234233] bg-white dark:bg-[#14261D] text-[#5B6B62] dark:text-[#9AA7A0] hover:text-[#0B8F5F] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] transition-colors cursor-pointer"
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* Language Dropdown with "IN" Chip */}
          <LanguageSelector compact={false} className="hidden sm:inline-block" />

          {/* Profile Button or Sign In/Sign Up */}
          {currentUser ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="h-10 px-3 rounded-xl border border-[#E3E8E2] dark:border-[#234233] bg-white dark:bg-[#14261D] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] text-[#10231A] dark:text-[#F4F7F5] flex items-center gap-2 transition-colors cursor-pointer shadow-xs min-h-[40px]"
              >
                <span className="w-6 h-6 rounded-full bg-[#EAF3EC] dark:bg-[#1B3327] text-[#0B8F5F] dark:text-[#10A771] flex items-center justify-center font-bold text-xs">
                  {avatarInitial}
                </span>
                <span className="text-xs font-semibold truncate max-w-[130px]">
                  {displayName} <span className="text-[#0B8F5F] font-normal">({getRoleBadgeLabel()})</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#5B6B62]" />
              </button>

              {/* Profile Dropdown Panel */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#14261D] border border-[#E3E8E2] dark:border-[#234233] rounded-2xl shadow-xl p-4 z-50 text-left animate-in fade-in duration-150">
                  {/* Header: Name, Role in Green, Email */}
                  <div className="pb-3 border-b border-[#E3E8E2] dark:border-[#234233]">
                    <p className="font-serif font-bold text-base text-[#10231A] dark:text-[#F4F7F5] truncate">
                      {displayName}
                    </p>
                    <p className="text-xs font-bold text-[#0B8F5F] dark:text-[#10A771] mt-0.5">
                      {getRoleBadgeLabel()} Account
                    </p>
                    <p className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] truncate mt-0.5">
                      {currentUser.email}
                    </p>
                  </div>

                  {/* Profile Badges & Active Tier */}
                  <div className="py-3 border-b border-[#E3E8E2] dark:border-[#234233]">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-[#5B6B62] dark:text-[#9AA7A0]">Profile Badges</span>
                      <span className="font-bold text-[#0B8F5F] text-[11px]">{tierProgress.activeTier}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {badges.map((b) => (
                        <span
                          key={b.id}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAF3EC] text-[#0B8F5F] dark:bg-[#1B3327] dark:text-[#10A771] border border-[#D1E2D7] dark:border-[#234233]"
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>

                    {/* Progress Bar to Next Tier */}
                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-[#5B6B62] dark:text-[#9AA7A0] mb-1">
                        <span>{tierProgress.nextLabel}</span>
                        <span>{tierProgress.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E3E8E2] dark:bg-[#234233] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0B8F5F] dark:bg-[#10A771] rounded-full transition-all duration-300"
                          style={{ width: `${tierProgress.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Role-based Menu Items */}
                  <div className="py-2 space-y-1">
                    {(isDonor || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('donor');
                          setProfileOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#10231A] dark:text-[#F4F7F5] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <HeartHandshake className="w-4 h-4 text-[#0B8F5F]" />
                        <span>Donor Portal</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenCertificateModal) onOpenCertificateModal();
                        else onNavigate('ledger');
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#0B8F5F] dark:text-[#10A771] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Award className="w-4 h-4 text-[#0B8F5F]" />
                      <span>Impact Certificate (PDF)</span>
                    </button>

                    {(isCourier || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('courier');
                          setProfileOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#10231A] dark:text-[#F4F7F5] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Truck className="w-4 h-4 text-[#0B8F5F]" />
                        <span>Courier Logistics</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('settings');
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#10231A] dark:text-[#F4F7F5] hover:bg-[#EAF3EC] dark:hover:bg-[#1B3327] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Settings className="w-4 h-4 text-[#5B6B62]" />
                      <span>Settings</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <hr className="border-[#E3E8E2] dark:border-[#234233] my-1" />

                  {/* Sign Out in Saffron Orange */}
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#F28C1B] hover:bg-[#F28C1B]/10 flex items-center gap-2 cursor-pointer transition-colors mt-1"
                  >
                    <LogOut className="w-4 h-4 text-[#F28C1B]" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth(undefined, 'signin')}
                className="px-3.5 py-2 rounded-xl border border-[#E3E8E2] dark:border-[#234233] bg-white dark:bg-[#14261D] text-xs font-semibold text-[#10231A] dark:text-[#F4F7F5] hover:bg-[#EAF3EC] transition-colors cursor-pointer min-h-[40px]"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth(undefined, 'signup')}
                className="px-4 py-2 rounded-xl bg-[#0B8F5F] hover:bg-[#09774F] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs min-h-[40px]"
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open mobile menu"
            className="lg:hidden w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E3E8E2] dark:border-[#234233] bg-white dark:bg-[#14261D] text-[#10231A] dark:text-[#F4F7F5] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E3E8E2] dark:border-[#234233] bg-white dark:bg-[#0E1A14] px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-1">
            {visibleLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleLinkClick(link.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-colors ${
                    isActive
                      ? 'bg-[#EAF3EC] text-[#0B8F5F] dark:bg-[#1B3327] dark:text-[#10A771]'
                      : 'text-[#5B6B62] hover:bg-[#F6F8F5] dark:text-[#9AA7A0] dark:hover:bg-[#14261D]'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#E3E8E2] dark:border-[#234233] flex items-center justify-between">
            <span className="text-xs text-[#5B6B62]">Language:</span>
            <LanguageSelector compact={true} />
          </div>
        </div>
      )}
    </header>
  );
};
