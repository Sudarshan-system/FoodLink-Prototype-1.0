import React, { useState } from 'react';
import { useAuth, DEMO_USERS } from '../features/auth/AuthContext';

interface AdminLoginPageProps {
  onSuccessAdmin: () => void;
  onNavigateHome: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onSuccessAdmin,
  onNavigateHome,
}) => {
  const { signInWithEmail, signInAsDemo, signOut, isDemoAllowed, isProduction } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if matches preconfigured demo admin (ONLY allowed in non-production development environments)
      if (!isProduction && isDemoAllowed && cleanEmail.toLowerCase() === DEMO_USERS.admin.email.toLowerCase()) {
        await signInAsDemo('admin');
        onSuccessAdmin();
        return;
      }

      // 2. Attempt standard cryptographic Firebase auth sign-in
      const profile = await signInWithEmail(cleanEmail, password);

      // Check user's admin role using verified profile role
      if (!profile || profile.role !== 'admin') {
        // Sign out non-admin immediately and show generic message without revealing email existence
        await signOut();
        setErrorMessage('This account does not have admin access.');
        return;
      }

      onSuccessAdmin();
    } catch {
      // Prompt requirement: "If the user is not an admin, sign them out and show:
      // 'This account does not have admin access.' Do not reveal whether the email exists."
      try {
        await signOut();
      } catch {
        // ignore
      }
      setErrorMessage('This account does not have admin access.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoAdmin = async () => {
    if (isProduction || !isDemoAllowed) {
      setErrorMessage('Demo administrator access is disabled in production.');
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      setEmail(DEMO_USERS.admin.email);
      setPassword('••••••••');
      await signInAsDemo('admin');
      onSuccessAdmin();
    } catch {
      setErrorMessage('This account does not have admin access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="site-container py-12 md:py-16">
      <div className="max-w-md mx-auto">
        {/* Back Link */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#064E3B] mb-6 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to FoodLink</span>
        </button>

        {/* Centered Admin Card */}
        <div className="bg-white dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] rounded-xl shadow-xs p-7 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#059669]/10 dark:bg-[#059669]/20 text-[#059669] flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-[28px]">admin_panel_settings</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#064E3B] dark:text-[#F0FDF8]">Admin sign in</h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A3B899] mt-1.5">
              Authorized FoodLink administration access only.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#5C2323] text-[#DC2626] dark:text-[#F87171] text-sm flex items-start gap-2.5 animate-fadeIn"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4.5">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-semibold text-[#064E3B] dark:text-[#F0FDF8] mb-1.5">
                Admin email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@foodlink.org"
                autoComplete="email"
                required
                className="w-full h-11 px-3.5 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#071A12] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all min-h-[44px]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-semibold text-[#064E3B] dark:text-[#F0FDF8] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full h-11 pl-3.5 pr-10 rounded-lg border border-[#E7E5E4] dark:border-[#1E5C38] bg-white dark:bg-[#071A12] text-[#064E3B] dark:text-[#F0FDF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] dark:text-[#A3B899] hover:text-[#064E3B] dark:hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 min-h-[44px] mt-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Quick Demo Admin Sign In helper for reviewers (dev/testing only) */}
          {!isProduction && isDemoAllowed && (
            <div className="mt-6 pt-5 border-t border-[#E7E5E4] dark:border-[#1E5C38] text-center">
              <p className="text-xs text-[#6B7280] dark:text-[#A3B899] mb-2.5">
                Reviewer dev credential: <code className="bg-[#F0FDF8] dark:bg-[#071A12] px-1.5 py-0.5 rounded text-[#064E3B] dark:text-[#F0FDF8] font-mono border border-[#E7E5E4] dark:border-[#1E5C38]">admin@foodlink.org</code>
              </p>
              <button
                type="button"
                onClick={handleQuickDemoAdmin}
                disabled={loading}
                className="w-full py-2 px-3 rounded-lg border border-[#059669]/40 dark:border-[#059669]/60 bg-[#D1FAE5] dark:bg-[#134025] hover:bg-[#059669]/15 text-[#059669] dark:text-[#F0FDF8] text-xs font-semibold transition-colors cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                <span>Quick Sign In as Demo Admin (Dev Only)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
