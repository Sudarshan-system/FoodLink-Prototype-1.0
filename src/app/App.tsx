import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../features/auth/AuthContext';
import { AuthModal, ModalStep } from '../features/auth/AuthModal';
import { TermsPolicyModal } from '../components/TermsPolicyModal';
import { DonorDashboard, FoodListing } from '../features/donor/DonorDashboard';
import { RecipientDashboard } from '../features/recipient/RecipientDashboard';
import { VerificationModule } from '../features/verification/VerificationModule';
import { Leaderboard, SEED_LEADERBOARD_DONORS } from '../features/leaderboard/Leaderboard';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { useTheme } from '../theme/ThemeContext';
import { CookieNotice } from '../components/CookieNotice';
import { LoadingFallback } from '../components/LoadingFallback';

// Lazy-loaded routes and heavy utilities for production code splitting
const AdminPanel = React.lazy(() => import('../pages/AdminPanel').then(m => ({ default: m.AdminPanel })));
const VolunteerLogistics = React.lazy(() => import('../features/courier/VolunteerLogistics').then(m => ({ default: m.VolunteerLogistics })));
const RescueLedgerLeaderboard = React.lazy(() => import('../features/leaderboard/RescueLedgerLeaderboard').then(m => ({ default: m.RescueLedgerLeaderboard })));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const LegalPage = React.lazy(() => import('../pages/LegalPage').then(m => ({ default: m.LegalPage })));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const CsrReportModal = React.lazy(() => import('../components/CsrReportModal').then(m => ({ default: m.CsrReportModal })));
import { RealTimeCourierTracker, CourierMissionData } from '../components/RealTimeCourierTracker';
import { NgoMealRequests } from '../features/requests/NgoMealRequests';
import { NotificationCenter } from '../components/NotificationCenter';
import { LanguageSelector } from '../components/LanguageSelector';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Footer } from '../components/layout/Footer';
import { FoodLinkLogo } from '../components/common/FoodLinkLogo';
import { HeroSection } from '../components/home/HeroSection';
import { TopDonorsTicker } from '../components/home/TopDonorsTicker';
import { FaqSection } from '../components/home/FaqSection';
import { useLanguage } from '../lib/i18n';
import {
  getSavedSettings,
  applyGlobalSettings,
  SETTINGS_CHANGE_EVENT,
} from '../lib/settingsStorage';

export type TabType =
  | 'home'
  | 'browse'
  | 'leaderboard'
  | 'donor'
  | 'recipient'
  | 'courier'
  | 'verify'
  | 'ledger'
  | 'requests'
  | 'admin'
  | 'admin-login'
  | 'privacy'
  | 'terms'
  | '404'
  | 'settings';

export default function App() {
  const { currentUser, userProfile, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [pendingRedirectTab, setPendingRedirectTab] = useState<TabType | null>(null);

  // Menus state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabletMoreOpen, setTabletMoreOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialRole, setAuthModalInitialRole] = useState<'donor' | 'recipient' | 'volunteer' | 'admin' | null>(null);
  const [authModalInitialStep, setAuthModalInitialStep] = useState<ModalStep | undefined>(undefined);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // CSR Impact Certificate Modal state
  const [csrModalOpen, setCsrModalOpen] = useState(false);
  const [selectedCsrListing, setSelectedCsrListing] = useState<FoodListing | null>(null);

  const handleOpenCsrModal = (listing?: FoodListing | null) => {
    setSelectedCsrListing(listing || null);
    setCsrModalOpen(true);
  };

  // Real-Time Courier Tracker Modal state
  const [courierTrackerOpen, setCourierTrackerOpen] = useState(false);
  const [activeCourierMission, setActiveCourierMission] = useState<CourierMissionData | null>(null);

  const handleOpenCourierTracker = (customMission?: Partial<CourierMissionData>) => {
    setActiveCourierMission({
      listingId: customMission?.listingId || 'mission-run-01',
      foodTitle: customMission?.foodTitle || 'Prepared Meals & Fresh Produce',
      quantityStr: customMission?.quantityStr || '85 portions',
      donorName: customMission?.donorName || 'Chef Marcus Vance',
      donorOrg: customMission?.donorOrg || 'Taj Grand Banquets & Hotels Ltd.',
      donorAddress: customMission?.donorAddress || 'Loading Dock #2, Worli South, Mumbai',
      shelterName: customMission?.shelterName || 'Akshaya Patra Community Relief Shelter',
      shelterAddress: customMission?.shelterAddress || 'Receiving Bay #2, Urban Relief Center',
      courierName: customMission?.courierName || 'Rahul Verma (Eco Courier Runner)',
      courierPhone: '+91 98200 48192',
      courierVehicle: 'Hero Electric Nyx Cargo Scooter',
      handoffCode: '4829',
      cargoTemp: '4.2°C (Thermal Insulated)',
      status: 'en_route_shelter',
      ...customMission,
    });
    setCourierTrackerOpen(true);
  };

  // Community listings state
  const [communityListings, setCommunityListings] = useState<FoodListing[]>([]);
  const [loadingListings, setLoadingListings] = useState<boolean>(true);
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Floating Back to Top button state
  const [showBackToTopBtn, setShowBackToTopBtn] = useState(false);

  // Initialize global device settings on mount
  useEffect(() => {
    const initialSettings = getSavedSettings();
    applyGlobalSettings(initialSettings);
  }, []);

  // Scroll to top whenever the active tab changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Listen to scroll position for Back to top button
  useEffect(() => {
    const handleScroll = () => {
      const settings = getSavedSettings();
      if (settings.showBackToTop && window.scrollY > 300) {
        setShowBackToTopBtn(true);
      } else {
        setShowBackToTopBtn(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener(SETTINGS_CHANGE_EVENT, handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleScroll);
    };
  }, []);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleOpenAuth = (role: 'donor' | 'recipient' | 'volunteer' | 'admin' | null = null, step?: ModalStep) => {
    setAuthModalInitialRole(role);
    setAuthModalInitialStep(step);
    setIsAuthModalOpen(true);
    setMobileMenuOpen(false);
    setTabletMoreOpen(false);
    setProfileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    showToast('Signed out successfully.');
    // If on a protected tab, navigate back to home
    if (
      activeTab === 'donor' ||
      activeTab === 'recipient' ||
      activeTab === 'courier' ||
      activeTab === 'ledger'
    ) {
      setActiveTab('home');
      window.location.hash = 'home';
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setTabletMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Access control handler
  const handleTabClick = (tab: TabType) => {
    if (tab === 'admin') {
      if (!currentUser || userProfile?.role !== 'admin') {
        setActiveTab('admin-login');
        window.history.pushState(null, '', '/admin-login');
        window.location.hash = 'admin-login';
        setMobileMenuOpen(false);
        setTabletMoreOpen(false);
        return;
      }
      setActiveTab('admin');
      window.history.pushState(null, '', '/admin');
      window.location.hash = 'admin';
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }

    if (tab === 'admin-login') {
      if (currentUser && userProfile?.role === 'admin') {
        setActiveTab('admin');
        window.history.pushState(null, '', '/admin');
        window.location.hash = 'admin';
        setMobileMenuOpen(false);
        setTabletMoreOpen(false);
        return;
      }
      setActiveTab('admin-login');
      window.history.pushState(null, '', '/admin-login');
      window.location.hash = 'admin-login';
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }

    if (tab === 'privacy' || tab === 'terms' || tab === '404' || tab === 'settings' || tab === 'leaderboard') {
      setActiveTab(tab);
      window.history.pushState(null, '', tab === '404' ? '/404' : `/${tab}`);
      window.location.hash = tab;
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }

    const isProtected =
      tab === 'donor' || tab === 'recipient' || tab === 'courier' || tab === 'ledger';
    if (isProtected && !currentUser) {
      setPendingRedirectTab(tab);
      showToast('Please sign in to use this section.');
      handleOpenAuth(
        tab === 'donor'
          ? 'donor'
          : tab === 'recipient'
          ? 'recipient'
          : tab === 'courier'
          ? 'volunteer'
          : null
      );
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }
    setActiveTab(tab);
    window.history.pushState(null, '', tab === 'home' ? '/' : `/#${tab}`);
    window.location.hash = tab === 'home' ? '' : tab;
    setMobileMenuOpen(false);
    setTabletMoreOpen(false);
  };

  // Sync document title and meta description per page
  useEffect(() => {
    const titles: Record<TabType, { title: string; desc: string }> = {
      home: {
        title: 'FoodLink - Direct Food Rescue & Donation Network',
        desc: 'Connect surplus prepared meals with local shelters, community kitchens, and pantries instantly with FoodLink.',
      },
      browse: {
        title: 'Browse Available Surplus Food - FoodLink',
        desc: 'Claim verified food donations in real time for orphanages, shelters, and care homes.',
      },
      leaderboard: {
        title: 'Donor Impact Leaderboard - FoodLink',
        desc: 'See top restaurants, banquets, and caterers donating surplus food with highest impact scores.',
      },
      donor: {
        title: 'Donor Portal - List Surplus Food - FoodLink',
        desc: 'List fresh surplus meals from restaurants, banquet halls, and food businesses safely.',
      },
      recipient: {
        title: 'Recipient Dashboard - Claimed Surplus Pickups - FoodLink',
        desc: 'Manage claimed surplus food batches, pickup verification codes, and collection schedules.',
      },
      courier: {
        title: 'Volunteer Courier Hub - FoodLink',
        desc: 'Help transport and deliver inspected surplus food to community centers and shelters.',
      },
      verify: {
        title: 'Verification Standards & Food Checks - FoodLink',
        desc: 'Learn about FoodLink verification requirements for donors and charitable recipient organizations.',
      },
      ledger: {
        title: 'Rescue Ledger - Your Donations & Pickups - FoodLink',
        desc: 'Track and verify surplus meals rescued, claimed, and delivered across local communities.',
      },
      requests: {
        title: 'NGO Meal Requests & Reverse Food Rescue - FoodLink',
        desc: 'View urgent and scheduled meal demands from local shelters, orphanages, and community kitchens.',
      },
      admin: {
        title: 'Admin Operations Panel - FoodLink',
        desc: 'Manage verification queue, listings compliance, and user records across FoodLink.',
      },
      'admin-login': {
        title: 'Admin Sign In - FoodLink',
        desc: 'Secure administrative access portal for platform verification officers and coordinators.',
      },
      privacy: {
        title: 'Privacy Policy - FoodLink',
        desc: 'Read how FoodLink collects, uses, and safeguards user and organizational data.',
      },
      terms: {
        title: 'Terms of Service - FoodLink',
        desc: 'Terms of service and Good Samaritan liability protections for FoodLink users.',
      },
      '404': {
        title: 'Page Not Found (404) - FoodLink',
        desc: 'The requested page could not be found on FoodLink.',
      },
      settings: {
        title: 'Settings - FoodLink',
        desc: 'Customize your appearance, accessibility, map browsing, and account preferences.',
      },
    };

    const currentMeta = titles[activeTab] || titles.home;
    document.title = currentMeta.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', currentMeta.desc);
    }
  }, [activeTab]);

  // Check URL on initial load, hashchange, and popstate
  useEffect(() => {
    const checkUrlAccess = () => {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.replace('#/', '').replace('#', '').toLowerCase();

      let targetRoute: TabType = 'home';
      if (pathname === '/admin' || pathname.startsWith('/admin/') || hash === 'admin') {
        targetRoute = 'admin';
      } else if (
        pathname === '/admin-login' ||
        pathname.startsWith('/admin-login/') ||
        hash === 'admin-login'
      ) {
        targetRoute = 'admin-login';
      } else if (pathname === '/leaderboard' || pathname.startsWith('/leaderboard/') || hash === 'leaderboard') {
        targetRoute = 'leaderboard';
      } else if (pathname === '/privacy' || hash === 'privacy') {
        targetRoute = 'privacy';
      } else if (pathname === '/terms' || hash === 'terms') {
        targetRoute = 'terms';
      } else if (
        pathname === '/settings' ||
        pathname.startsWith('/settings/') ||
        hash === 'settings'
      ) {
        targetRoute = 'settings';
      } else if (pathname === '/404' || hash === '404') {
        targetRoute = '404';
      } else if (pathname === '/' || pathname === '') {
        const validTabs: TabType[] = [
          'home',
          'browse',
          'leaderboard',
          'donor',
          'recipient',
          'courier',
          'verify',
          'ledger',
          'requests',
          'privacy',
          'terms',
          'settings',
        ];
        if (validTabs.includes(hash as TabType)) {
          targetRoute = hash as TabType;
        } else if (hash && hash !== '') {
          targetRoute = '404';
        } else {
          targetRoute = 'home';
        }
      } else {
        // Unknown pathname: display custom 404 page
        targetRoute = '404';
      }

      if (targetRoute === 'admin') {
        if (!currentUser || userProfile?.role !== 'admin') {
          setActiveTab('admin-login');
          window.history.replaceState(null, '', '/admin-login');
          window.location.hash = 'admin-login';
        } else {
          setActiveTab('admin');
        }
        return;
      }

      if (targetRoute === 'admin-login') {
        if (currentUser && userProfile?.role === 'admin') {
          setActiveTab('admin');
          window.history.replaceState(null, '', '/admin');
          window.location.hash = 'admin';
        } else {
          setActiveTab('admin-login');
        }
        return;
      }

      const isProtected =
        targetRoute === 'donor' ||
        targetRoute === 'recipient' ||
        targetRoute === 'courier' ||
        targetRoute === 'ledger';
      if (isProtected && !currentUser) {
        setPendingRedirectTab(targetRoute);
        showToast('Please sign in to use this section.');
        handleOpenAuth(
          targetRoute === 'donor' ? 'donor' : targetRoute === 'recipient' ? 'recipient' : null
        );
        setActiveTab('home');
      } else {
        setActiveTab(targetRoute);
      }
    };

    checkUrlAccess();
    window.addEventListener('hashchange', checkUrlAccess);
    window.addEventListener('popstate', checkUrlAccess);
    return () => {
      window.removeEventListener('hashchange', checkUrlAccess);
      window.removeEventListener('popstate', checkUrlAccess);
    };
  }, [currentUser, userProfile]);

  // When user signs in and a pending redirect tab was clicked, redirect to it
  useEffect(() => {
    if (currentUser && pendingRedirectTab) {
      setActiveTab(pendingRedirectTab);
      window.location.hash = pendingRedirectTab;
      setPendingRedirectTab(null);
    }
  }, [currentUser, pendingRedirectTab]);

  // Real-time listener for available listings
  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('status', '==', 'available'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FoodListing[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<FoodListing, 'id'>),
          });
        });

        items.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setCommunityListings(items);
        setLoadingListings(false);
      },
      (err) => {
        console.error('Error loading food listings:', err);
        setLoadingListings(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredListings = communityListings.filter((item) => {
    if (dietaryFilter === 'veg') {
      const titleLower = (item.title + ' ' + (item.notes || '')).toLowerCase();
      return (
        !titleLower.includes('chicken') &&
        !titleLower.includes('mutton') &&
        !titleLower.includes('meat') &&
        !titleLower.includes('fish') &&
        !titleLower.includes('non-veg')
      );
    }
    if (dietaryFilter === 'non-veg') {
      const titleLower = (item.title + ' ' + (item.notes || '')).toLowerCase();
      return (
        titleLower.includes('chicken') ||
        titleLower.includes('mutton') ||
        titleLower.includes('meat') ||
        titleLower.includes('fish') ||
        titleLower.includes('non-veg')
      );
    }
    return true;
  });

  const getRoleDisplayName = () => {
    if (!userProfile?.role) return 'Member';
    if (userProfile.role === 'restaurant' || userProfile.role === 'donor') return 'Donor';
    if (userProfile.role === 'ngo' || userProfile.role === 'recipient') return 'Organization';
    if (userProfile.role === 'volunteer') return 'Courier';
    if (userProfile.role === 'admin') return 'Admin';
    return userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F0FDF8] dark:bg-[#071A12] text-[#064E3B] dark:text-[#F0FDF8]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#064E3B] dark:bg-[#064E3B] text-[#F0FDF8] border border-[#1E5C38] px-4 py-3 rounded-lg text-sm font-medium shadow-md flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#059669]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* NAVBAR */}
      {activeTab !== 'admin' && (
        <header className="sticky top-0 z-40 bg-[#F0FDF8] dark:bg-[#071A12] border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <div className="site-container h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <button
            type="button"
            translate="no"
            onClick={() => handleTabClick('home')}
            className="flex items-center text-left cursor-pointer shrink-0 z-20 notranslate group"
            aria-label="FoodLink Home"
          >
            <FoodLinkLogo size={36} variant="badge" showWordmark={true} textSize="xl" subtitle="Food Rescue" />
          </button>

          {/* Unified Clean Navigation Bar: Important core sections in front, all other sections in More dropdown */}
          <nav className="hidden md:flex items-center gap-1 xl:gap-2 shrink-0">
            {/* 1. Home */}
            <button
              type="button"
              translate="no"
              onClick={() => handleTabClick('home')}
              className={`notranslate whitespace-nowrap px-3.5 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-emerald-100/80 dark:bg-emerald-900/50 text-[#064E3B] dark:text-emerald-200 font-semibold shadow-xs border border-emerald-300/60 dark:border-emerald-700/60'
                  : 'text-[#4B5563] dark:text-[#D1D5DB] hover:text-[#064E3B] dark:hover:text-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40'
              }`}
            >
              {t('home', 'Home')}
            </button>

            {/* 2. Browse Surplus */}
            <button
              type="button"
              translate="no"
              onClick={() => handleTabClick('browse')}
              className={`notranslate whitespace-nowrap px-3.5 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-emerald-100/80 dark:bg-emerald-900/50 text-[#064E3B] dark:text-emerald-200 font-semibold shadow-xs border border-emerald-300/60 dark:border-emerald-700/60'
                  : 'text-[#4B5563] dark:text-[#D1D5DB] hover:text-[#064E3B] dark:hover:text-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40'
              }`}
            >
              {t('browse', 'Browse Surplus')}
            </button>

            {/* 3. Donor Portal */}
            <button
              type="button"
              translate="no"
              onClick={() => handleTabClick('donor')}
              className={`notranslate whitespace-nowrap px-3.5 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'donor'
                  ? 'bg-emerald-100/80 dark:bg-emerald-900/50 text-[#064E3B] dark:text-emerald-200 font-semibold shadow-xs border border-emerald-300/60 dark:border-emerald-700/60'
                  : 'text-[#4B5563] dark:text-[#D1D5DB] hover:text-[#064E3B] dark:hover:text-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40'
              }`}
            >
              {t('donor', 'Donor Portal')}
            </button>

            {/* 4. NGO Meal Requests */}
            <button
              type="button"
              translate="no"
              onClick={() => handleTabClick('requests')}
              className={`notranslate whitespace-nowrap px-3.5 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'requests'
                  ? 'bg-emerald-100/80 dark:bg-emerald-900/50 text-[#064E3B] dark:text-emerald-200 font-semibold shadow-xs border border-emerald-300/60 dark:border-emerald-700/60'
                  : 'text-[#4B5563] dark:text-[#D1D5DB] hover:text-[#064E3B] dark:hover:text-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40'
              }`}
            >
              <span className="notranslate" translate="no">
                {t('requests', 'NGO Meal Requests')}
              </span>
              <span
                className="notranslate px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-400/30"
                translate="no"
              >
                New
              </span>
            </button>

            {/* 5. More Dropdown: Preserving ALL other sections in a beautifully organized menu */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                translate="no"
                onClick={() => setTabletMoreOpen(!tabletMoreOpen)}
                className={`notranslate whitespace-nowrap px-3 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] flex items-center gap-1.5 cursor-pointer ${
                  ['recipient', 'courier', 'ledger', 'leaderboard', 'verify', 'settings'].includes(activeTab)
                    ? 'bg-emerald-100/80 dark:bg-emerald-900/50 text-[#064E3B] dark:text-emerald-200 font-semibold shadow-xs border border-emerald-300/60 dark:border-emerald-700/60'
                    : 'text-[#4B5563] dark:text-[#D1D5DB] hover:text-[#064E3B] dark:hover:text-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40'
                }`}
                aria-expanded={tabletMoreOpen}
              >
                <span className="notranslate" translate="no">
                  {t('more', 'More')}
                </span>
                {['recipient', 'courier', 'ledger', 'leaderboard', 'verify', 'settings'].includes(activeTab) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                )}
                <span
                  className={`material-symbols-outlined notranslate text-[18px] transition-transform duration-200 ${
                    tabletMoreOpen ? 'rotate-180' : ''
                  }`}
                  translate="no"
                >
                  expand_more
                </span>
              </button>

              {tabletMoreOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 bg-white/98 dark:bg-[#071712]/98 backdrop-blur-xl border border-slate-200/90 dark:border-emerald-900/50 rounded-2xl shadow-2xl p-2 z-[9999] animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
                  style={{ filter: 'drop-shadow(0 20px 25px rgba(0,0,0,0.12))' }}
                >
                  <div className="px-3 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Platform Hubs &amp; Services
                  </div>

                  {/* Recipient Dashboard */}
                  <button
                    type="button"
                    translate="no"
                    onClick={() => {
                      handleTabClick('recipient');
                      setTabletMoreOpen(false);
                    }}
                    className={`notranslate w-full text-left p-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                      activeTab === 'recipient'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <span className="material-symbols-outlined notranslate text-[20px]" translate="no">
                        storefront
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight flex items-center justify-between">
                        <span>{t('recipient', 'Recipient Dashboard')}</span>
                        {activeTab === 'recipient' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Claimed donations &amp; shelter distribution
                      </p>
                    </div>
                  </button>

                  {/* Courier Logistics */}
                  <button
                    type="button"
                    translate="no"
                    onClick={() => {
                      handleTabClick('courier');
                      setTabletMoreOpen(false);
                    }}
                    className={`notranslate w-full text-left p-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                      activeTab === 'courier'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <span className="material-symbols-outlined notranslate text-[20px]" translate="no">
                        local_shipping
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight flex items-center justify-between">
                        <span>{t('courier', 'Courier Hub')}</span>
                        {activeTab === 'courier' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Volunteer pickup &amp; live GPS courier map
                      </p>
                    </div>
                  </button>

                  {/* Rescue Ledger */}
                  <button
                    type="button"
                    translate="no"
                    onClick={() => {
                      handleTabClick('ledger');
                      setTabletMoreOpen(false);
                    }}
                    className={`notranslate w-full text-left p-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                      activeTab === 'ledger'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <span className="material-symbols-outlined notranslate text-[20px]" translate="no">
                        receipt_long
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight flex items-center justify-between">
                        <span>{t('ledger', 'Rescue Ledger')}</span>
                        {activeTab === 'ledger' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Public audit trail &amp; CSR impact certificate
                      </p>
                    </div>
                  </button>

                  {/* Impact Leaderboard */}
                  <button
                    type="button"
                    translate="no"
                    onClick={() => {
                      handleTabClick('leaderboard');
                      setTabletMoreOpen(false);
                    }}
                    className={`notranslate w-full text-left p-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                      activeTab === 'leaderboard'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <span className="material-symbols-outlined notranslate text-[20px]" translate="no">
                        leaderboard
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight flex items-center justify-between">
                        <span>{t('leaderboard', 'Impact Leaderboard')}</span>
                        {activeTab === 'leaderboard' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Top food donors &amp; active community heroes
                      </p>
                    </div>
                  </button>

                  {/* Verification */}
                  <button
                    type="button"
                    translate="no"
                    onClick={() => {
                      handleTabClick('verify');
                      setTabletMoreOpen(false);
                    }}
                    className={`notranslate w-full text-left p-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                      activeTab === 'verify'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <span className="material-symbols-outlined notranslate text-[20px]" translate="no">
                        verified
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight flex items-center justify-between">
                        <span>{t('verify', 'Verification Standards')}</span>
                        {activeTab === 'verify' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        FSSAI hygiene protocols &amp; NGO vetting
                      </p>
                    </div>
                  </button>

                  {/* Settings */}
                  <div className="pt-1 mt-1 border-t border-slate-200/70 dark:border-slate-800/80">
                    <button
                      type="button"
                      translate="no"
                      onClick={() => {
                        handleTabClick('settings');
                        setTabletMoreOpen(false);
                      }}
                      className={`notranslate w-full text-left p-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors cursor-pointer ${
                        activeTab === 'settings'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-500/10 text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined notranslate text-[20px]" translate="no">
                          settings
                        </span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm leading-tight flex items-center justify-between">
                          <span>{t('settings', 'Settings')}</span>
                          {activeTab === 'settings' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          Language, dark mode &amp; platform preferences
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right Action: Language, Notifications, Theme, Sign In Button or Profile Menu */}
          <div className="hidden md:flex items-center gap-2 shrink-0 z-20">
            {/* Language Selector */}
            <LanguageSelector />

            {/* Notification Center */}
            <NotificationCenter onNavigateTab={(tab) => handleTabClick(tab as any)} />

            {/* Desktop Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#6B7280] dark:text-[#F0FDF8] hover:text-[#064E3B] dark:hover:text-white hover:bg-[#D1FAE5] dark:hover:bg-[#134025] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {currentUser ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] hover:bg-[#D1FAE5] dark:hover:bg-[#134025] text-sm font-medium text-[#064E3B] dark:text-[#F0FDF8] flex items-center gap-2 min-h-[44px] transition-colors cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-[#059669]/15 text-[#059669] flex items-center justify-center font-bold text-xs">
                    {(userProfile?.displayName || currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </span>
                  <span className="truncate max-w-[120px]">
                    {userProfile?.displayName || currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-[#6B7280]">
                    expand_more
                  </span>
                </button>

                {/* Profile Menu Dropdown */}
                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-lg shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-[#E7E5E4]/60">
                      <p className="text-sm font-bold text-[#064E3B] truncate">
                        {userProfile?.displayName || currentUser.displayName || 'FoodLink Member'}
                      </p>
                      <p className="text-xs text-[#059669] font-medium mt-0.5">
                        {getRoleDisplayName()}
                      </p>
                      <p className="text-xs text-[#6B7280] truncate mt-0.5">
                        {currentUser.email}
                      </p>
                    </div>

                    <div className="py-1">
                      {userProfile?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleTabClick('admin');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[#059669] hover:bg-[#D1FAE5] min-h-[40px] flex items-center gap-2 font-semibold cursor-pointer border-b border-[#E7E5E4]/60"
                        >
                          <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                          <span>{t('adminPanel', 'Admin panel')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          handleTabClick('donor');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#6B7280] hover:text-[#064E3B] hover:bg-[#D1FAE5] min-h-[40px] flex items-center cursor-pointer"
                      >
                        {t('donorDashboard', 'Donor Dashboard')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTabClick('recipient');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#6B7280] hover:text-[#064E3B] hover:bg-[#D1FAE5] min-h-[40px] flex items-center cursor-pointer"
                      >
                        {t('recipientDashboard', 'Recipient Dashboard')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTabClick('courier');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#6B7280] hover:text-[#064E3B] hover:bg-[#D1FAE5] min-h-[40px] flex items-center cursor-pointer"
                      >
                        {t('courierLogistics', 'Courier Logistics')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTabClick('settings');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#6B7280] hover:text-[#064E3B] hover:bg-[#D1FAE5] min-h-[40px] flex items-center gap-2 cursor-pointer border-t border-[#E7E5E4]/60"
                      >
                        <span className="material-symbols-outlined text-[18px]">settings</span>
                        <span>{t('settings', 'Settings')}</span>
                      </button>
                    </div>

                    <div className="border-t border-[#E7E5E4]/60 pt-1">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2] min-h-[44px] flex items-center gap-1.5 font-medium cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span>{t('signOut', 'Sign Out')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTabClick('settings')}
                  title="Settings"
                  aria-label="Settings"
                  className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E7E5E4] bg-white text-[#6B7280] hover:text-[#064E3B] hover:bg-[#D1FAE5] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth()}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#059669] text-white hover:bg-[#047857] transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs"
                >
                  {t('signIn', 'Sign In')}
                </button>
              </div>
            )}
          </div>

          {/* Mobile Right Controls: Language Selector, Theme Toggle & Menu Button */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {/* Direct Mobile Language Changing Icon */}
            <LanguageSelector compact={true} />

            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#6B7280] dark:text-[#F0FDF8] hover:text-[#064E3B] dark:hover:text-white hover:bg-[#D1FAE5] dark:hover:bg-[#134025] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Mobile Menu Button (min 44px tap target) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="w-11 h-11 flex items-center justify-center rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#064E3B] dark:text-[#F0FDF8] hover:bg-[#D1FAE5] dark:hover:bg-[#134025] transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[24px]">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu (links stacked vertically, min 44px tap targets, Sign In at bottom) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E7E5E4] dark:border-[#1E5C38] bg-[#F0FDF8] dark:bg-[#071A12] px-4 py-3 space-y-1">
            {/* Mobile Top Utility Bar: Language & Notifications */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 dark:bg-[#0E1715]/70 border border-[#CFDED5] dark:border-[#233833] mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Language &amp; Alerts:</span>
              <div className="flex items-center gap-2">
                <LanguageSelector />
                <NotificationCenter
                  onNavigateTab={(tab) => {
                    setMobileMenuOpen(false);
                    handleTabClick(tab as any);
                  }}
                />
              </div>
            </div>

            {/* Primary Actions Group */}
            <div className="space-y-1">
              {/* 1. Home */}
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center cursor-pointer ${
                  activeTab === 'home' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                {t('home', 'Home')}
              </button>

              {/* 2. Browse Surplus */}
              <button
                type="button"
                onClick={() => handleTabClick('browse')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center cursor-pointer ${
                  activeTab === 'browse' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                {t('browse', 'Browse Surplus')}
              </button>

              {/* 3. Donor Portal */}
              <button
                type="button"
                onClick={() => handleTabClick('donor')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center cursor-pointer ${
                  activeTab === 'donor' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                {t('donor', 'Donor Portal')}
              </button>

              {/* 4. NGO Meal Requests */}
              <button
                type="button"
                onClick={() => handleTabClick('requests')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center justify-between cursor-pointer ${
                  activeTab === 'requests' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-purple-600">campaign</span>
                  <span>{t('requests', 'NGO Meal Requests')}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/20 text-purple-600 dark:text-purple-400">
                  New
                </span>
              </button>
            </div>

            {/* More Hubs & Services Group */}
            <div className="pt-2 mt-2 border-t border-[#E7E5E4] dark:border-[#1E5C38] space-y-1">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('more', 'More')} Hubs &amp; Services
              </div>

              {/* Recipient Dashboard */}
              <button
                type="button"
                onClick={() => handleTabClick('recipient')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center gap-2.5 cursor-pointer ${
                  activeTab === 'recipient' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-blue-600">storefront</span>
                <span>{t('recipient', 'Recipient Dashboard')}</span>
              </button>

              {/* Courier Logistics */}
              <button
                type="button"
                onClick={() => handleTabClick('courier')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center gap-2.5 cursor-pointer ${
                  activeTab === 'courier' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-600">local_shipping</span>
                <span>{t('courier', 'Courier Hub')}</span>
              </button>

              {/* Rescue Ledger */}
              <button
                type="button"
                onClick={() => handleTabClick('ledger')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center gap-2.5 cursor-pointer ${
                  activeTab === 'ledger' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-teal-600">receipt_long</span>
                <span>{t('ledger', 'Rescue Ledger')}</span>
              </button>

              {/* Impact Leaderboard */}
              <button
                type="button"
                onClick={() => handleTabClick('leaderboard')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center gap-2.5 cursor-pointer ${
                  activeTab === 'leaderboard' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-amber-600">leaderboard</span>
                <span>{t('leaderboard', 'Impact Leaderboard')}</span>
              </button>

              {/* Verification */}
              <button
                type="button"
                onClick={() => handleTabClick('verify')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center gap-2.5 cursor-pointer ${
                  activeTab === 'verify' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-indigo-600">verified</span>
                <span>{t('verify', 'Verification Standards')}</span>
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => handleTabClick('settings')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center gap-2.5 cursor-pointer ${
                  activeTab === 'settings' ? 'bg-[#D1FAE5] dark:bg-[#064E3B] text-[#059669] font-semibold' : 'text-[#064E3B] dark:text-[#E5E7EB]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-slate-500">settings</span>
                <span>{t('settings', 'Settings')}</span>
              </button>
            </div>

            {/* Sign In / Profile at bottom of mobile menu */}
            <div className="pt-3 border-t border-[#E7E5E4]">
              {currentUser ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 bg-white dark:bg-[#064E3B] rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38]">
                    <p className="text-sm font-bold text-[#064E3B]">
                      {userProfile?.displayName || currentUser.displayName || 'Member'}
                    </p>
                    <p className="text-xs text-[#059669] font-medium">
                      {getRoleDisplayName()}
                    </p>
                    <p className="text-xs text-[#6B7280] truncate">
                      {currentUser.email}
                    </p>
                  </div>
                  {userProfile?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleTabClick('admin');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#D1FAE5] text-[#059669] border border-[#059669]/30 min-h-[44px] text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                      <span>Admin panel</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 rounded-lg text-base font-medium border border-[#E7E5E4] text-[#DC2626] hover:bg-[#FEF2F2] min-h-[44px] text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>{t('signOut', 'Sign Out')}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenAuth()}
                  className="w-full px-4 py-3 rounded-lg text-base font-semibold bg-[#059669] text-white hover:bg-[#047857] min-h-[44px] text-center cursor-pointer"
                >
                  {t('signIn', 'Sign In')}
                </button>
              )}
            </div>
          </div>
        )}
      </header>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1">
        <ErrorBoundary key={activeTab} sectionName={activeTab} onReset={() => setActiveTab('home')}>
          <React.Suspense fallback={<LoadingFallback />}>
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="w-full">
            {/* AUTO-SCROLLING TOP DONORS PROMOTION TICKER */}
            <TopDonorsTicker
              onNavigateLeaderboard={() => handleTabClick('leaderboard')}
              onNavigateDonor={() => handleTabClick('donor')}
            />

            {/* HERO SECTION */}
            <HeroSection
              onDonateFood={() => handleTabClick('donor')}
              onClaimOrRegister={() => {
                if (!currentUser) {
                  handleOpenAuth('recipient');
                } else {
                  handleTabClick('browse');
                }
              }}
              onViewLeaderboard={() => handleTabClick('leaderboard')}
              isLoggedIn={!!currentUser}
              t={t}
            />

            {/* LEADERBOARD PREVIEW SECTION */}
            <section className="border-t border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#0A1F15] py-12 sm:py-16 lg:py-20">
              <div className="site-container">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D1FAE5] text-[#059669] border border-[#059669]/30 mb-2">
                      <span className="material-symbols-outlined text-[15px]">emoji_events</span>
                      <span>{t('communityHeroes', 'Community Heroes')}</span>
                    </div>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                      {t('topFoodDonors', 'Top Food Donors')}
                    </h2>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1 max-w-[55ch]">
                      {t('topDonorsSubtitle', 'Restaurants, caterers & volunteers making the biggest impact this week.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabClick('leaderboard')}
                    className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-sm transition-colors min-h-[44px] cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">leaderboard</span>
                    <span>{t('fullLeaderboard', 'Full Leaderboard')}</span>
                  </button>
                </div>

                {/* Top 5 donor cards */}
                <div className="space-y-3">
                  {SEED_LEADERBOARD_DONORS.slice(0, 5).map((donor, index) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const medal = medals[index];
                    const isChampion = index === 0;
                    return (
                      <div
                        key={donor.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          isChampion
                            ? 'bg-[#F0FDF8] dark:bg-[#1A3828] border-[#059669] shadow-md'
                            : 'bg-white dark:bg-[#0D2416] border-[#E7E5E4] dark:border-[#1E5C38] hover:border-[#059669]/40'
                        }`}
                      >
                        {/* Rank */}
                        <div className="w-10 shrink-0 flex items-center justify-center">
                          {medal ? (
                            <span className="text-2xl">{medal}</span>
                          ) : (
                            <span className="text-base font-black text-[#6B7280] dark:text-[#9CA3AF]">#{index + 1}</span>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-lg bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] flex items-center justify-center font-bold text-sm shrink-0">
                          {donor.orgName.charAt(0)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#064E3B] dark:text-[#F0FDF8] text-sm truncate">
                            {donor.orgName}
                          </div>
                          <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">
                            {donor.categoryLabel} · {donor.city}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="hidden sm:flex items-center gap-4 shrink-0 text-right">
                          <div>
                            <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('mealsRescuedLabel', 'Meals rescued')}</div>
                            <div className="font-bold text-[#064E3B] dark:text-[#F0FDF8] text-sm">{donor.totalPlates.toLocaleString()}</div>
                          </div>
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] font-bold text-sm">
                            <span className="material-symbols-outlined text-[15px]">stars</span>
                            <span>{donor.score.toLocaleString()} {t('pointsLabel', 'pts')}</span>
                          </div>
                        </div>

                        {/* Champion crown */}
                        {isChampion && (
                          <div className="shrink-0 hidden md:block">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#059669] text-white">
                              {t('champion', 'Champion')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* CTA bottom */}
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => handleTabClick('leaderboard')}
                    className="inline-flex items-center gap-2 text-base font-semibold text-[#059669] hover:text-[#047857] py-2 cursor-pointer"
                  >
                    <span>{t('seeAllDonors', 'See all donors & your rank')}</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </section>

            {/* HOW IT WORKS SECTION (Full-width background band, site-container inside, left steps, right supporting block) */}
            <section
              id="how-it-works-section"
              className="bg-[#D1FAE5] dark:bg-[#141210] border-y border-[#E7E5E4] dark:border-[#1E5C38] py-12 sm:py-16 lg:py-20"
            >
              <div className="site-container">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                  {/* Left half (steps 1, 2, 3) */}
                  <div className="lg:col-span-7">
                    <div className="mb-6">
                      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-2">
                        {t('howItWorksTitle', 'How it works in 3 steps')}
                      </h2>
                      <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] max-w-[65ch]">
                        {t('howItWorksSubtitle', 'Three steps from surplus to plate.')}
                      </p>
                    </div>

                    {/* Numbered vertical list with thin divider lines */}
                    <div className="divide-y divide-[#E7E5E4] dark:divide-[#1E5C38] border-y border-[#E7E5E4] dark:border-[#1E5C38]">
                      {/* Step 1 */}
                      <div className="py-5 sm:py-6 flex items-start gap-5 sm:gap-6">
                        <span className="font-serif text-3xl sm:text-4xl font-bold text-[#059669] w-8 sm:w-10 shrink-0 leading-none pt-0.5">
                          1
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
                            {t('step1Title', 'List surplus food')}
                          </h3>
                          <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed max-w-[65ch]">
                            {t('step1Desc', 'A donor adds what is available, the quantity, and the safe eating window.')}
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="py-5 sm:py-6 flex items-start gap-5 sm:gap-6">
                        <span className="font-serif text-3xl sm:text-4xl font-bold text-[#059669] w-8 sm:w-10 shrink-0 leading-none pt-0.5">
                          2
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
                            {t('step2Title', 'A verified organization claims it')}
                          </h3>
                          <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed max-w-[65ch]">
                            {t('step2Desc', 'Only approved NGOs, orphanages, and shelters can claim a listing.')}
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="py-5 sm:py-6 flex items-start gap-5 sm:gap-6">
                        <span className="font-serif text-3xl sm:text-4xl font-bold text-[#059669] w-8 sm:w-10 shrink-0 leading-none pt-0.5">
                          3
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
                            {t('step3Title', 'Pickup and confirmation')}
                          </h3>
                          <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed max-w-[65ch]">
                            {t('step3Desc', 'A courier or the organization collects the food and confirms delivery.')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right half (supporting block & photo placeholder so right side is not empty) */}
                  <div className="lg:col-span-5 w-full space-y-5 lg:sticky lg:top-24">
                    <div className="rounded-lg bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] p-6 sm:p-7">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-[#059669]/10 text-[#059669] flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        </span>
                        <h4 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8]">
                          {t('directInstitutionVerification', 'Direct institution verification')}
                        </h4>
                      </div>
                      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed mb-4 max-w-[65ch]">
                        {t(
                          'directVerificationDesc',
                          'Every charity on FoodLink is verified using valid government credentials (NGO Darpan, trust registration, or municipal permits) before claiming any food batches.'
                        )}
                      </p>
                      <div className="pt-3 border-t border-[#E7E5E4] dark:border-[#1E5C38] flex items-center justify-between text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        <span>{t('zeroFeeNetwork', 'Zero fee network')}</span>
                        <span className="font-semibold text-[#059669]">{t('volunteerNonProfit', '100% Volunteer & Non-Profit')}</span>
                      </div>
                    </div>

                    <div className="h-44 sm:h-52 rounded-lg bg-[#F0FDF8] dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] flex flex-col items-center justify-center text-center p-6 text-[#6B7280] dark:text-[#9CA3AF]">
                      <span className="material-symbols-outlined text-[32px] text-[#059669]/70 mb-2">
                        local_shipping
                      </span>
                      <span className="text-sm font-medium">{t('safeTransitOptions', 'Safe chilled & hot transit options')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* RECENT FOOD LISTINGS (4 cols on 2xl, 3 on lg, 2 on md, 1 on mobile) */}
            <section className="site-container py-12 sm:py-16 lg:py-20">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-2">
                    {t('recentFoodListings', 'Recent food listings')}
                  </h2>
                  <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] max-w-[65ch]">
                    {t('recentFoodListingsDesc', 'Current meals ready for pickup by verified organizations.')}
                  </p>
                </div>

                {/* Dietary Filter Buttons */}
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-lg self-start">
                  <button
                    type="button"
                    onClick={() => setDietaryFilter('all')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                      dietaryFilter === 'all'
                        ? 'bg-[#059669] text-white'
                        : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#064E3B] dark:hover:text-[#F0FDF8]'
                    }`}
                  >
                    {t('filterAll', 'All')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDietaryFilter('veg')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                      dietaryFilter === 'veg'
                        ? 'bg-[#059669] text-white'
                        : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#064E3B] dark:hover:text-[#F0FDF8]'
                    }`}
                  >
                    {t('pureVeg', 'Pure Veg')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDietaryFilter('non-veg')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                      dietaryFilter === 'non-veg'
                        ? 'bg-[#059669] text-white'
                        : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#064E3B] dark:hover:text-[#F0FDF8]'
                    }`}
                  >
                    {t('nonVeg', 'Non-Veg')}
                  </button>
                </div>
              </div>

              {loadingListings ? (
                <div className="py-12 text-center text-[#6B7280] dark:text-[#9CA3AF] text-base">
                  {t('loadingListings', 'Loading available food listings...')}
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="p-8 text-center rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B]">
                  <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] mb-3">
                    {t('noListingsFound', 'No active listings matching your selection right now.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTabClick('donor')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#059669] text-white font-medium text-sm hover:bg-[#047857] min-h-[44px] cursor-pointer"
                  >
                    {t('postFirstListing', 'Post the first food listing')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {filteredListings.slice(0, 8).map((listing) => {
                    const isVeg =
                      typeof (listing as any).isVeg === 'boolean'
                        ? (listing as any).isVeg
                        : (listing as any).dietaryType
                        ? (listing as any).dietaryType === 'veg'
                        : !listing.title.toLowerCase().includes('chicken') &&
                          !listing.title.toLowerCase().includes('mutton') &&
                          !listing.title.toLowerCase().includes('fish') &&
                          !listing.title.toLowerCase().includes('meat') &&
                          !listing.title.toLowerCase().includes('egg') &&
                          !listing.title.toLowerCase().includes('non-veg');

                    return (
                      <div
                        key={listing.id}
                        className="bg-white dark:bg-[#064E3B] p-5 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] flex flex-col justify-between hover:border-[#059669]/50 transition-colors shadow-2xs"
                      >
                        <div>
                          {/* Tags */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border ${
                                isVeg
                                  ? 'bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] border-[#059669]/30'
                                  : 'bg-[#FEF2F2] dark:bg-[#450A0A] text-[#EA580C] border-[#EA580C]/30'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isVeg ? 'bg-[#059669]' : 'bg-[#EA580C]'
                                }`}
                              />
                              {isVeg ? t('pureVeg', 'Pure Veg') : t('nonVeg', 'Non-Veg')}
                            </span>
                            <span className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                              {listing.quantity} {listing.unit || t('portions', 'portions')}
                            </span>
                          </div>

                          <h3 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1.5 line-clamp-1">
                            {listing.title}
                          </h3>
                          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] line-clamp-2 mb-3 max-w-[65ch]">
                            {listing.notes || 'Packed fresh in clean, food-grade containers.'}
                          </p>

                          <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] space-y-1 mb-4 pt-2 border-t border-[#E7E5E4] dark:border-[#1E5C38]">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-[#6B7280] dark:text-[#9CA3AF]">
                                location_on
                              </span>
                              <span className="truncate">{listing.location || t('localKitchen', 'Local Kitchen')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-[#6B7280] dark:text-[#9CA3AF]">
                                schedule
                              </span>
                              <span>{t('pickupLabel', 'Pickup')}: {listing.pickupWindow}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTabClick('browse')}
                          className="w-full py-2.5 px-4 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#064E3B] dark:text-[#F0FDF8] hover:bg-[#D1FAE5] dark:hover:bg-[#134025] text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
                        >
                          {t('viewDetails', 'View details')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => handleTabClick('browse')}
                  className="inline-flex items-center gap-2 text-base font-semibold text-[#059669] hover:text-[#047857] py-2 cursor-pointer"
                >
                  <span>{t('browseAllListings', 'Browse all available listings')}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </section>

            {/* FREQUENTLY ASKED QUESTIONS SECTION */}
            <FaqSection />


            {/* SAFETY NOTE (Clean plain language, full-width container) */}
            <section className="border-t border-[#E7E5E4] dark:border-[#1E5C38] bg-[#F0FDF8] dark:bg-[#071A12] py-12 lg:py-16">
              <div className="site-container">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  <div className="lg:col-span-8">
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-3">
                      {t('foodSafetyChecksTitle', 'Food safety checks')}
                    </h3>
                    <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed mb-4 max-w-[65ch]">
                      {t(
                        'foodSafetyChecksDesc',
                        'Every food post lists the time it was cooked and the safe eating window. Receiving organizations check container seals and food temperatures before accepting any pickup.'
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTabClick('verify')}
                      className="text-sm font-semibold text-[#059669] hover:text-[#047857] underline cursor-pointer"
                    >
                      {t('readSafetyStandards', 'Read our safety standards and verification process')}
                    </button>
                  </div>
                  <div className="lg:col-span-4 p-5 rounded-lg bg-[#D1FAE5] dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] text-sm text-[#064E3B] dark:text-[#F0FDF8]">
                    <div className="flex items-center gap-2 font-bold mb-2">
                      <span className="material-symbols-outlined text-[18px] text-[#059669]">shield</span>
                      <span>{t('safeFoodGuidelines', 'Safe Food Guidelines')}</span>
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                      {t(
                        'goodSamaritanNote',
                        'Food donations are protected under statutory Good Samaritan provisions, encouraging safe food redistribution.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: BROWSE (Open to everyone) */}
        {activeTab === 'browse' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B]">
                  {t('availableFoodListings', 'Available food listings')}
                </h1>
                <p className="text-sm text-[#6B7280]">
                  {t('browseFoodSubtitle', 'Browse active surplus food. Sign in to claim meals for your registered shelter.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              >
                {t('backToHome', 'Back to Home')}
              </button>
            </div>
            <RecipientDashboard
              onOpenAuth={() => handleOpenAuth('recipient')}
              onOpenCsrModal={handleOpenCsrModal}
              onOpenTracker={handleOpenCourierTracker}
              onNavigateRequests={() => handleTabClick('requests')}
              onNavigateDonor={() => handleTabClick('donor')}
            />
          </div>
        )}

        {/* TAB 3: DONOR (Protected - Sign-in required) */}
        {activeTab === 'donor' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B]">
                  Donor Portal
                </h1>
                <p className="text-sm text-[#6B7280]">
                  Publish food surplus batches for immediate pickup by verified shelters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              >
                {t('backToHome', 'Back to Home')}
              </button>
            </div>
            <DonorDashboard
              onOpenAuth={() => handleOpenAuth('donor')}
              onNavigateBrowse={() => handleTabClick('browse')}
              onNavigateLedger={() => handleTabClick('ledger')}
              onOpenCsrModal={handleOpenCsrModal}
              onOpenTracker={handleOpenCourierTracker}
              onNavigateRequests={() => handleTabClick('requests')}
            />
          </div>
        )}

        {/* TAB: RECIPIENT DASHBOARD (Protected - Sign-in required) */}
        {activeTab === 'recipient' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B]">
                  Recipient Dashboard
                </h1>
                <p className="text-sm text-[#6B7280]">
                  Manage claimed surplus food batches, pickup verification codes, and collection schedules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              >
                {t('backToHome', 'Back to Home')}
              </button>
            </div>
            <RecipientDashboard
              initialView="my_claims"
              onOpenAuth={() => handleOpenAuth('recipient')}
              onOpenCsrModal={handleOpenCsrModal}
              onOpenTracker={handleOpenCourierTracker}
              onNavigateRequests={() => handleTabClick('requests')}
              onNavigateDonor={() => handleTabClick('donor')}
            />
          </div>
        )}

        {/* TAB 4: COURIER (Protected - Sign-in required) */}
        {activeTab === 'courier' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B]">
                  Volunteer Courier Hub
                </h1>
                <p className="text-sm text-[#6B7280]">
                  Pick up inspected surplus food and deliver it to nearby shelters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              >
                {t('backToHome', 'Back to Home')}
              </button>
            </div>
            <VolunteerLogistics
              selectedCityId="mumbai"
              onSelectCity={() => {}}
              onOpenAuth={() => handleOpenAuth('volunteer')}
              onNavigateVerify={() => handleTabClick('verify')}
              onOpenCsrModal={handleOpenCsrModal}
            />
          </div>
        )}

        {/* TAB 5: VERIFY (Open to everyone) */}
        {activeTab === 'verify' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B]">
                  Verification
                </h1>
                <p className="text-sm text-[#6B7280]">
                  Standards and requirements for food donors and recipient organizations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              >
                {t('backToHome', 'Back to Home')}
              </button>
            </div>
            <VerificationModule
              onOpenAuth={() => handleOpenAuth()}
              onNavigateDonor={() => handleTabClick('donor')}
              onNavigateRecipient={() => handleTabClick('browse')}
            />
          </div>
        )}

        {/* TAB 6: LEDGER (Protected - Sign-in required) */}
        {activeTab === 'ledger' && (
          <div className="site-container py-8 sm:py-10">
            <RescueLedgerLeaderboard
              onOpenAuth={(role) => handleOpenAuth(role)}
              onNavigateTab={(tab) =>
                handleTabClick(
                  tab === 'volunteer' ? 'courier' : tab === 'donate' ? 'donor' : (tab as TabType)
                )
              }
              onNavigateDonor={() => handleTabClick('donor')}
              onOpenCsrModal={handleOpenCsrModal}
            />
          </div>
        )}

        {/* TAB: NGO MEAL REQUESTS (Reverse Food Rescue Listings) */}
        {activeTab === 'requests' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              >
                {t('backToHome', 'Back to Home')}
              </button>
            </div>
            <NgoMealRequests
              onOpenAuth={(role) => handleOpenAuth(role)}
              onNavigateDonor={() => handleTabClick('donor')}
            />
          </div>
        )}

        {/* TAB: LEADERBOARD (Public - Open to all) */}
        {activeTab === 'leaderboard' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#6B7280] hover:text-[#064E3B] cursor-pointer"
              >
                {t('backToHome', 'Back to Home')}
              </button>
            </div>
            <Leaderboard
              onNavigateDonor={() => handleTabClick('donor')}
              onOpenAuth={(role) => handleOpenAuth(role)}
            />
          </div>
        )}

        {/* TAB 7: ADMIN PANEL (Route /admin, admin role required) */}
        {activeTab === 'admin' && (
          <AdminPanel onNavigateHome={() => handleTabClick('home')} />
        )}

        {/* TAB 8: ADMIN SIGN IN (Route /admin-login) */}
        {activeTab === 'admin-login' && (
          <AdminLoginPage
            onSuccessAdmin={() => handleTabClick('admin')}
            onNavigateHome={() => handleTabClick('home')}
          />
        )}

        {/* TAB 9: SETTINGS (Route /settings) */}
        {activeTab === 'settings' && (
          <SettingsPage
            onOpenAuth={(role) => handleOpenAuth(role)}
            onNavigateHome={() => handleTabClick('home')}
            onNavigateBrowse={() => handleTabClick('browse')}
          />
        )}

        {/* TAB: PRIVACY POLICY (Route /privacy or #privacy) */}
        {activeTab === 'privacy' && (
          <LegalPage type="privacy" onNavigateHome={() => handleTabClick('home')} />
        )}

        {/* TAB: TERMS OF SERVICE (Route /terms or #terms) */}
        {activeTab === 'terms' && (
          <LegalPage type="terms" onNavigateHome={() => handleTabClick('home')} />
        )}

        {/* TAB: 404 NOT FOUND */}
        {activeTab === '404' && (
          <NotFoundPage onNavigateHome={() => handleTabClick('home')} />
        )}
          </React.Suspense>
        </ErrorBoundary>
      </main>

      {/* FOOTER */}
      {activeTab !== 'admin' && (
        <Footer
          onNavigate={handleTabClick}
          isAdminLoggedIn={Boolean(currentUser && userProfile?.role === 'admin')}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialRole={authModalInitialRole}
        initialStep={authModalInitialStep}
        onSuccessRoute={(role) => {
          if (pendingRedirectTab) {
            handleTabClick(pendingRedirectTab);
            setPendingRedirectTab(null);
          } else if (role === 'admin') {
            handleTabClick('admin');
          } else if (role === 'volunteer') {
            handleTabClick('courier');
          } else if (role === 'donor') {
            handleTabClick('donor');
          } else if (role === 'recipient') {
            handleTabClick('recipient');
          }
        }}
        onOpenAdminLogin={() => {
          setIsAuthModalOpen(false);
          handleTabClick('admin-login');
        }}
      />

      {/* Terms and Privacy Policy Modal */}
      <TermsPolicyModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />

      {/* 80G CSR Impact Certificate Modal */}
      {csrModalOpen && (
        <React.Suspense fallback={null}>
          <CsrReportModal
            isOpen={csrModalOpen}
            onClose={() => setCsrModalOpen(false)}
            listing={selectedCsrListing}
          />
        </React.Suspense>
      )}

      {/* Real-Time Live Courier GPS Tracker Modal */}
      {courierTrackerOpen && activeCourierMission && (
        <RealTimeCourierTracker
          isModal
          mission={activeCourierMission}
          onClose={() => setCourierTrackerOpen(false)}
          onStatusChange={(newStatus) => {
            if (activeCourierMission) {
              setActiveCourierMission({ ...activeCourierMission, status: newStatus });
            }
          }}
        />
      )}

      {/* PWA Mobile Installation Prompt & Offline Banner */}
      <PwaInstallPrompt />

      {/* Floating Back to Top Button */}
      {showBackToTopBtn && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-[#059669] text-white shadow-lg flex items-center justify-center hover:bg-[#047857] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#059669]"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_upward</span>
        </button>
      )}

      {/* Cookie Consent Banner */}
      <CookieNotice />
    </div>
  );
}

