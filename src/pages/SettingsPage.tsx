import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { INDIAN_CITIES } from '../lib/cities';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  useSettings,
  DeviceSettings,
} from '../lib/settingsStorage';

export interface SettingsPageProps {
  onOpenAuth: (role?: 'donor' | 'recipient') => void;
  onNavigateHome: () => void;
  onNavigateBrowse: () => void;
}

type SectionKey =
  | 'appearance'
  | 'accessibility'
  | 'map'
  | 'notifications'
  | 'privacy'
  | 'account';

interface NotificationPreferences {
  claimedEmail: boolean;
  newListingCityEmail: boolean;
  verificationChangeEmail: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  claimedEmail: true,
  newListingCityEmail: false,
  verificationChangeEmail: true,
};

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onOpenAuth,
  onNavigateHome,
}) => {
  const { currentUser, userProfile, setUserProfile, resetPassword, signOut } = useAuth();
  const { settings, updateSetting, resetAll, clearDevice, lastSaved } = useSettings();

  const [activeSection, setActiveSection] = useState<SectionKey>('appearance');
  const [expandedMobileSections, setExpandedMobileSections] = useState<Record<SectionKey, boolean>>({
    appearance: true,
    accessibility: false,
    map: false,
    notifications: false,
    privacy: false,
    account: false,
  });

  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  // Account editing state
  const [accountName, setAccountName] = useState(userProfile?.displayName || '');
  const [accountPhone, setAccountPhone] = useState(userProfile?.phone || '');
  const [accountAddress, setAccountAddress] = useState(userProfile?.address || userProfile?.city || '');
  const [accountSaveStatus, setAccountSaveStatus] = useState<string | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [passwordResetStatus, setPasswordResetStatus] = useState<string | null>(null);

  // Notification preferences state (synced with userProfile)
  const [notifications, setNotifications] = useState<NotificationPreferences>(() => {
    const raw = (userProfile as any)?.notificationPreferences;
    return {
      claimedEmail: raw?.claimedEmail ?? DEFAULT_NOTIFICATIONS.claimedEmail,
      newListingCityEmail: raw?.newListingCityEmail ?? DEFAULT_NOTIFICATIONS.newListingCityEmail,
      verificationChangeEmail: raw?.verificationChangeEmail ?? DEFAULT_NOTIFICATIONS.verificationChangeEmail,
    };
  });

  // Sync account form with profile updates
  useEffect(() => {
    if (userProfile) {
      setAccountName(userProfile.displayName || '');
      setAccountPhone(userProfile.phone || '');
      setAccountAddress(userProfile.address || userProfile.city || '');
      const raw = (userProfile as any)?.notificationPreferences;
      if (raw) {
        setNotifications({
          claimedEmail: raw.claimedEmail ?? DEFAULT_NOTIFICATIONS.claimedEmail,
          newListingCityEmail: raw.newListingCityEmail ?? DEFAULT_NOTIFICATIONS.newListingCityEmail,
          verificationChangeEmail: raw.verificationChangeEmail ?? DEFAULT_NOTIFICATIONS.verificationChangeEmail,
        });
      }
    }
  }, [userProfile]);

  // Flash saved notification
  useEffect(() => {
    if (!lastSaved) return;
    setShowSavedFeedback(true);
    const timer = setTimeout(() => setShowSavedFeedback(false), 2200);
    return () => clearTimeout(timer);
  }, [lastSaved]);

  const toggleMobileSection = (key: SectionKey) => {
    setExpandedMobileSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Save notification preferences to profile
  const handleNotificationChange = async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);

    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { notificationPreferences: updated }, { merge: true });
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          notificationPreferences: updated,
        } as any);
      }
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 2200);
    } catch (err) {
      console.error('Error saving notification preferences:', err);
    }
  };

  // Save account information
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setAccountSaving(true);
    setAccountSaveStatus(null);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updates = {
        displayName: accountName.trim(),
        phone: accountPhone.trim(),
        address: accountAddress.trim(),
      };
      await setDoc(userRef, updates, { merge: true });

      if (userProfile) {
        setUserProfile({
          ...userProfile,
          ...updates,
        });
      }

      setAccountSaveStatus('Account details updated successfully.');
      setTimeout(() => setAccountSaveStatus(null), 3500);
    } catch (err: any) {
      console.error('Error updating account:', err);
      setAccountSaveStatus('Failed to update details. Please try again.');
    } finally {
      setAccountSaving(false);
    }
  };

  // Password reset email request
  const handlePasswordReset = async () => {
    if (!currentUser?.email) {
      setPasswordResetStatus('No email address associated with this account.');
      return;
    }

    try {
      await resetPassword(currentUser.email);
      setPasswordResetStatus(`Password reset instructions sent to ${currentUser.email}.`);
      setTimeout(() => setPasswordResetStatus(null), 5000);
    } catch (err: any) {
      console.error('Error sending reset email:', err);
      setPasswordResetStatus('Could not send reset email. Please try again shortly.');
    }
  };

  // Confirm delete account
  const handleConfirmDeleteAccount = async () => {
    try {
      await signOut();
      setShowDeleteAccountModal(false);
      onNavigateHome();
    } catch (err) {
      console.error('Error during account deletion sign out:', err);
      setShowDeleteAccountModal(false);
    }
  };

  const isOrganization =
    userProfile?.role === 'ngo' ||
    userProfile?.role === 'recipient' ||
    Boolean(userProfile?.recipientType);

  const sectionsList: Array<{ key: SectionKey; label: string; icon: string; signedInOnly?: boolean }> = [
    { key: 'appearance', label: 'Appearance', icon: 'palette' },
    { key: 'accessibility', label: 'Accessibility', icon: 'accessibility_new' },
    { key: 'map', label: 'Map and browsing', icon: 'map' },
    { key: 'notifications', label: 'Notifications', icon: 'notifications', signedInOnly: true },
    { key: 'privacy', label: 'Privacy', icon: 'lock' },
    { key: 'account', label: 'Account', icon: 'person', signedInOnly: true },
  ];

  const visibleSections = sectionsList.filter(
    (sec) => !sec.signedInOnly || Boolean(currentUser)
  );

  return (
    <div className="site-container py-8 sm:py-10">
      {/* Top Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] flex items-center justify-center font-bold text-sm">
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B] dark:text-[#F0FDF8]">
              Settings
            </h1>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Manage your interface appearance, accessibility, map browsing, and personal preferences.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {showSavedFeedback && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] text-xs font-semibold border border-[#E7E5E4] dark:border-[#1E5C38]">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Saved</span>
            </span>
          )}

          <button
            type="button"
            onClick={onNavigateHome}
            className="px-3.5 py-2 text-sm font-medium rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] hover:bg-[#D1FAE5] dark:hover:bg-[#134025] transition-colors cursor-pointer min-h-[44px]"
          >
            Back to Home
          </button>
        </div>
      </div>

      {/* Main Grid: Desktop 2 Columns, Mobile Accordion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* DESKTOP LEFT SIDEBAR (>= 1024px) */}
        <aside className="hidden lg:block lg:col-span-4 bg-white dark:bg-[#064E3B] rounded-xl border border-[#E7E5E4] dark:border-[#1E5C38] p-3 space-y-1">
          {visibleSections.map((sec) => {
            const isActive = activeSection === sec.key;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveSection(sec.key)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer min-h-[44px] ${
                  isActive
                    ? 'bg-[#D1FAE5] dark:bg-[#134025] text-[#059669] font-semibold'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#064E3B] dark:hover:text-[#F0FDF8] hover:bg-[#F0FDF8] dark:hover:bg-[#134025]/50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{sec.icon}</span>
                <span>{sec.label}</span>
              </button>
            );
          })}

          {!currentUser && (
            <div className="mt-4 pt-4 border-t border-[#E7E5E4] dark:border-[#1E5C38] px-3 py-2">
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">
                Sign in to manage your account details and notification alerts.
              </p>
              <button
                type="button"
                onClick={() => onOpenAuth()}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-[#059669] text-white hover:bg-[#047857] transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
              >
                Sign In
              </button>
            </div>
          )}
        </aside>

        {/* DESKTOP RIGHT CONTENT AREA (>= 1024px) */}
        <main className="hidden lg:block lg:col-span-8 bg-white dark:bg-[#064E3B] rounded-xl border border-[#E7E5E4] dark:border-[#1E5C38] p-6 sm:p-8">
          {activeSection === 'appearance' && (
            <AppearanceSection settings={settings} updateSetting={updateSetting} />
          )}

          {activeSection === 'accessibility' && (
            <AccessibilitySection settings={settings} updateSetting={updateSetting} />
          )}

          {activeSection === 'map' && (
            <MapBrowsingSection settings={settings} updateSetting={updateSetting} />
          )}

          {activeSection === 'notifications' && currentUser && (
            <NotificationsSection
              notifications={notifications}
              onNotificationChange={handleNotificationChange}
              isOrganization={isOrganization}
            />
          )}

          {activeSection === 'privacy' && (
            <PrivacySection
              settings={settings}
              updateSetting={updateSetting}
              onClearDevicePrompt={() => setShowClearConfirm(true)}
            />
          )}

          {activeSection === 'account' && currentUser && (
            <AccountSection
              name={accountName}
              setName={setAccountName}
              phone={accountPhone}
              setPhone={setAccountPhone}
              address={accountAddress}
              setAddress={setAccountAddress}
              onSave={handleSaveAccount}
              saving={accountSaving}
              saveStatus={accountSaveStatus}
              email={currentUser.email || ''}
              onPasswordReset={handlePasswordReset}
              passwordResetStatus={passwordResetStatus}
              onDeletePrompt={() => setShowDeleteAccountModal(true)}
            />
          )}
        </main>

        {/* MOBILE STACKED ACCORDION VIEW (< 1024px) */}
        <div className="block lg:hidden col-span-1 space-y-4">
          {visibleSections.map((sec) => {
            const isExpanded = expandedMobileSections[sec.key];
            return (
              <div
                key={sec.key}
                className="bg-white dark:bg-[#064E3B] rounded-xl border border-[#E7E5E4] dark:border-[#1E5C38] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleMobileSection(sec.key)}
                  aria-expanded={isExpanded}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 text-base font-bold text-[#064E3B] dark:text-[#F0FDF8] cursor-pointer min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] text-[#059669]">
                      {sec.icon}
                    </span>
                    <span>{sec.label}</span>
                  </div>
                  <span className="material-symbols-outlined text-[20px] text-[#6B7280] dark:text-[#9CA3AF]">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-[#E7E5E4] dark:border-[#1E5C38]">
                    {sec.key === 'appearance' && (
                      <AppearanceSection settings={settings} updateSetting={updateSetting} />
                    )}
                    {sec.key === 'accessibility' && (
                      <AccessibilitySection settings={settings} updateSetting={updateSetting} />
                    )}
                    {sec.key === 'map' && (
                      <MapBrowsingSection settings={settings} updateSetting={updateSetting} />
                    )}
                    {sec.key === 'notifications' && currentUser && (
                      <NotificationsSection
                        notifications={notifications}
                        onNotificationChange={handleNotificationChange}
                        isOrganization={isOrganization}
                      />
                    )}
                    {sec.key === 'privacy' && (
                      <PrivacySection
                        settings={settings}
                        updateSetting={updateSetting}
                        onClearDevicePrompt={() => setShowClearConfirm(true)}
                      />
                    )}
                    {sec.key === 'account' && currentUser && (
                      <AccountSection
                        name={accountName}
                        setName={setAccountName}
                        phone={accountPhone}
                        setPhone={setAccountPhone}
                        address={accountAddress}
                        setAddress={setAccountAddress}
                        onSave={handleSaveAccount}
                        saving={accountSaving}
                        saveStatus={accountSaveStatus}
                        email={currentUser.email || ''}
                        onPasswordReset={handlePasswordReset}
                        passwordResetStatus={passwordResetStatus}
                        onDeletePrompt={() => setShowDeleteAccountModal(true)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Controls: Reset All Settings to Default */}
      <div className="mt-10 pt-6 border-t border-[#E7E5E4] dark:border-[#1E5C38] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#064E3B] dark:text-[#F0FDF8]">
            Reset preferences
          </h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Restore all display, accessibility, and browsing settings back to their default values.
          </p>
        </div>

        {!showResetConfirm ? (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#DC2626]/10 transition-colors cursor-pointer min-h-[44px]"
          >
            Reset all settings to default
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#064E3B] dark:text-[#F0FDF8]">Confirm reset?</span>
            <button
              type="button"
              onClick={() => {
                resetAll();
                setShowResetConfirm(false);
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#DC2626] text-white hover:bg-[#92400E] transition-colors cursor-pointer min-h-[44px]"
            >
              Yes, reset all
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#6B7280] hover:text-[#064E3B] dark:text-[#9CA3AF] dark:hover:text-white transition-colors cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Clear Device Settings */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-2">
              Clear saved settings on this device
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6 leading-relaxed">
              This will remove all stored theme, accessibility, and browsing choices from your local browser storage.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#6B7280] hover:text-[#064E3B] dark:text-[#9CA3AF] dark:hover:text-white cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearDevice();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#DC2626] text-white hover:bg-[#92400E] cursor-pointer min-h-[44px]"
              >
                Clear settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Account */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-[#DC2626]/15 text-[#DC2626] flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-2">
              Delete your account
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6 leading-relaxed">
              Are you sure you want to delete your account? This action cannot be reversed and you will be signed out immediately.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#6B7280] hover:text-[#064E3B] dark:text-[#9CA3AF] dark:hover:text-white cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#DC2626] text-white hover:bg-[#92400E] cursor-pointer min-h-[44px]"
              >
                Yes, delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== SECTION 1: APPEARANCE ====================
function AppearanceSection({
  settings,
  updateSetting,
}: {
  settings: DeviceSettings;
  updateSetting: <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <h2 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
          Appearance
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Customize the color mode, reading scale, and display density of FoodLink.
        </p>
      </div>

      <div className="divide-y divide-[#E7E5E4] dark:divide-[#1E5C38]">
        {/* Theme */}
        <SettingRow
          label="Theme"
          description="Choose light mode, dark mode, or follow your operating system appearance."
        >
          <select
            id="setting-theme"
            value={settings.theme}
            onChange={(e) => updateSetting('theme', e.target.value as DeviceSettings['theme'])}
            aria-label="Theme"
            className="h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer min-w-[140px]"
          >
            <option value="light">Light (default)</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </SettingRow>

        {/* Text size */}
        <SettingRow
          label="Text size"
          description="Scale typography across all headings, cards, and labels for easier reading."
        >
          <select
            id="setting-text-size"
            value={settings.textSize}
            onChange={(e) => updateSetting('textSize', e.target.value as DeviceSettings['textSize'])}
            aria-label="Text size"
            className="h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer min-w-[140px]"
          >
            <option value="normal">Normal (default)</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra large</option>
          </select>
        </SettingRow>

        {/* Compact lists */}
        <SettingRow
          label="Compact lists"
          description="Decrease vertical padding between rows in lists and tables to show more items at once."
        >
          <AccessibleToggle
            id="setting-compact-lists"
            label="Compact lists"
            checked={settings.compactLists}
            onChange={(checked) => updateSetting('compactLists', checked)}
          />
        </SettingRow>
      </div>
    </div>
  );
}

// ==================== SECTION 2: ACCESSIBILITY ====================
function AccessibilitySection({
  settings,
  updateSetting,
}: {
  settings: DeviceSettings;
  updateSetting: <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <h2 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
          Accessibility
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Adjust motion, contrast, and link indicators to match your browsing comfort.
        </p>
      </div>

      <div className="divide-y divide-[#E7E5E4] dark:divide-[#1E5C38]">
        {/* Reduce motion */}
        <SettingRow
          label="Reduce motion"
          description="Disable page transitions, animated pulses, and decorative interface effects."
        >
          <AccessibleToggle
            id="setting-reduce-motion"
            label="Reduce motion"
            checked={settings.reduceMotion}
            onChange={(checked) => updateSetting('reduceMotion', checked)}
          />
        </SettingRow>

        {/* High contrast */}
        <SettingRow
          label="High contrast"
          description="Increase the contrast between text, borders, and background surfaces."
        >
          <AccessibleToggle
            id="setting-high-contrast"
            label="High contrast"
            checked={settings.highContrast}
            onChange={(checked) => updateSetting('highContrast', checked)}
          />
        </SettingRow>

        {/* Underline links */}
        <SettingRow
          label="Underline links"
          description="Add a permanent underline to text links to make interactive elements clearer."
        >
          <AccessibleToggle
            id="setting-underline-links"
            label="Underline links"
            checked={settings.underlineLinks}
            onChange={(checked) => updateSetting('underlineLinks', checked)}
          />
        </SettingRow>
      </div>
    </div>
  );
}

// ==================== SECTION 3: MAP AND BROWSING ====================
function MapBrowsingSection({
  settings,
  updateSetting,
}: {
  settings: DeviceSettings;
  updateSetting: <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <h2 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
          Map and browsing
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Set your default city, discovery radius, layout format, and pagination limit for food listings.
        </p>
      </div>

      <div className="divide-y divide-[#E7E5E4] dark:divide-[#1E5C38]">
        {/* Default city */}
        <SettingRow
          label="Default city"
          description="Select which metropolitan area to display when opening the surplus food feed."
        >
          <select
            id="setting-default-city"
            value={settings.defaultCity}
            onChange={(e) => updateSetting('defaultCity', e.target.value)}
            aria-label="Default city"
            className="h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer min-w-[170px]"
          >
            {INDIAN_CITIES.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </SettingRow>

        {/* Default distance filter */}
        <SettingRow
          label="Default distance filter"
          description="Filter available food listings within this radius from your center point."
        >
          <select
            id="setting-default-distance"
            value={settings.defaultDistance}
            onChange={(e) => updateSetting('defaultDistance', Number(e.target.value))}
            aria-label="Default distance filter"
            className="h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer min-w-[140px]"
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
          </select>
        </SettingRow>

        {/* Default view for Browse */}
        <SettingRow
          label="Default view for Browse"
          description="Choose whether to load the listings as a card list or an interactive map first."
        >
          <select
            id="setting-default-browse-view"
            value={settings.defaultBrowseView}
            onChange={(e) => updateSetting('defaultBrowseView', e.target.value as 'list' | 'map')}
            aria-label="Default view for Browse"
            className="h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer min-w-[140px]"
          >
            <option value="list">List</option>
            <option value="map">Map</option>
          </select>
        </SettingRow>

        {/* Items per page */}
        <SettingRow
          label="Items per page"
          description="Set the number of surplus food cards displayed on each page in the Browse view."
        >
          <select
            id="setting-items-per-page"
            value={settings.itemsPerPage}
            onChange={(e) => updateSetting('itemsPerPage', Number(e.target.value))}
            aria-label="Items per page"
            className="h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer min-w-[140px]"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </SettingRow>

        {/* Show Back to top button */}
        <SettingRow
          label="Show Back to top button"
          description="Display a floating shortcut button in the corner when scrolling down long pages."
        >
          <AccessibleToggle
            id="setting-back-to-top"
            label="Show Back to top button"
            checked={settings.showBackToTop}
            onChange={(checked) => updateSetting('showBackToTop', checked)}
          />
        </SettingRow>
      </div>
    </div>
  );
}

// ==================== SECTION 4: NOTIFICATIONS ====================
function NotificationsSection({
  notifications,
  onNotificationChange,
  isOrganization,
}: {
  notifications: NotificationPreferences;
  onNotificationChange: (key: keyof NotificationPreferences, value: boolean) => void;
  isOrganization: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <h2 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
          Notifications
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Configure automated email alerts for food claims, new surplus batches, and verification status updates.
        </p>
      </div>

      {/* Info notice about email sending */}
      <div className="p-4 rounded-lg bg-[#D1FAE5] dark:bg-[#134025] border border-[#E7E5E4] dark:border-[#1E5C38] text-xs text-[#064E3B] dark:text-[#F0FDF8] flex items-start gap-2.5">
        <span className="material-symbols-outlined text-[18px] text-[#059669] shrink-0 mt-0.5">
          info
        </span>
        <div>
          <p className="font-semibold mb-0.5">Preferences saved to profile</p>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            Email sending is not active yet. Your choices are saved to your account and will take effect once email dispatch is turned on.
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#E7E5E4] dark:divide-[#1E5C38]">
        {/* Listing claimed */}
        <SettingRow
          label="Email me when my listing is claimed"
          description="Receive an email notice when a registered shelter reserves one of your posted food batches."
        >
          <AccessibleToggle
            id="setting-notif-claimed"
            label="Email me when my listing is claimed"
            checked={notifications.claimedEmail}
            onChange={(checked) => onNotificationChange('claimedEmail', checked)}
          />
        </SettingRow>

        {/* New listing in city (organizations only) */}
        <SettingRow
          label="Email me when a new listing appears in my city"
          description={
            isOrganization
              ? 'Receive an alert as soon as a donor posts new surplus meals within your selected city.'
              : 'Available for registered shelter and NGO accounts to monitor newly posted food batches.'
          }
        >
          <AccessibleToggle
            id="setting-notif-new-listing"
            label="Email me when a new listing appears in my city"
            checked={notifications.newListingCityEmail}
            onChange={(checked) => onNotificationChange('newListingCityEmail', checked)}
            disabled={!isOrganization}
          />
        </SettingRow>

        {/* Verification status changed */}
        <SettingRow
          label="Email me when my verification status changes"
          description="Receive an immediate notification once an administrator reviews your submitted organization documents."
        >
          <AccessibleToggle
            id="setting-notif-verification"
            label="Email me when my verification status changes"
            checked={notifications.verificationChangeEmail}
            onChange={(checked) => onNotificationChange('verificationChangeEmail', checked)}
          />
        </SettingRow>
      </div>
    </div>
  );
}

// ==================== SECTION 5: PRIVACY ====================
function PrivacySection({
  settings,
  updateSetting,
  onClearDevicePrompt,
}: {
  settings: DeviceSettings;
  updateSetting: <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => void;
  onClearDevicePrompt: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <h2 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
          Privacy
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Control storage choices and cookie preferences used on this device.
        </p>
      </div>

      <div className="divide-y divide-[#E7E5E4] dark:divide-[#1E5C38]">
        {/* Cookie preferences */}
        <SettingRow
          label="Cookie preferences"
          description="Choose whether to store only essential session data or allow anonymous traffic analytics."
        >
          <select
            id="setting-cookies"
            value={settings.cookieChoice}
            onChange={(e) => updateSetting('cookieChoice', e.target.value as 'essential' | 'analytics')}
            aria-label="Cookie preferences"
            className="h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer min-w-[170px]"
          >
            <option value="essential">Essential only (default)</option>
            <option value="analytics">Allow analytics</option>
          </select>
        </SettingRow>

        {/* Clear saved settings button */}
        <SettingRow
          label="Device storage"
          description="Delete locally stored preferences, theme options, and filter defaults from this browser."
        >
          <button
            type="button"
            onClick={onClearDevicePrompt}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#DC2626]/10 transition-colors cursor-pointer min-h-[44px]"
          >
            Clear saved settings on this device
          </button>
        </SettingRow>
      </div>
    </div>
  );
}

// ==================== SECTION 6: ACCOUNT ====================
function AccountSection({
  name,
  setName,
  phone,
  setPhone,
  address,
  setAddress,
  onSave,
  saving,
  saveStatus,
  email,
  onPasswordReset,
  passwordResetStatus,
  onDeletePrompt,
}: {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  saveStatus: string | null;
  email: string;
  onPasswordReset: () => void;
  passwordResetStatus: string | null;
  onDeletePrompt: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E7E5E4] dark:border-[#1E5C38]">
        <h2 className="font-serif text-xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-1">
          Account
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Update your contact information, request a password reset, or manage account termination.
        </p>
      </div>

      {/* Edit Name, Phone, Address */}
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label
            htmlFor="account-name-input"
            className="block text-xs font-bold text-[#064E3B] dark:text-[#F0FDF8] uppercase tracking-wider mb-1.5"
          >
            Full Name or Organization Name
          </label>
          <input
            id="account-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Robin Hood Army or Priya Sharma"
            className="w-full h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]"
          />
        </div>

        <div>
          <label
            htmlFor="account-phone-input"
            className="block text-xs font-bold text-[#064E3B] dark:text-[#F0FDF8] uppercase tracking-wider mb-1.5"
          >
            Phone Number
          </label>
          <input
            id="account-phone-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98200 12345"
            className="w-full h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]"
          />
        </div>

        <div>
          <label
            htmlFor="account-address-input"
            className="block text-xs font-bold text-[#064E3B] dark:text-[#F0FDF8] uppercase tracking-wider mb-1.5"
          >
            Address or Operating Location
          </label>
          <input
            id="account-address-input"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Andheri East, Mumbai"
            className="w-full h-11 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#064E3B] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save contact changes'}
          </button>
          {saveStatus && (
            <span className="text-xs font-medium text-[#059669] dark:text-[#6B7280]">
              {saveStatus}
            </span>
          )}
        </div>
      </form>

      {/* Password reset & account deletion */}
      <div className="pt-6 border-t border-[#E7E5E4] dark:border-[#1E5C38] divide-y divide-[#E7E5E4] dark:divide-[#1E5C38]">
        {/* Change password */}
        <SettingRow
          label="Change password"
          description={`Send a secure password reset link to your registered email address (${email}).`}
        >
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={onPasswordReset}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#064E3B] dark:text-[#F0FDF8] hover:bg-[#D1FAE5] dark:hover:bg-[#134025] transition-colors cursor-pointer min-h-[44px]"
            >
              Send password reset email
            </button>
            {passwordResetStatus && (
              <span className="text-xs text-[#059669] font-medium text-right max-w-xs">
                {passwordResetStatus}
              </span>
            )}
          </div>
        </SettingRow>

        {/* Delete account */}
        <SettingRow
          label="Delete account"
          description="Permanently remove your account and active listings from the FoodLink network."
        >
          <button
            type="button"
            onClick={onDeletePrompt}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#DC2626]/10 transition-colors cursor-pointer min-h-[44px]"
          >
            Delete my account
          </button>
        </SettingRow>
      </div>
    </div>
  );
}

// ==================== SHARED ROW COMPONENT ====================
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6">
      <div className="max-w-xl">
        <label className="block text-sm font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-0.5">
          {label}
        </label>
        <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
          {description}
        </p>
      </div>
      <div className="shrink-0 flex items-center justify-end">{children}</div>
    </div>
  );
}

// ==================== ACCESSIBLE TOGGLE (MIN 44PX) ====================
function AccessibleToggle({
  id,
  checked,
  onChange,
  label,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#059669] rounded-lg ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-6 w-11 rounded-full transition-colors relative ${
          checked ? 'bg-[#059669]' : 'bg-[#E7E5E4] dark:bg-[#1E5C38]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform absolute top-0.5 left-0.5 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
