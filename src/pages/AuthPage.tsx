import React, { useState } from 'react';
import { useAuth, DEMO_USERS } from '../features/auth/AuthContext';

interface AuthPageProps {
  initialTab?: 'signin' | 'signup';
  initialRole?: 'donor' | 'recipient' | 'volunteer' | 'admin' | null;
  onSuccessRoute?: (role: 'donor' | 'recipient' | 'volunteer' | 'admin') => void;
  onNavigateHome?: () => void;
}

type AuthTab = 'signin' | 'signup';
type OrgType = 'NGO' | 'Orphanage' | 'Old age home' | 'Shelter' | 'Other';

export const AuthPage: React.FC<AuthPageProps> = ({
  initialTab = 'signin',
  initialRole = null,
  onSuccessRoute,
  onNavigateHome,
}) => {
  const {
    signInWithEmail,
    signUpWithVerification,
    signInWithGoogle,
    signInAsDemo,
    signOut,
    resetPassword,
    isDemoAllowed,
    isProduction,
  } = useAuth();

  // Active top tab: "Sign In" or "Create Account"
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInLoading, setSignInLoading] = useState(false);
  const [adminSignInMode, setAdminSignInMode] = useState<'member' | 'admin'>('member');

  // Forgot Password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Create Account state: Step 1 (Role) or Step 2 (Form)
  const [selectedRole, setSelectedRole] = useState<'donor' | 'recipient' | 'volunteer' | 'admin' | null>(initialRole);
  const [createStep, setCreateStep] = useState<1 | 2>(initialRole ? 2 : 1);

  // Step 2 for Donor
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPassword, setDonorPassword] = useState('');
  const [showDonorPassword, setShowDonorPassword] = useState(false);
  const [donorIdFile, setDonorIdFile] = useState<{ name: string; size: string } | null>(null);

  // Step 2 for Organization
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('NGO');
  const [orgRegNumber, setOrgRegNumber] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgContactPerson, setOrgContactPerson] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPassword, setOrgPassword] = useState('');
  const [showOrgPassword, setShowOrgPassword] = useState(false);
  const [orgProofFile, setOrgProofFile] = useState<{ name: string; size: string } | null>(null);

  // Step 2 for Volunteer Delivery
  const [volunteerName, setVolunteerName] = useState('');
  const [volunteerPhone, setVolunteerPhone] = useState('');
  const [volunteerCity, setVolunteerCity] = useState('Mumbai');
  const [volunteerVehicle, setVolunteerVehicle] = useState<'bike' | 'auto' | 'van' | 'on_foot'>('bike');
  const [volunteerGovId, setVolunteerGovId] = useState('');
  const [volunteerEmail, setVolunteerEmail] = useState('');
  const [volunteerPassword, setVolunteerPassword] = useState('');
  const [showVolunteerPassword, setShowVolunteerPassword] = useState(false);
  const [volunteerThermalCrate, setVolunteerThermalCrate] = useState(true);
  const [volunteerPledge, setVolunteerPledge] = useState(false);

  // Feedback states for Create Account
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null);
  const [signUpLoading, setSignUpLoading] = useState(false);

  // Handle Sign In submission
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);

    const cleanEmail = signInEmail.trim();
    if (!cleanEmail) {
      setSignInError('Please enter your email address.');
      return;
    }
    if (!signInPassword) {
      setSignInError('Please enter your password.');
      return;
    }

    setSignInLoading(true);
    try {
      if (adminSignInMode === 'admin') {
        if (!isProduction && isDemoAllowed && cleanEmail.toLowerCase() === DEMO_USERS.admin.email.toLowerCase()) {
          await signInAsDemo('admin');
          if (onSuccessRoute) onSuccessRoute('admin');
          return;
        }

        const profile = await signInWithEmail(cleanEmail, signInPassword);
        if (!profile || profile.role !== 'admin') {
          await signOut();
          setSignInError('This account does not have admin access.');
          return;
        }
        if (onSuccessRoute) onSuccessRoute('admin');
        return;
      }

      const profile = await signInWithEmail(cleanEmail, signInPassword);
      if (onSuccessRoute) {
        if (profile?.role === 'admin') {
          onSuccessRoute('admin');
        } else if (profile?.role === 'volunteer') {
          onSuccessRoute('volunteer');
        } else if (profile?.role === 'ngo' || profile?.role === 'recipient') {
          onSuccessRoute('recipient');
        } else {
          onSuccessRoute('donor');
        }
      }
    } catch (err: any) {
      setSignInError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle Google Sign In (Sign In tab only)
  const handleGoogleSignIn = async () => {
    setSignInError(null);
    setSignInLoading(true);
    try {
      const result = await signInWithGoogle();
      if (onSuccessRoute) {
        if (result.profile?.role === 'admin') {
          onSuccessRoute('admin');
        } else if (result.profile?.role === 'volunteer') {
          onSuccessRoute('volunteer');
        } else if (result.profile?.role === 'ngo' || result.profile?.role === 'recipient') {
          onSuccessRoute('recipient');
        } else {
          onSuccessRoute('donor');
        }
      }
    } catch (err: any) {
      setSignInError(err.message || 'Google sign-in was interrupted.');
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle Forgot Password submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!resetEmail.trim()) {
      setResetError('Please enter your registered email address.');
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetSuccess('Password reset link sent! Please check your email inbox.');
    } catch (err: any) {
      setResetError(err.message || 'Could not send reset link. Please check the email.');
    } finally {
      setResetLoading(false);
    }
  };

  // Handle file uploads (converts file metadata)
  const handleDonorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeKb = Math.round(file.size / 1024);
      setDonorIdFile({ name: file.name, size: `${sizeKb} KB` });
    }
  };

  const handleOrgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeKb = Math.round(file.size / 1024);
      setOrgProofFile({ name: file.name, size: `${sizeKb} KB` });
    }
  };

  // Handle Create Account submission
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError(null);
    setSignUpSuccess(null);

    if (!selectedRole) {
      setSignUpError('Please select your account type.');
      return;
    }

    if (selectedRole === 'admin') {
      // Direct Admin routing
      if (onSuccessRoute) onSuccessRoute('admin');
      return;
    }

    if (selectedRole === 'volunteer') {
      if (!volunteerName.trim()) {
        setSignUpError('Please enter your full name as courier volunteer.');
        return;
      }
      const cleanPhone = volunteerPhone.replace(/\D/g, '');
      if (cleanPhone.length < 8) {
        setSignUpError('Please enter a valid phone number (at least 8 digits).');
        return;
      }
      if (!volunteerEmail.trim()) {
        setSignUpError('Please enter a valid email address.');
        return;
      }
      if (volunteerPassword.length < 6) {
        setSignUpError('Password must be at least 6 characters.');
        return;
      }
      if (!volunteerGovId.trim()) {
        setSignUpError('Please enter your driving license or government ID number.');
        return;
      }
      if (!volunteerPledge) {
        setSignUpError('Please accept the volunteer delivery safety pledge.');
        return;
      }

      setSignUpLoading(true);
      try {
        await signUpWithVerification(volunteerEmail.trim(), volunteerPassword, {
          displayName: volunteerName.trim(),
          role: 'volunteer',
          phone: cleanPhone,
          city: volunteerCity,
          orgName: 'Independent FoodLink Courier',
          verificationStatus: 'verified',
          volunteerInfo: {
            vehicleType: volunteerVehicle,
            licenseOrGovId: volunteerGovId.trim().toUpperCase(),
            hasThermalCrate: volunteerThermalCrate,
            volunteerPledgeAccepted: true,
            totalMissionsCompleted: 0,
            city: volunteerCity,
          },
          verificationDocs: {
            courierName: volunteerName.trim(),
            vehicleType: volunteerVehicle,
            licenseOrGovId: volunteerGovId.trim().toUpperCase(),
            hasThermalCrate: volunteerThermalCrate,
            submittedAt: new Date().toISOString(),
          },
        });

        setSignUpSuccess('Volunteer Courier account created! Accessing delivery runs...');
        setTimeout(() => {
          if (onSuccessRoute) onSuccessRoute('volunteer');
        }, 1200);
      } catch (err: any) {
        setSignUpError(err.message || 'Failed to create volunteer account.');
      } finally {
        setSignUpLoading(false);
      }
      return;
    }

    if (selectedRole === 'donor') {
      if (!donorName.trim()) {
        setSignUpError('Please enter your full name or organization contact name.');
        return;
      }
      if (!donorPhone.trim() || donorPhone.replace(/\D/g, '').length < 8) {
        setSignUpError('Please enter a valid phone number (at least 8 digits).');
        return;
      }
      if (!donorEmail.trim()) {
        setSignUpError('Please enter a valid email address.');
        return;
      }
      if (donorPassword.length < 6) {
        setSignUpError('Password must be at least 6 characters.');
        return;
      }
      if (!donorIdFile) {
        setSignUpError('ID verification upload is required. Please upload your business ID, FSSAI license, or government ID.');
        return;
      }

      setSignUpLoading(true);
      try {
        await signUpWithVerification(donorEmail.trim(), donorPassword, {
          displayName: donorName.trim(),
          role: 'donor',
          donorType: 'restaurant',
          phone: donorPhone.trim(),
          orgName: donorName.trim(),
          verificationDocs: {
            businessName: donorName.trim(),
            fssaiDocName: donorIdFile.name,
            submittedAt: new Date().toISOString(),
          },
        });

        setSignUpSuccess('Donor account created successfully! Redirecting...');
        setTimeout(() => {
          if (onSuccessRoute) onSuccessRoute('donor');
        }, 1200);
      } catch (err: any) {
        setSignUpError(err.message || 'Failed to create account. Please check your details.');
      } finally {
        setSignUpLoading(false);
      }
    } else {
      // Organization registration
      if (!orgName.trim()) {
        setSignUpError('Please enter the organization name.');
        return;
      }
      if (!orgRegNumber.trim()) {
        setSignUpError('Please enter your registration number (e.g. NGO Darpan ID or Trust Reg. No.).');
        return;
      }
      if (!orgAddress.trim()) {
        setSignUpError('Please enter your registered premises address.');
        return;
      }
      if (!orgContactPerson.trim()) {
        setSignUpError('Please enter the primary contact person.');
        return;
      }
      if (!orgPhone.trim() || orgPhone.replace(/\D/g, '').length < 8) {
        setSignUpError('Please enter a valid contact phone number.');
        return;
      }
      if (!orgEmail.trim()) {
        setSignUpError('Please enter a valid organization email address.');
        return;
      }
      if (orgPassword.length < 6) {
        setSignUpError('Password must be at least 6 characters.');
        return;
      }
      if (!orgProofFile) {
        setSignUpError('Proof document upload is required. Please upload your registration certificate or trust deed.');
        return;
      }

      setSignUpLoading(true);
      try {
        await signUpWithVerification(orgEmail.trim(), orgPassword, {
          displayName: orgContactPerson.trim(),
          role: 'ngo',
          recipientType: 'ngo_shelter',
          orgName: orgName.trim(),
          phone: orgPhone.trim(),
          address: orgAddress.trim(),
          verificationStatus: 'pending',
          verificationDocs: {
            orgName: orgName.trim(),
            receiverVerificationDocNumber: orgRegNumber.trim(),
            regCertificateDocName: orgProofFile.name,
            submittedAt: new Date().toISOString(),
          },
        });

        setSignUpSuccess('Organization registered! Your account has been submitted for verification review.');
        setTimeout(() => {
          if (onSuccessRoute) onSuccessRoute('recipient');
        }, 1500);
      } catch (err: any) {
        setSignUpError(err.message || 'Failed to register organization.');
      } finally {
        setSignUpLoading(false);
      }
    }
  };

  return (
    <div className="site-container py-8 sm:py-12 lg:py-16">
      {/* Top Breadcrumb & Page Title */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#064E3B]">
            {activeTab === 'signin' ? 'Welcome back to FoodLink' : 'Join the FoodLink Network'}
          </h1>
          <p className="text-sm sm:text-base text-[#6B7280] mt-1 max-w-[65ch]">
            {activeTab === 'signin'
              ? 'Sign in to publish surplus food, track donations, or claim meals for your registered shelter.'
              : 'Create an account to start sharing unserved food or receiving batches for community welfare.'}
          </p>
        </div>
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-xs sm:text-sm font-semibold text-[#059669] hover:text-[#047857] underline cursor-pointer shrink-0"
          >
            Back to Home
          </button>
        )}
      </div>

      {/* Main Two-Column Container (Form Left, Soft Green Panel Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: THE AUTHENTICATION FORM */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white p-6 sm:p-8 rounded-lg border border-[#E7E5E4] shadow-2xs">
          {/* Two Tabs at Top: "Sign In" and "Create Account" */}
          <div className="flex border-b border-[#E7E5E4] mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setShowForgotPassword(false);
                setSignInError(null);
                setSignUpError(null);
              }}
              className={`py-3 px-6 text-base font-bold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
                activeTab === 'signin'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-[#6B7280] hover:text-[#064E3B]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setShowForgotPassword(false);
                setSignInError(null);
                setSignUpError(null);
              }}
              className={`py-3 px-6 text-base font-bold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
                activeTab === 'signup'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-[#6B7280] hover:text-[#064E3B]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* TAB 1: SIGN IN */}
          {activeTab === 'signin' && (
            <div>
              {/* Forgot Password View */}
              {showForgotPassword ? (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-serif text-lg font-bold text-[#064E3B]">Reset Password</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetSuccess(null);
                        setResetError(null);
                      }}
                      className="text-xs text-[#059669] hover:text-[#047857] font-semibold underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    Enter the email address registered with your FoodLink account. We will send you a password reset link.
                  </p>

                  {resetSuccess && (
                    <div className="p-3.5 rounded-lg bg-[#D1FAE5] border border-[#059669]/30 text-xs font-semibold text-[#059669] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>{resetSuccess}</span>
                    </div>
                  )}

                  {resetError && (
                    <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#EA580C]/30 text-xs font-semibold text-[#EA580C] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="reset-email">
                      Email Address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="name@organization.org"
                      className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {resetLoading ? 'Sending link...' : 'Send Password Reset Link'}
                  </button>
                </form>
              ) : (
                /* Standard Sign In Form */
                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  {/* Mode Selector: Member vs Administrator */}
                  <div className="flex rounded-lg border border-[#E7E5E4] p-1 bg-[#FAFAF9]">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminSignInMode('member');
                        setSignInError(null);
                      }}
                      className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                        adminSignInMode === 'member'
                          ? 'bg-white text-[#064E3B] shadow-xs'
                          : 'text-[#6B7280] hover:text-[#064E3B]'
                      }`}
                    >
                      Member Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminSignInMode('admin');
                        setSignInError(null);
                      }}
                      className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        adminSignInMode === 'admin'
                          ? 'bg-[#064E3B] text-white shadow-xs'
                          : 'text-[#6B7280] hover:text-[#064E3B]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
                      Admin Sign In
                    </button>
                  </div>

                  {adminSignInMode === 'admin' && (
                    <div className="p-3 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] text-xs text-[#57534E] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#064E3B]">security</span>
                        <span>Administrator authorization required.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSignInEmail(DEMO_USERS.admin.email);
                          setSignInPassword('••••••••');
                          setSignInError(null);
                        }}
                        className="text-xs font-bold text-[#059669] hover:underline"
                      >
                        Fill Demo Admin
                      </button>
                    </div>
                  )}

                  {/* Inline Error Message */}
                  {signInError && (
                    <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#EA580C]/30 text-xs font-semibold text-[#EA580C] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                        <span>{signInError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSignInError(null)}
                        className="text-[#EA580C] hover:opacity-70 p-1"
                        aria-label="Dismiss error"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Email Field */}
                  <div>
                    <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="signin-email">
                      {adminSignInMode === 'admin' ? 'Administrator Email' : 'Email Address'}
                    </label>
                    <input
                      id="signin-email"
                      type="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder={adminSignInMode === 'admin' ? 'admin@foodlink.org' : 'name@organization.org'}
                      className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669] transition-colors"
                      required
                    />
                  </div>

                  {/* Password Field with Show/Hide Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-bold text-[#064E3B]" htmlFor="signin-password">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs font-semibold text-[#059669] hover:text-[#047857] underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="signin-password"
                        type={showSignInPassword ? 'text' : 'password'}
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669] transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#064E3B] p-1 cursor-pointer"
                        aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showSignInPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Sign In Submit Button */}
                  <button
                    type="submit"
                    disabled={signInLoading}
                    className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-2"
                  >
                    {signInLoading
                      ? adminSignInMode === 'admin'
                        ? 'Verifying admin credentials...'
                        : 'Signing in...'
                      : adminSignInMode === 'admin'
                      ? 'Sign In as Administrator'
                      : 'Sign In'}
                  </button>

                  {/* Divider */}
                  <div className="relative my-6 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#E7E5E4]" />
                    </div>
                    <span className="relative bg-white px-3 text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Or sign in with
                    </span>
                  </div>

                  {/* "Continue with Google" button (Appears on this tab only) */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={signInLoading}
                    className="w-full h-12 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F0FDF8] text-[#064E3B] font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center gap-3 cursor-pointer shadow-2xs"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: CREATE ACCOUNT */}
          {activeTab === 'signup' && (
            <div>
              {/* Inline Messages */}
              {signUpSuccess && (
                <div className="mb-5 p-4 rounded-lg bg-[#D1FAE5] border border-[#059669]/30 text-sm font-semibold text-[#059669] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <span>{signUpSuccess}</span>
                </div>
              )}

              {signUpError && (
                <div className="mb-5 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#EA580C]/30 text-xs font-semibold text-[#EA580C] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                    <span>{signUpError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignUpError(null)}
                    className="text-[#EA580C] hover:opacity-70 p-1"
                    aria-label="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* STEP 1: CHOOSE ROLE */}
              {createStep === 1 && (
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#064E3B] mb-1">
                    Step 1: Choose your account type
                  </h2>
                  <p className="text-sm text-[#6B7280] mb-6">
                    Select how you will participate in the surplus food rescue network.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* Option 1: I am a Donor */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('donor');
                        setCreateStep(2);
                      }}
                      className="p-6 rounded-lg border-2 border-[#E7E5E4] hover:border-[#059669] bg-white text-left transition-all hover:bg-[#F0FDF8] cursor-pointer group flex flex-col justify-between h-full min-h-[160px]"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-lg bg-[#D1FAE5] text-[#059669] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[26px]">restaurant</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#064E3B] mb-1">
                          I am a Donor
                        </h3>
                        <p className="text-xs text-[#6B7280] leading-relaxed">
                          For restaurants, wedding halls, banquet caterers, corporate cafeterias, and event organizers with surplus unserved food.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#E7E5E4] flex items-center justify-between text-xs font-bold text-[#059669]">
                        <span>Select Donor Account</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                    </button>

                    {/* Option 2: I am an Organization */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('recipient');
                        setCreateStep(2);
                      }}
                      className="p-6 rounded-lg border-2 border-[#E7E5E4] hover:border-[#059669] bg-white text-left transition-all hover:bg-[#F0FDF8] cursor-pointer group flex flex-col justify-between h-full min-h-[160px]"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-lg bg-[#D1FAE5] text-[#059669] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[26px]">volunteer_activism</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#064E3B] mb-1">
                          I am an Organization
                        </h3>
                        <p className="text-xs text-[#6B7280] leading-relaxed">
                          For registered NGOs, orphanages, elder care shelters, rehabilitation centers, and certified community kitchens.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#E7E5E4] flex items-center justify-between text-xs font-bold text-[#059669]">
                        <span>Select Organization Account</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                    </button>

                    {/* Option 3: Delivery Volunteer (Voluntary Sign Up for Delivery) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('volunteer');
                        setCreateStep(2);
                      }}
                      className="p-6 rounded-lg border-2 border-[#E7E5E4] hover:border-[#059669] bg-white text-left transition-all hover:bg-[#F0FDF8] cursor-pointer group flex flex-col justify-between h-full min-h-[160px]"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-lg bg-[#D1FAE5] text-[#059669] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[26px]">local_shipping</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#064E3B] mb-1">
                          Delivery Volunteer
                        </h3>
                        <p className="text-xs text-[#6B7280] leading-relaxed">
                          Voluntary sign up for delivery couriers and riders. Transport surplus food safely from donors to nearby shelters.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#E7E5E4] flex items-center justify-between text-xs font-bold text-[#059669]">
                        <span>Voluntary Sign Up for Delivery</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                    </button>

                    {/* Option 4: Administrator Sign In */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('admin');
                        setCreateStep(2);
                      }}
                      className="p-6 rounded-lg border-2 border-[#E7E5E4] hover:border-[#064E3B] bg-white text-left transition-all hover:bg-[#FAFAF9] cursor-pointer group flex flex-col justify-between h-full min-h-[160px]"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-lg bg-[#F5F5F4] text-[#064E3B] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[26px]">admin_panel_settings</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#064E3B] mb-1">
                          Administrator
                        </h3>
                        <p className="text-xs text-[#6B7280] leading-relaxed">
                          For verified platform managers, safety dispatch officers, and coordinators monitoring food compliance and audits.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#E7E5E4] flex items-center justify-between text-xs font-bold text-[#064E3B]">
                        <span>Administrator Sign In</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DETAILS FORM */}
              {createStep === 2 && (
                <div>
                  <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#E7E5E4]">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#059669]">
                        Step 2 of 2
                      </span>
                      <h2 className="font-serif text-xl font-bold text-[#064E3B]">
                        {selectedRole === 'donor'
                          ? 'Donor Account Information'
                          : selectedRole === 'recipient'
                          ? 'Organization Registration Details'
                          : selectedRole === 'volunteer'
                          ? 'Voluntary Delivery Courier Registration'
                          : 'Administrator Authentication'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateStep(1)}
                      className="text-xs text-[#6B7280] hover:text-[#064E3B] font-semibold underline cursor-pointer"
                    >
                      Change Account Type
                    </button>
                  </div>

                  <form onSubmit={handleSignUpSubmit} className="space-y-4">
                    {/* DONOR SPECIFIC FIELDS */}
                    {selectedRole === 'donor' && (
                      <>
                        {/* Name */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="donor-name">
                            Donor Name / Business Name *
                          </label>
                          <input
                            id="donor-name"
                            type="text"
                            value={donorName}
                            onChange={(e) => setDonorName(e.target.value)}
                            placeholder="e.g. Royal Banquet Hall or Chef Vikram"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                            required
                          />
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="donor-phone">
                            Phone Number *
                          </label>
                          <input
                            id="donor-phone"
                            type="tel"
                            value={donorPhone}
                            onChange={(e) => setDonorPhone(e.target.value)}
                            placeholder="e.g. +91 98200 12345"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                            required
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="donor-email">
                            Email Address *
                          </label>
                          <input
                            id="donor-email"
                            type="email"
                            value={donorEmail}
                            onChange={(e) => setDonorEmail(e.target.value)}
                            placeholder="donor@business.com"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                            required
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="donor-password">
                            Create Password (minimum 6 characters) *
                          </label>
                          <div className="relative">
                            <input
                              id="donor-password"
                              type={showDonorPassword ? 'text' : 'password'}
                              value={donorPassword}
                              onChange={(e) => setDonorPassword(e.target.value)}
                              placeholder="Choose a strong password"
                              className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowDonorPassword(!showDonorPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#064E3B] p-1 cursor-pointer"
                              aria-label={showDonorPassword ? 'Hide password' : 'Show password'}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {showDonorPassword ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* ID Verification Upload (Quick but required) */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="donor-id-file">
                            ID Verification Document (FSSAI License or Government ID) *
                          </label>
                          <div className="p-4 rounded-lg border-2 border-dashed border-[#E7E5E4] bg-[#F0FDF8] text-center">
                            {donorIdFile ? (
                              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#059669]/40">
                                <div className="flex items-center gap-2 text-left">
                                  <span className="material-symbols-outlined text-[24px] text-[#059669]">
                                    check_circle
                                  </span>
                                  <div>
                                    <p className="text-sm font-bold text-[#064E3B] truncate">{donorIdFile.name}</p>
                                    <p className="text-xs text-[#6B7280]">{donorIdFile.size}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDonorIdFile(null)}
                                  className="text-xs text-[#EA580C] hover:underline font-semibold"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="material-symbols-outlined text-[32px] text-[#059669] mb-1">
                                  upload_file
                                </span>
                                <p className="text-sm font-semibold text-[#064E3B]">
                                  Click to upload document or photo
                                </p>
                                <p className="text-xs text-[#6B7280] mt-0.5">
                                  Supports PDF, JPG, PNG up to 10MB
                                </p>
                                <input
                                  id="donor-id-file"
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={handleDonorFileUpload}
                                  className="mt-2 text-xs text-[#6B7280] cursor-pointer"
                                />
                                <div className="mt-3 pt-2 border-t border-[#E7E5E4]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDonorIdFile({ name: 'FSSAI_Licence_Registration_2026.pdf', size: '240 KB' })
                                    }
                                    className="text-xs font-semibold text-[#059669] hover:underline"
                                  >
                                    Use quick test verification document
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={signUpLoading}
                          className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-4"
                        >
                          {signUpLoading ? 'Creating account...' : 'Create Donor Account'}
                        </button>
                      </>
                    )}

                    {/* ORGANIZATION SPECIFIC FIELDS */}
                    {selectedRole === 'recipient' && (
                      <>
                        {/* Note: Your organization will be reviewed before you can claim food */}
                        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#EA580C]/30 text-xs font-semibold text-[#064E3B] flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#EA580C] shrink-0 mt-0.5">
                            info
                          </span>
                          <span>
                            Note: Your organization will be reviewed before you can claim food.
                          </span>
                        </div>

                        {/* Organization Name */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-name">
                            Organization Name *
                          </label>
                          <input
                            id="org-name"
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="e.g. Hope Community Shelter & Care Home"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                            required
                          />
                        </div>

                        {/* Organization Type: NGO, orphanage, old age home, shelter, other */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-type">
                            Organization Type *
                          </label>
                          <select
                            id="org-type"
                            value={orgType}
                            onChange={(e) => setOrgType(e.target.value as OrgType)}
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] bg-white text-[#064E3B] text-base focus:outline-none focus:border-[#059669] cursor-pointer"
                          >
                            <option value="NGO">NGO</option>
                            <option value="Orphanage">Orphanage</option>
                            <option value="Old age home">Old age home</option>
                            <option value="Shelter">Shelter</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        {/* Registration Number */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-reg">
                            Registration Number *
                          </label>
                          <input
                            id="org-reg"
                            type="text"
                            value={orgRegNumber}
                            onChange={(e) => setOrgRegNumber(e.target.value)}
                            placeholder="e.g. NGO Darpan ID, Trust Deed Reg, or Society No."
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                            required
                          />
                        </div>

                        {/* Address */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-address">
                            Registered Facility Address *
                          </label>
                          <input
                            id="org-address"
                            type="text"
                            value={orgAddress}
                            onChange={(e) => setOrgAddress(e.target.value)}
                            placeholder="Street address, neighborhood, city"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                            required
                          />
                        </div>

                        {/* Contact Person & Phone */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-contact">
                              Contact Person *
                            </label>
                            <input
                              id="org-contact"
                              type="text"
                              value={orgContactPerson}
                              onChange={(e) => setOrgContactPerson(e.target.value)}
                              placeholder="Full name of representative"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-phone">
                              Phone Number *
                            </label>
                            <input
                              id="org-phone"
                              type="tel"
                              value={orgPhone}
                              onChange={(e) => setOrgPhone(e.target.value)}
                              placeholder="e.g. +91 98200 55555"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                              required
                            />
                          </div>
                        </div>

                        {/* Email & Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-email">
                              Organization Email *
                            </label>
                            <input
                              id="org-email"
                              type="email"
                              value={orgEmail}
                              onChange={(e) => setOrgEmail(e.target.value)}
                              placeholder="contact@shelter.org"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-password">
                              Password (min 6 characters) *
                            </label>
                            <div className="relative">
                              <input
                                id="org-password"
                                type={showOrgPassword ? 'text' : 'password'}
                                value={orgPassword}
                                onChange={(e) => setOrgPassword(e.target.value)}
                                placeholder="Create a password"
                                className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowOrgPassword(!showOrgPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#064E3B] p-1 cursor-pointer"
                                aria-label={showOrgPassword ? 'Hide password' : 'Show password'}
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  {showOrgPassword ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Proof Document Upload */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="org-proof-file">
                            Proof Document Upload (NGO Certificate or Trust Deed) *
                          </label>
                          <div className="p-4 rounded-lg border-2 border-dashed border-[#E7E5E4] bg-[#F0FDF8] text-center">
                            {orgProofFile ? (
                              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#059669]/40">
                                <div className="flex items-center gap-2 text-left">
                                  <span className="material-symbols-outlined text-[24px] text-[#059669]">
                                    check_circle
                                  </span>
                                  <div>
                                    <p className="text-sm font-bold text-[#064E3B] truncate">{orgProofFile.name}</p>
                                    <p className="text-xs text-[#6B7280]">{orgProofFile.size}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOrgProofFile(null)}
                                  className="text-xs text-[#EA580C] hover:underline font-semibold"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="material-symbols-outlined text-[32px] text-[#059669] mb-1">
                                  drive_folder_upload
                                </span>
                                <p className="text-sm font-semibold text-[#064E3B]">
                                  Upload Certificate, Deed, or Government Sanction
                                </p>
                                <p className="text-xs text-[#6B7280] mt-0.5">
                                  Supports PDF, JPG, PNG up to 10MB
                                </p>
                                <input
                                  id="org-proof-file"
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={handleOrgFileUpload}
                                  className="mt-2 text-xs text-[#6B7280] cursor-pointer"
                                />
                                <div className="mt-3 pt-2 border-t border-[#E7E5E4]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOrgProofFile({ name: 'Trust_Registration_Certificate_2026.pdf', size: '320 KB' })
                                    }
                                    className="text-xs font-semibold text-[#059669] hover:underline"
                                  >
                                    Use quick test verification document
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={signUpLoading}
                          className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-4"
                        >
                          {signUpLoading ? 'Submitting registration...' : 'Register Organization'}
                        </button>
                      </>
                    )}

                    {/* VOLUNTEER SPECIFIC FIELDS */}
                    {selectedRole === 'volunteer' && (
                      <>
                        <div className="p-3.5 rounded-lg bg-[#F0FDF8] border border-[#059669]/30 text-xs text-[#6B7280] flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-[20px] text-[#059669] shrink-0">local_shipping</span>
                          <div>
                            <p className="font-semibold text-[#064E3B]">Volunteer Delivery Courier</p>
                            <p className="mt-0.5">
                              Deliver surplus food packages safely from donors directly to vetted shelters and orphanages.
                            </p>
                          </div>
                        </div>

                        {/* Full Name & Phone */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="vol-name">
                              Full Name *
                            </label>
                            <input
                              id="vol-name"
                              type="text"
                              value={volunteerName}
                              onChange={(e) => setVolunteerName(e.target.value)}
                              placeholder="e.g. Karan M."
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="vol-phone">
                              Phone Number (WhatsApp Active) *
                            </label>
                            <input
                              id="vol-phone"
                              type="tel"
                              value={volunteerPhone}
                              onChange={(e) => setVolunteerPhone(e.target.value)}
                              placeholder="e.g. +91 98200 12345"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                              required
                            />
                          </div>
                        </div>

                        {/* City and Transport Mode */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="vol-city">
                              Operating City / Region *
                            </label>
                            <select
                              id="vol-city"
                              value={volunteerCity}
                              onChange={(e) => setVolunteerCity(e.target.value)}
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669] bg-white cursor-pointer"
                            >
                              <option value="Mumbai">Mumbai</option>
                              <option value="Delhi NCR">Delhi NCR</option>
                              <option value="Bengaluru">Bengaluru</option>
                              <option value="Hyderabad">Hyderabad</option>
                              <option value="Chennai">Chennai</option>
                              <option value="Pune">Pune</option>
                              <option value="Kolkata">Kolkata</option>
                              <option value="Ahmedabad">Ahmedabad</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="vol-vehicle">
                              Primary Transport Mode *
                            </label>
                            <select
                              id="vol-vehicle"
                              value={volunteerVehicle}
                              onChange={(e) => setVolunteerVehicle(e.target.value as any)}
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669] bg-white cursor-pointer"
                            >
                              <option value="bike">Motorcycle / Scooter (Two-Wheeler)</option>
                              <option value="auto">Auto-rickshaw / Three-Wheeler</option>
                              <option value="van">Car / Van (Four-Wheeler)</option>
                              <option value="on_foot">On Foot / Bicycle (Local Runs)</option>
                            </select>
                          </div>
                        </div>

                        {/* Driving License / Gov ID */}
                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="vol-id">
                            Driving License / Government ID Number *
                          </label>
                          <input
                            id="vol-id"
                            type="text"
                            value={volunteerGovId}
                            onChange={(e) => setVolunteerGovId(e.target.value)}
                            placeholder="e.g. DL-1420110012345 or Aadhaar / PAN"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669] uppercase"
                            required
                          />
                        </div>

                        {/* Email & Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="vol-email">
                              Email Address *
                            </label>
                            <input
                              id="vol-email"
                              type="email"
                              value={volunteerEmail}
                              onChange={(e) => setVolunteerEmail(e.target.value)}
                              placeholder="volunteer@domain.com"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="vol-password">
                              Password (min 6 characters) *
                            </label>
                            <div className="relative">
                              <input
                                id="vol-password"
                                type={showVolunteerPassword ? 'text' : 'password'}
                                value={volunteerPassword}
                                onChange={(e) => setVolunteerPassword(e.target.value)}
                                placeholder="Create a secure password"
                                className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#059669]"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowVolunteerPassword(!showVolunteerPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#064E3B] p-1 cursor-pointer"
                                aria-label={showVolunteerPassword ? 'Hide password' : 'Show password'}
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  {showVolunteerPassword ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Thermal Box & Safety Pledge Checkboxes */}
                        <div className="space-y-3 pt-2">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={volunteerThermalCrate}
                              onChange={(e) => setVolunteerThermalCrate(e.target.checked)}
                              className="w-4 h-4 rounded text-[#059669] border-[#E7E5E4] mt-1 cursor-pointer focus:ring-[#059669]"
                            />
                            <span className="text-xs text-[#064E3B] leading-relaxed">
                              <strong>Insulated Transport Equipment:</strong> I have access to a clean insulated delivery bag or thermal box for safe temperature-controlled transport.
                            </span>
                          </label>

                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={volunteerPledge}
                              onChange={(e) => setVolunteerPledge(e.target.checked)}
                              className="w-4 h-4 rounded text-[#059669] border-[#E7E5E4] mt-1 cursor-pointer focus:ring-[#059669]"
                              required
                            />
                            <span className="text-xs text-[#064E3B] leading-relaxed">
                              <strong>Volunteer Delivery Safety Pledge:</strong> I commit to prompt dispatch within 45 minutes of pickup, keeping containers sealed and upright, and adhering to FoodLink Good Samaritan safety rules. *
                            </span>
                          </label>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={signUpLoading || !volunteerPledge}
                          className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-4"
                        >
                          {signUpLoading ? 'Registering volunteer...' : 'Complete Volunteer Registration'}
                        </button>
                      </>
                    )}

                    {/* ADMINISTRATOR SPECIFIC FORM */}
                    {selectedRole === 'admin' && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] text-xs text-[#57534E] flex items-start gap-3">
                          <span className="material-symbols-outlined text-[22px] text-[#064E3B] shrink-0">admin_panel_settings</span>
                          <div>
                            <p className="font-bold text-[#064E3B]">FoodLink Operations & Compliance Portal</p>
                            <p className="mt-0.5 leading-relaxed">
                              Administrator accounts are provisioned exclusively for certified platform coordinators. Enter your staff credentials below to sign in.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="admin-portal-email">
                            Administrator Email *
                          </label>
                          <input
                            id="admin-portal-email"
                            type="email"
                            value={signInEmail}
                            onChange={(e) => setSignInEmail(e.target.value)}
                            placeholder="admin@foodlink.org"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#064E3B]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-[#064E3B] mb-1.5" htmlFor="admin-portal-pass">
                            Password *
                          </label>
                          <div className="relative">
                            <input
                              id="admin-portal-pass"
                              type={showSignInPassword ? 'text' : 'password'}
                              value={signInPassword}
                              onChange={(e) => setSignInPassword(e.target.value)}
                              placeholder="Enter administrator password"
                              className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#E7E5E4] text-[#064E3B] text-base focus:outline-none focus:border-[#064E3B]"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignInPassword(!showSignInPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#064E3B] p-1 cursor-pointer"
                              aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {showSignInPassword ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setSignInEmail(DEMO_USERS.admin.email);
                              setSignInPassword('••••••••');
                            }}
                            className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[15px]">key</span>
                            Use Demo Admin Credentials (admin@foodlink.org)
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            setAdminSignInMode('admin');
                            handleSignInSubmit(e as any);
                          }}
                          disabled={signInLoading}
                          className="w-full h-12 rounded-lg bg-[#064E3B] hover:bg-[#134025] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-4"
                        >
                          {signInLoading ? 'Verifying admin authorization...' : 'Sign In as Administrator'}
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SOFT GREEN PANEL (#D1FAE5) WITH CHECKLIST */}
        {/* On mobile, this automatically stacks below the form */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#D1FAE5] p-6 sm:p-7 rounded-lg border border-[#E7E5E4] space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-[#059669] text-white flex items-center justify-center font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">checklist</span>
              </span>
              <h2 className="font-serif text-xl font-bold text-[#064E3B]">
                What an account gives you
              </h2>
            </div>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              FoodLink coordinates clean surplus food transfers directly between verified organizations in India.
            </p>
          </div>

          {/* Checklist */}
          <ul className="space-y-3.5 text-sm text-[#064E3B]">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#059669]/20 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Instant notifications:</strong> Real-time alerts when fresh food is listed in your area.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#059669]/20 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Direct coordination:</strong> Chat directly with donors to schedule prompt pickups.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#059669]/20 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Good Samaritan protection:</strong> Food handling compliance under statutory FSSAI rules.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#059669]/20 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Audit receipts:</strong> Automated CSR impact certificates and annual sustainability records.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#059669]/20 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Zero fees:</strong> 100% free non-profit platform for donors and charities.</span>
            </li>
          </ul>

          <div className="pt-4 border-t border-[#E7E5E4] space-y-2 text-xs text-[#6B7280]">
            <p className="leading-relaxed">
              Organization details are reviewed by our verification team within 24 hours to ensure food safety compliance.
            </p>
            <div className="flex items-center gap-1.5 font-semibold text-[#059669]">
              <span className="material-symbols-outlined text-[16px]">mail</span>
              <span>Need help? Email support@foodlink.org</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
