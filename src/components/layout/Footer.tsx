import React from 'react';
import { TabType } from '../../app/App';
import { FoodLinkLogo } from '../common/FoodLinkLogo';
import { useLanguage } from '../../lib/i18n';

interface FooterProps {
  onNavigate: (tab: TabType) => void;
  isAdminLoggedIn?: boolean;
}

export function Footer({ onNavigate, isAdminLoggedIn = false }: FooterProps) {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-[#E7E5E4] dark:border-[#1E5C38] bg-[#F0FDF8] dark:bg-[#071A12] mt-16 py-12 lg:py-16">
      <div className="site-container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-10">
          {/* Column 1: About */}
          <div>
            <div className="mb-3">
              <FoodLinkLogo size={30} variant="badge" showWordmark={true} textSize="base" />
            </div>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed max-w-[65ch]">
              {t('footerMission', 'FoodLink connects restaurants and wedding venues with verified orphanages, care homes, and community shelters across India to share extra food safely.')}
            </p>
            <div className="mt-3.5">
              <button
                type="button"
                onClick={() => onNavigate('leaderboard')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">leaderboard</span>
                <span>{t('leaderboard', 'Impact Leaderboard')}</span>
              </button>
            </div>
          </div>

          {/* Column 2: Legal */}
          <div>
            <h4 className="font-serif text-base font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-3">
              {t('legal', 'Legal')}
            </h4>
            <ul className="space-y-2 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('privacy')}
                  className="hover:text-[#064E3B] dark:hover:text-[#F0FDF8] transition-colors cursor-pointer"
                >
                  {t('privacyPolicy', 'Privacy Policy')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('terms')}
                  className="hover:text-[#064E3B] dark:hover:text-[#F0FDF8] transition-colors cursor-pointer"
                >
                  {t('termsOfService', 'Terms of Service')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="hover:text-[#064E3B] dark:hover:text-[#F0FDF8] transition-colors cursor-pointer"
                >
                  {t('settings', 'Settings')}
                </button>
              </li>
              <li>
                <span className="text-[#6B7280] dark:text-[#9CA3AF]">{t('safeFoodGuaranteeTitle', 'FSSAI Good Samaritan Guidelines')}</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h4 className="font-serif text-base font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              <li>Email: support@foodlink.org</li>
              <li>Offices: Mumbai, Bengaluru, Delhi NCR</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-[#E7E5E4] dark:border-[#1E5C38] flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7280] dark:text-[#9CA3AF] gap-3">
          <div className="flex items-center gap-3">
            <span>© 2026 FoodLink India. {t('allRightsReserved', 'All rights reserved.')}</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => onNavigate(isAdminLoggedIn ? 'admin' : 'admin-login')}
              className="text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#064E3B] dark:hover:text-white transition-colors cursor-pointer underline underline-offset-2"
            >
              {t('adminPanel', 'Admin login')}
            </button>
          </div>
          <span>Food handling follows safety guidelines from the Food Safety and Standards Authority of India.</span>
        </div>
      </div>
    </footer>
  );
}
