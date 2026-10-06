import React, { useState, useEffect } from 'react';
import {
  useAuth,
  DEMO_USERS,
  DonorSubType,
  RecipientSubType,
  RECEIVER_CATEGORIES_CONFIG,
  isProfileComplete,
} from './AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { INDIAN_CITIES } from '../../lib/cities';
import { FOODLINK_DISCLAIMER_TEXT } from '../../components/TermsPolicyModal';

export type ModalStep = 'role_select' | 'auth_options' | 'verification' | 'signin';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
  initialRole?: 'donor' | 'recipient' | 'volunteer' | 'admin' | null;
  initialStep?: ModalStep;
  onSuccessRoute?: (role: 'donor' | 'recipient' | 'volunteer' | 'admin') => void;
  onOpenAdminLogin?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'signup',
  initialRole = null,
  initialStep,
  onSuccessRoute,
  onOpenAdminLogin,
}) => {
  const {
    signInWithEmail,
    signUpWithVerification,
    signInWithGoogle,
    signInAsDemo,
    saveVerificationProfile,
    sendEmailOtp,
    verifyEmailOtp,
    signInWithOtp,
    signOut,
    currentUser,
    userProfile,
    setUserProfile,
    error: authError,
    clearError,
    isDemoAllowed,
    isProduction,
  } = useAuth();
  const { isDark } = useTheme();
  const [signInMethod, setSignInMethod] = useState<'password' | 'otp'>('password');
  const [otpLoading, setOtpLoading] = useState(false);

  // Selected Role: donor, recipient, volunteer, or admin
  const [selectedRole, setSelectedRole] = useState<'donor' | 'recipient' | 'volunteer' | 'admin' | null>(initialRole || null);

  // Modal navigation step
  const [step, setStep] = useState<ModalStep>(
    initialStep || (initialRole ? (initialRole === 'admin' ? 'signin' : 'auth_options') : 'role_select')
  );

  // Sub-type for Donor
  const [donorSubType, setDonorSubType] = useState<DonorSubType>('restaurant');

  // Mandatory Platform Liability & Safety Declaration
  const [liabilityConsentAccepted, setLiabilityConsentAccepted] = useState(false);

  // Common user credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Contact Phone & City (MANDATORY fields for all user profiles)
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [customCity, setCustomCity] = useState('');

  // Form Fields: Donor -> Restaurant / Food Business
  const [businessName, setBusinessName] = useState('');
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [fssaiFile, setFssaiFile] = useState<{ name: string; size: number; dataUrl?: string } | null>(null);

  // Form Fields: Donor -> Individual / Event
  const [govIdType, setGovIdType] = useState<'Aadhaar' | 'PAN'>('Aadhaar');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selfDeclaration, setSelfDeclaration] = useState(false);

  // Form Fields: Recipient -> Receiver Variety (NGO, Hospital, School, Community Kitchen, etc.)
  const [recipientSubType, setRecipientSubType] = useState<RecipientSubType>('ngo_shelter');
  const [ngoOrgName, setNgoOrgName] = useState('');
  const [receiverDocNumber, setReceiverDocNumber] = useState('');
  const [ngoDarpanId, setNgoDarpanId] = useState('');
  const [regCertNumber, setRegCertNumber] = useState('');
  const [regCertFile, setRegCertFile] = useState<{ name: string; size: number; dataUrl?: string } | null>(null);
  const [tax12A80GNumber, setTax12A80GNumber] = useState('');

  // Form Fields: Volunteer -> Voluntary Delivery Courier
  const [volunteerVehicleType, setVolunteerVehicleType] = useState<'bike' | 'auto' | 'van' | 'on_foot'>('bike');
  const [volunteerGovId, setVolunteerGovId] = useState('');
  const [volunteerHasCrate, setVolunteerHasCrate] = useState(true);
  const [volunteerPledgeAccepted, setVolunteerPledgeAccepted] = useState(false);

  // Admin Sign In Mode
  const [adminAuthMode, setAdminAuthMode] = useState<'member' | 'admin'>('member');

  // Status & states
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<'restaurant' | 'ngo' | 'volunteer' | 'admin' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Email OTP Verification state
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  // OTP Countdown timer
  useEffect(() => {
    let interval: any = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpTimer]);

  // Sync when modal opens or initial parameters change
  useEffect(() => {
    if (isOpen) {
      if (initialRole) {
        setSelectedRole(initialRole);
        if (initialRole === 'admin') {
          setAdminAuthMode('admin');
        }
      }
      if (initialStep) {
        setStep(initialStep);
      } else if (currentUser && (!userProfile || !isProfileComplete(userProfile))) {
        // If signed in (e.g. through Google) but profile is incomplete, directly show verification
        const effectiveRole =
          initialRole ||
          (userProfile?.role === 'volunteer'
            ? 'volunteer'
            : userProfile?.role === 'ngo' || userProfile?.role === 'recipient'
            ? 'recipient'
            : 'donor');
        setSelectedRole(effectiveRole);
        setStep('verification');
      } else if (initialRole) {
        if (initialRole === 'admin') {
          setStep('signin');
          setAdminAuthMode('admin');
        } else {
          setStep('auth_options');
        }
      } else {
        setSelectedRole(null);
        setAdminAuthMode('member');
        setStep('role_select');
      }

      // Pre-fill fields from authenticated user or profile
      if (currentUser?.email) {
        setEmail(currentUser.email);
      }
      if (currentUser?.displayName) {
        if (!businessName) setBusinessName(currentUser.displayName);
        if (!ngoOrgName) setNgoOrgName(currentUser.displayName);
      }
      if (userProfile?.phone && !phone) {
        setPhone(userProfile.phone);
      }
      if (userProfile?.city && !city) {
        setCity(userProfile.city);
      }

      setLocalError(null);
      setLiabilityConsentAccepted(false);
      setEmailVerified(false);
      setOtpSent(false);
      setOtpCode('');
      setOtpInput('');
      setOtpTimer(0);
      setOtpNotice(null);
      setOtpError(null);
      clearError();
    }
  }, [isOpen, initialRole, initialStep, currentUser, userProfile]);

  if (!isOpen) return null;

  const displayError = localError || authError;

  // File upload handler
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'fssai' | 'regCert'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setLocalError('File size exceeds 10MB limit. Please upload a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        name: file.name,
        size: file.size,
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
      };
      if (type === 'fssai') {
        setFssaiFile(fileData);
      } else {
        setRegCertFile(fileData);
      }
      setLocalError(null);
    };
    reader.readAsDataURL(file);
  };

  // Step 1: Picking role
  const handleSelectRole = (role: 'donor' | 'recipient' | 'volunteer' | 'admin') => {
    setSelectedRole(role);
    setLocalError(null);
    clearError();
    if (role === 'admin') {
      setAdminAuthMode('admin');
      setStep('signin');
    } else {
      setStep('auth_options');
    }
  };

  // Step 2: Google Sign-in for the chosen role
  const handleGoogleSignIn = async () => {
    if (!selectedRole) {
      setLocalError('Please choose whether to continue as Donor or Recipient first.');
      setStep('role_select');
      return;
    }

    clearError();
    setLocalError(null);
    setLoading(true);

    try {
      const result = await signInWithGoogle();
      const currentRole = selectedRole;

      // Check whether a /users/{uid} profile document with the required fields
      // (role, organization/contact name, phone, city) exists.
      const hasCompleteProfile = result.existsInDb && result.profile && isProfileComplete(result.profile);

      if (!hasCompleteProfile) {
        // Profile does NOT exist or is incomplete in Firestore.
        // Redirect the user straight into the verification form to complete their profile
        // before they can do anything else. Do not sign them out, just block all dashboard access until the form is submitted.

        if (result.user.displayName) {
          if (currentRole === 'donor') {
            setBusinessName(result.user.displayName);
            setEventName(`${result.user.displayName} Surplus Food Drive`);
          } else {
            setNgoOrgName(result.user.displayName);
          }
        }
        if (result.user.email) {
          setEmail(result.user.email);
        }

        // Direct user straight to verification form
        setStep('verification');
        setSuccessToast(
          `Signed in as ${result.user.email}. Verification required: Please complete your ${
            currentRole === 'donor' ? 'Donor' : 'Recipient'
          } details below before accessing the dashboard.`
        );
        setTimeout(() => setSuccessToast(null), 5000);
      } else {
        // User already has a complete profile in Firestore!
        const targetDashboard =
          result.role === 'ngo' || result.role === 'recipient' ? 'recipient' : 'donor';
        setSuccessToast(`Welcome back! Routing to your ${targetDashboard === 'donor' ? 'Donor' : 'Recipient'} Dashboard...`);
        if (onSuccessRoute) {
          onSuccessRoute(targetDashboard);
        }
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      console.error('[Google Auth Debug Error]:', err);
      // Handled
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (purpose: 'signup' | 'login' = 'signup') => {
    setOtpError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setOtpError('Please enter a valid email address before requesting an OTP.');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await sendEmailOtp(cleanEmail, purpose);
      setOtpSent(true);
      setOtpTimer(60);
      setOtpNotice(res.message + (res.testOtp ? ` (Dev Code: ${res.testOtp})` : ''));
    } catch (err: any) {
      setOtpError(err.message || 'Failed to send verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError(null);
    if (!otpInput.trim()) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await verifyEmailOtp(email.trim(), otpInput.trim());
      if (res.verified) {
        setEmailVerified(true);
        setOtpNotice('✓ Email address verified successfully!');
        setOtpError(null);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setOtpError('Please enter a valid email address.');
      return;
    }
    if (!otpInput.trim()) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    try {
      const profile = await signInWithOtp(cleanEmail, otpInput.trim());
      setSuccessToast('Signed in successfully with one-time verification code!');
      if (onSuccessRoute) {
        const target =
          profile?.role === 'admin'
            ? 'admin'
            : profile?.role === 'volunteer'
            ? 'volunteer'
            : profile?.role === 'ngo' || profile?.role === 'recipient'
            ? 'recipient'
            : 'donor';
        onSuccessRoute(target);
      }
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 800);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to sign in with OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 3: Verification form submission
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const effectiveRole =
      selectedRole ||
      (userProfile?.role === 'volunteer'
        ? 'volunteer'
        : userProfile?.role === 'ngo' || userProfile?.role === 'recipient'
        ? 'recipient'
        : 'donor');

    // Validate account credentials if not already authenticated
    if (!currentUser) {
      if (!email.trim() || !password.trim()) {
        setLocalError('Please provide your email address and a password to create your account.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (!emailVerified) {
        setLocalError('Please verify your email address with the OTP before submitting.');
        return;
      }
    }

    // Validate Contact Phone Number (required for all roles)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setLocalError('Please enter a valid primary contact phone number (at least 8-10 digits).');
      return;
    }

    // Validate Operating City (required for all roles)
    const effectiveCity = city === 'other' ? customCity.trim() : city.trim();
    if (!effectiveCity) {
      setLocalError('Please select or specify your primary city/region.');
      return;
    }

    // Mandatory Liability and Safety Consent check
    if (!liabilityConsentAccepted) {
      setLocalError(
        'Please check and accept the mandatory FoodLink liability & safety declaration before submitting verification.'
      );
      return;
    }

    // Role-specific validation
    if (effectiveRole === 'volunteer') {
      if (!businessName.trim() && !currentUser?.displayName) {
        setLocalError('Please enter your full name for volunteer courier registration.');
        return;
      }
      if (!volunteerGovId.trim()) {
        setLocalError('Please enter your driving license or government ID number.');
        return;
      }
      if (!volunteerPledgeAccepted) {
        setLocalError('Please accept the volunteer food safety and delivery pledge.');
        return;
      }
    } else if (effectiveRole === 'donor') {
      if (donorSubType === 'restaurant') {
        if (!businessName.trim()) {
          setLocalError('Please enter your Business / Restaurant name.');
          return;
        }
        const cleanFssai = fssaiNumber.replace(/\D/g, '');
        if (cleanFssai.length !== 14) {
          setLocalError('FSSAI License Number must be exactly 14 digits (e.g. 10012011000123).');
          return;
        }
        if (!fssaiFile) {
          setLocalError('Please upload your FSSAI license document.');
          return;
        }
      } else {
        // Individual / Event
        if (!govIdNumber.trim()) {
          setLocalError(`Please enter your valid ${govIdType} Number.`);
          return;
        }
        if (govIdType === 'Aadhaar') {
          const cleanAadhaar = govIdNumber.replace(/\D/g, '');
          if (cleanAadhaar.length !== 12) {
            setLocalError('Aadhaar Number must be 12 digits.');
            return;
          }
        }
        if (govIdType === 'PAN') {
          const cleanPan = govIdNumber.trim().toUpperCase();
          if (cleanPan.length !== 10) {
            setLocalError('PAN Number must be 10 characters (e.g. ABCDE1234F).');
            return;
          }
        }
        if (!eventName.trim()) {
          setLocalError('Please enter the event name (e.g. Wedding Banquet, Private Reception).');
          return;
        }
        if (!eventDate) {
          setLocalError('Please select the event date.');
          return;
        }
        if (!selfDeclaration) {
          setLocalError('You must confirm the food safety self-declaration checklist before proceeding.');
          return;
        }
      }
    } else {
      // Recipient -> Receiver Variety (NGO, Hospital, School, Community Kitchen, Disaster Relief)
      if (!ngoOrgName.trim()) {
        setLocalError('Please enter your Organization / Facility name.');
        return;
      }
      const activeDocVal = receiverDocNumber.trim() || ngoDarpanId.trim();
      const catConfig = RECEIVER_CATEGORIES_CONFIG[recipientSubType];
      if (!activeDocVal || activeDocVal.length < 5) {
        setLocalError(`Please enter a valid ${catConfig.title} verification ID/license number (e.g. ${catConfig.verificationFieldPlaceholder}).`);
        return;
      }
    }

    setLoading(true);
    try {
      // Build verificationDocs object
      const verificationDocs: Record<string, any> = {
        submittedAt: new Date().toISOString(),
      };

      const catConfig = RECEIVER_CATEGORIES_CONFIG[recipientSubType];
      const effectiveDocNum = (receiverDocNumber.trim() || ngoDarpanId.trim()).toUpperCase();

      if (effectiveRole === 'volunteer') {
        verificationDocs.courierName = businessName.trim() || currentUser?.displayName || 'Volunteer Runner';
        verificationDocs.vehicleType = volunteerVehicleType;
        const cleanVolId = volunteerGovId.trim().toUpperCase();
        const digitsVol = cleanVolId.replace(/\D/g, '');
        if (digitsVol.length === 12) {
          verificationDocs.licenseOrGovId = `XXXX-XXXX-${digitsVol.slice(-4)}`;
        } else if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanVolId)) {
          verificationDocs.licenseOrGovId = `XXXXXX${cleanVolId.slice(-4)}`;
        } else {
          verificationDocs.licenseOrGovId = cleanVolId;
        }
        verificationDocs.hasThermalCrate = volunteerHasCrate;
        verificationDocs.volunteerPledgeAccepted = true;
      } else if (effectiveRole === 'donor') {
        if (donorSubType === 'restaurant') {
          verificationDocs.businessName = businessName.trim();
          verificationDocs.fssaiNumber = fssaiNumber.replace(/\D/g, '');
          verificationDocs.fssaiDocName = fssaiFile?.name;
          verificationDocs.fssaiDocSize = fssaiFile?.size;
          verificationDocs.fssaiDocUrl = fssaiFile?.dataUrl;
        } else {
          verificationDocs.govIdType = govIdType;
          if (govIdType === 'Aadhaar') {
            const cleanAadhaar = govIdNumber.replace(/\D/g, '');
            verificationDocs.govIdNumber = `XXXX-XXXX-${cleanAadhaar.slice(-4)}`;
          } else {
            const cleanPan = govIdNumber.trim().toUpperCase();
            verificationDocs.govIdNumber = `XXXXXX${cleanPan.slice(-4)}`;
          }
          verificationDocs.eventName = eventName.trim();
          verificationDocs.eventDate = eventDate;
          verificationDocs.selfDeclaration = selfDeclaration;
        }
      } else {
        verificationDocs.orgName = ngoOrgName.trim();
        verificationDocs.recipientCategory = recipientSubType;
        verificationDocs.receiverVerificationDocType = catConfig.verificationDocTitle;
        verificationDocs.receiverVerificationDocNumber = effectiveDocNum;
        verificationDocs.receiverVerificationBadge = catConfig.badgeLabel;
        verificationDocs.ngoDarpanId = recipientSubType === 'ngo_shelter' ? effectiveDocNum : undefined;
        verificationDocs.hospitalCeaNumber = recipientSubType === 'hospital' ? effectiveDocNum : undefined;
        verificationDocs.schoolUdiseCode = recipientSubType === 'school' ? effectiveDocNum : undefined;
        verificationDocs.trustRegistrationNumber = recipientSubType === 'community_kitchen' ? effectiveDocNum : undefined;
        verificationDocs.disasterAuthId = recipientSubType === 'disaster_relief' ? effectiveDocNum : undefined;
        verificationDocs.registrationCertificateNumber = regCertNumber.trim() || effectiveDocNum;
        verificationDocs.regCertificateDocName = regCertFile?.name;
        verificationDocs.regCertificateDocSize = regCertFile?.size;
        verificationDocs.regCertificateDocUrl = regCertFile?.dataUrl;
        if (tax12A80GNumber.trim()) {
          verificationDocs.tax12A80GNumber = tax12A80GNumber.trim().toUpperCase();
        }
      }

      const orgDisplayName =
        effectiveRole === 'volunteer'
          ? businessName.trim() || currentUser?.displayName || 'Volunteer Courier'
          : effectiveRole === 'donor'
          ? donorSubType === 'restaurant'
            ? businessName.trim()
            : eventName.trim()
          : ngoOrgName.trim();

      const profilePayload = {
        role: (effectiveRole === 'volunteer'
          ? 'volunteer'
          : effectiveRole === 'donor'
          ? donorSubType === 'restaurant'
            ? 'restaurant'
            : 'donor'
          : 'ngo') as any,
        donorType: effectiveRole === 'donor' ? donorSubType : undefined,
        recipientType: effectiveRole === 'recipient' ? recipientSubType : undefined,
        recipientCategoryTitle: effectiveRole === 'recipient' ? catConfig.title : undefined,
        receiverVerificationDocNumber: effectiveRole === 'recipient' ? effectiveDocNum : undefined,
        receiverVerificationBadge: effectiveRole === 'recipient' ? catConfig.badgeLabel : undefined,
        volunteerInfo:
          effectiveRole === 'volunteer'
            ? {
                vehicleType: volunteerVehicleType,
                licenseOrGovId: volunteerGovId.trim().toUpperCase(),
                hasThermalCrate: volunteerHasCrate,
                city: effectiveCity,
                volunteerPledgeAccepted: true,
                totalMissionsCompleted: 0,
              }
            : undefined,
        verificationDocs,
        verificationStatus: 'verified' as const,
        orgName: orgDisplayName,
        displayName: orgDisplayName,
        phone: cleanPhone,
        city: effectiveCity,
        address: effectiveCity,
        liabilityConsentAccepted: true,
        consentTimestamp: new Date().toISOString(),
      };

      if (currentUser) {
        await saveVerificationProfile(profilePayload);
      } else {
        await signUpWithVerification(email.trim(), password, profilePayload);
      }

      setSuccessToast(
        effectiveRole === 'volunteer'
          ? 'Volunteer Courier profile registered! Accessing delivery runs...'
          : effectiveRole === 'donor' && donorSubType === 'individual_event'
          ? 'Profile registered! Your listings will be marked with a Self-Declared safety badge.'
          : 'Verification submitted! Your profile is set to Pending Verification.'
      );

      if (onSuccessRoute) {
        onSuccessRoute(effectiveRole as any);
      }

      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[Verification Submit Error]:', err);
      // Handled
    } finally {
      setLoading(false);
    }
  };

  // Quick Sign In for existing users
  const handleQuickSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      // 1. If in dedicated Admin mode or signing in as admin
      if (adminAuthMode === 'admin') {
        if (!isProduction && isDemoAllowed && cleanEmail.toLowerCase() === DEMO_USERS.admin.email.toLowerCase()) {
          await signInAsDemo('admin');
          setSuccessToast('Administrator signed in successfully!');
          if (onSuccessRoute) onSuccessRoute('admin');
          setTimeout(() => {
            setSuccessToast(null);
            onClose();
          }, 800);
          return;
        }

        const profile = await signInWithEmail(cleanEmail, password);
        if (!profile || profile.role !== 'admin') {
          await signOut();
          setLocalError('This account does not have admin access.');
          return;
        }

        setSuccessToast('Administrator signed in successfully!');
        if (onSuccessRoute) onSuccessRoute('admin');
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 800);
        return;
      }

      // 2. Standard Member Sign In (Donor, Recipient, Volunteer)
      const profile = await signInWithEmail(cleanEmail, password);
      if (profile && !profile.role && !profile.isDemo) {
        setStep('role_select');
        setLocalError('Please select your role and submit verification details.');
        setLoading(false);
        return;
      }

      const targetRole: 'donor' | 'recipient' | 'volunteer' | 'admin' =
        profile?.role === 'admin'
          ? 'admin'
          : profile?.role === 'volunteer'
          ? 'volunteer'
          : profile?.role === 'ngo' || profile?.role === 'recipient'
          ? 'recipient'
          : 'donor';

      setSuccessToast('Signed in successfully!');
      if (onSuccessRoute) {
        onSuccessRoute(targetRole);
      }
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 800);
    } catch (err: any) {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  // Instant Demo Sign-in: Logs in as persona, routes to right dashboard, closes modal
  const handleDemoSignIn = async (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin') => {
    if (isProduction || !isDemoAllowed) {
      setLocalError('Demo sign-in is disabled in production environments.');
      return;
    }
    clearError();
    setLocalError(null);
    setActiveDemo(role);

    try {
      await signInAsDemo(role);

      // Route directly to that persona's dashboard
      const targetDashboard: 'donor' | 'recipient' | 'volunteer' | 'admin' =
        role === 'restaurant'
          ? 'donor'
          : role === 'admin'
          ? 'admin'
          : role === 'volunteer'
          ? 'volunteer'
          : 'recipient';
      if (onSuccessRoute) {
        onSuccessRoute(targetDashboard);
      }

      onClose();
    } catch (err: any) {
      console.warn('Demo persona sign in notice:', err);
    } finally {
      setActiveDemo(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1715]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-xl lg:max-w-4xl rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 shadow-2xl relative my-auto border max-h-[92vh] overflow-y-auto transition-colors ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#0E1715]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-4 pb-3 border-b ${
            isDark ? 'border-[#233833]' : 'border-[#DDE7E1]'
          }`}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669] inline-block animate-pulse"></span>
              <h2
                className={`text-[22px] sm:text-[24px] font-extrabold tracking-tight ${
                  isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                }`}
              >
                {step === 'role_select'
                  ? 'Join FoodLink • Select Role'
                  : step === 'auth_options'
                  ? `Sign In as ${
                      selectedRole === 'donor'
                        ? 'Food Donor'
                        : selectedRole === 'volunteer'
                        ? 'Delivery Volunteer'
                        : selectedRole === 'admin'
                        ? 'Administrator'
                        : 'Recipient NGO'
                    }`
                  : step === 'verification'
                  ? `Registration: ${
                      selectedRole === 'donor'
                        ? 'Donor Verification'
                        : selectedRole === 'volunteer'
                        ? 'Delivery Volunteer'
                        : 'Recipient NGO'
                    }`
                  : adminAuthMode === 'admin'
                  ? 'Administrator Access'
                  : 'Welcome Back to FoodLink'}
              </h2>
            </div>
            <p className={`text-[14px] leading-snug ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
              {step === 'role_select'
                ? 'Select whether you are donating surplus food, receiving for a shelter, volunteering for delivery, or signing in as admin.'
                : step === 'auth_options'
                ? `Choose your preferred registration or sign-in method for your ${
                    selectedRole === 'donor'
                      ? 'Donor'
                      : selectedRole === 'volunteer'
                      ? 'Delivery Volunteer'
                      : 'Recipient'
                  } account.`
                : step === 'verification'
                ? 'Provide details to ensure food safety standards and community compliance.'
                : adminAuthMode === 'admin'
                ? 'Enter administrator credentials or access using instant demo administrator.'
                : 'Sign in to manage your active food rescue listings.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 cursor-pointer ${
              isDark
                ? 'bg-[#1C2E2A] hover:bg-[#233833] text-[#F2F7F4]'
                : 'bg-[#DEEAE2] hover:bg-[#CFDED5] text-[#0E1715]'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Success Toast Banner */}
        {successToast && (
          <div className="mt-3 p-3 rounded-xl bg-[#059669]/15 border border-[#059669]/40 text-[#059669] flex items-center gap-2 text-[14px] font-semibold animate-in fade-in">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>{successToast}</span>
          </div>
        )}

        {/* Error Notification Banner */}
        {displayError && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#ffdad6] border border-[#ffb598] text-[#93000a] text-[13px] leading-relaxed flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#ba1a1a] shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1">
              <span className="font-bold block">Notice:</span>
              <span>{displayError}</span>
            </div>
            <button
              onClick={() => {
                clearError();
                setLocalError(null);
              }}
              className="text-[#93000a] hover:opacity-75 font-bold cursor-pointer"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Two-Column Layout on Desktop: Comfortable Form Width on Left, Helper Panel on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-4">
          <div className="lg:col-span-7 xl:col-span-7 space-y-4">

        {/* =========================================================================
            VIEW 1: NO ROLE SELECTED YET -> REQUIRE PICKING ROLE FIRST
           ========================================================================= */}
        {step === 'role_select' && (
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#059669]">
                Pick your role to get started:
              </span>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setAdminAuthMode('member');
                  setStep('signin');
                }}
                className="text-[13px] font-semibold text-[#059669] hover:underline cursor-pointer"
              >
                Existing member? Sign In
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Role Card 1: Continue as Donor */}
              <button
                type="button"
                onClick={() => handleSelectRole('donor')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1A2B27] hover:bg-[#233833] border-[#233833] hover:border-[#059669]'
                    : 'bg-[#D1FAE5]/60 hover:bg-[#D1FAE5] border-[#CFDED5] hover:border-[#059669]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#059669] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">restaurant</span>
                  </div>
                  <div>
                    <h3
                      className={`text-[17px] font-extrabold ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      Continue as Donor
                    </h3>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      For restaurants, commercial food businesses, caterers, or private weddings &amp; events.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#059669] text-[13px] font-bold">
                  <span>Sign In / Register as Donor</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>

              {/* Role Card 2: Continue as Recipient */}
              <button
                type="button"
                onClick={() => handleSelectRole('recipient')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1A2B27] hover:bg-[#233833] border-[#233833] hover:border-[#0F6E56]'
                    : 'bg-[#DCEEE8]/50 hover:bg-[#DCEEE8] border-[#CFDED5] hover:border-[#0F6E56]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#0F6E56] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">volunteer_activism</span>
                  </div>
                  <div>
                    <h3
                      className={`text-[17px] font-extrabold ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      Continue as Recipient
                    </h3>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      For registered NGOs, orphanages, old age homes, shelters, and community kitchens.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#0F6E56] text-[13px] font-bold">
                  <span>Sign In / Register as Recipient</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>

              {/* Role Card 3: Voluntary Sign Up for Delivery */}
              <button
                type="button"
                onClick={() => handleSelectRole('volunteer')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1A2B27] hover:bg-[#233833] border-[#233833] hover:border-[#2E7D4F]'
                    : 'bg-[#EAF3EC] hover:bg-[#DCEEE8] border-[#CFDED5] hover:border-[#2E7D4F]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#2E7D4F] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">two_wheeler</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3
                        className={`text-[17px] font-extrabold ${
                          isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                        }`}
                      >
                        Delivery Volunteer
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-[#2E7D4F]/15 text-[#2E7D4F] text-[10px] font-black uppercase">
                        Voluntary
                      </span>
                    </div>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      Voluntary sign up for individuals with a bike, auto, or van to deliver surplus food to shelters.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#2E7D4F] text-[13px] font-bold">
                  <span>Sign Up / Sign In for Delivery</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>

              {/* Role Card 4: Administrator Sign In */}
              <button
                type="button"
                onClick={() => handleSelectRole('admin')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1A2B27] hover:bg-[#233833] border-[#233833] hover:border-[#059669]'
                    : 'bg-[#F5F5F4] hover:bg-[#E7E5E4] border-[#CFDED5] hover:border-[#059669]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#064E3B] dark:bg-[#134025] text-[#059669] flex items-center justify-center shadow-xs border border-[#1E5C38]/20">
                    <span className="material-symbols-outlined text-[26px]">shield_person</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3
                        className={`text-[17px] font-extrabold ${
                          isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                        }`}
                      >
                        Administrator
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-[#064E3B]/10 dark:bg-white/10 text-[#6B7280] dark:text-[#9CA3AF] text-[10px] font-black uppercase">
                        Portal
                      </span>
                    </div>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      For platform administrators to review organization verifications and supervise platform operations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#064E3B] dark:text-white text-[13px] font-bold">
                  <span>Sign In as Administrator</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 2: ROLE IS SELECTED -> SHOW REGISTRATION (PRIMARY) & GOOGLE SIGN-IN SHORTCUT
           ========================================================================= */}
        {step === 'auth_options' && selectedRole && (
          <div className="flex flex-col gap-4 mt-4">
            {/* Role Header Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                selectedRole === 'donor'
                  ? isDark
                    ? 'bg-[#2B2312]/60 border-[#059669]/40 text-[#F2F7F4]'
                    : 'bg-[#D1FAE5] border-[#059669]/30 text-[#0E1715]'
                  : selectedRole === 'volunteer'
                  ? isDark
                    ? 'bg-[#1C3A2F]/60 border-[#2E6B56] text-[#F2F7F4]'
                    : 'bg-[#EAF3EC] border-[#2E7D4F]/30 text-[#0E1715]'
                  : isDark
                  ? 'bg-[#1C3A2F]/60 border-[#2E6B56] text-[#F2F7F4]'
                  : 'bg-[#DCEEE8] border-[#A0F3D4] text-[#0E1715]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`material-symbols-outlined text-[24px] ${
                    selectedRole === 'donor'
                      ? 'text-[#059669]'
                      : selectedRole === 'volunteer'
                      ? 'text-[#2E7D4F]'
                      : 'text-[#0F6E56]'
                  }`}
                >
                  {selectedRole === 'donor'
                    ? 'storefront'
                    : selectedRole === 'volunteer'
                    ? 'two_wheeler'
                    : 'volunteer_activism'}
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                    Selected Role
                  </span>
                  <span className="text-[15px] font-extrabold">
                    {selectedRole === 'donor'
                      ? 'Food Donor (Surplus Food Provider)'
                      : selectedRole === 'volunteer'
                      ? 'Delivery Volunteer (Food Rescue Courier)'
                      : 'Recipient NGO (Community Shelter / Kitchen)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setStep('role_select');
                }}
                className={`text-[12px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#162421] border-[#233833] text-[#B8CCC1] hover:text-white'
                    : 'bg-white border-[#CFDED5] text-[#4D5C56] hover:text-[#0E1715]'
                }`}
              >
                Change Role
              </button>
            </div>

            {/* SECTION 1: PRIMARY ACTION FOR NEW USERS -> VERIFICATION FORM */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-[#059669]">
                <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
                <span>
                  New{' '}
                  {selectedRole === 'donor'
                    ? 'Donor'
                    : selectedRole === 'volunteer'
                    ? 'Delivery Volunteer'
                    : 'Recipient'}{' '}
                  Registration (Required)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep('verification')}
                className={`w-full py-4 px-4 active:scale-[0.99] text-white font-bold rounded-xl flex items-center justify-between gap-3 shadow-sm transition-all cursor-pointer group text-left ${
                  selectedRole === 'volunteer'
                    ? 'bg-[#2E7D4F] hover:bg-[#1F5C39]'
                    : 'bg-[#059669] hover:bg-[#DC2626]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">
                      {selectedRole === 'volunteer' ? 'two_wheeler' : 'assignment'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-black leading-tight">
                      Fill{' '}
                      {selectedRole === 'donor'
                        ? 'Donor'
                        : selectedRole === 'volunteer'
                        ? 'Volunteer Courier'
                        : 'Recipient'}{' '}
                      Registration Details
                    </div>
                    <div className="text-[12px] text-white/85 font-normal mt-0.5 truncate">
                      {selectedRole === 'volunteer'
                        ? 'Vehicle type, contact & delivery safety pledge for mission access'
                        : 'Required form for food safety standards & profile activation'}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform shrink-0">
                  arrow_forward
                </span>
              </button>
            </div>

            {/* Clear Divider */}
            <div className="relative my-1 flex items-center justify-center">
              <div className={`w-full h-[1px] ${isDark ? 'bg-[#233833]' : 'bg-[#DDE7E1]'}`}></div>
              <span
                className={`absolute px-3 text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? 'bg-[#162421] text-[#7B9487]' : 'bg-[#FFFFFF] text-[#827A72]'
                }`}
              >
                Already Registered?
              </span>
            </div>

            {/* SECTION 2: SIGN-IN SHORTCUT FOR ALREADY REGISTERED USERS */}
            <div className="flex flex-col gap-2.5">
              <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                If you already registered and verified your profile on FoodLink:
              </p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className={`w-full h-[50px] border active:scale-[0.99] font-bold text-[14.5px] rounded-xl shadow-xs flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer ${
                  isDark
                    ? 'bg-[#1C2E2A] border-[#233833] text-[#F2F7F4] hover:bg-[#233833]'
                    : 'bg-[#FFFFFF] border-[#CFDED5] text-[#0E1715] hover:bg-[#EBF2ED]'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Already registered? Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('signin')}
                className="text-[12.5px] font-bold text-[#059669] hover:underline self-center mt-0.5 cursor-pointer"
              >
                Or sign in with existing email &amp; password
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 3: SUB-TYPE VERIFICATION FORM
           ========================================================================= */}
        {step === 'verification' && selectedRole && (
          <form onSubmit={handleSubmitVerification} className="flex flex-col gap-4 mt-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#CFDED5]/40">
              <button
                type="button"
                onClick={() => setStep('auth_options')}
                className="flex items-center gap-1 text-[13px] font-bold text-[#059669] hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back</span>
              </button>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#059669]">
                Verification Form ({selectedRole === 'donor' ? 'Donor' : 'Recipient'})
              </span>
            </div>

            {/* Google Account Linked Status (if authenticated via Google) */}
            {currentUser && (
              <div className="p-3 rounded-xl bg-[#059669]/10 border border-[#059669]/30 flex items-center justify-between text-[13px] gap-2">
                <div className="flex items-center gap-2.5 text-[#059669] min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">mark_email_read</span>
                  <div className="min-w-0">
                    <span className="font-bold block truncate">Google Account: {currentUser.email}</span>
                    <span className="text-[11px] opacity-80 block truncate">Complete verification details below to activate dashboard access</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#059669] text-white text-[10px] font-black uppercase shrink-0">
                  Step 2 of 2
                </span>
              </div>
            )}

            {/* DONOR FLOW */}
            {selectedRole === 'donor' && (
              <div className="flex flex-col gap-4">
                {/* Sub-type switcher */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-[14px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                    Donor Sub-Type
                  </label>
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 p-1 rounded-xl border text-[13px] font-semibold ${
                      isDark
                        ? 'bg-[#0E1715] border-[#233833]'
                        : 'bg-[#F4F8F5] border-[#CFDED5]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDonorSubType('restaurant')}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        donorSubType === 'restaurant'
                          ? isDark
                            ? 'bg-[#1A2B27] text-[#059669] shadow-xs font-bold'
                            : 'bg-[#FFFFFF] text-[#059669] shadow-2xs font-bold'
                          : isDark
                          ? 'text-[#A09A90] hover:text-[#F2F7F4]'
                          : 'text-[#4D5C56] hover:text-[#0E1715]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">storefront</span>
                      <span>Restaurant / Food Business</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonorSubType('individual_event')}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        donorSubType === 'individual_event'
                          ? isDark
                            ? 'bg-[#1A2B27] text-[#059669] shadow-xs font-bold'
                            : 'bg-[#FFFFFF] text-[#059669] shadow-2xs font-bold'
                          : isDark
                          ? 'text-[#A09A90] hover:text-[#F2F7F4]'
                          : 'text-[#4D5C56] hover:text-[#0E1715]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">celebration</span>
                      <span>Individual / Event Host</span>
                    </button>
                  </div>
                </div>

                {/* Sub-type 1: Restaurant / Food Business */}
                {donorSubType === 'restaurant' && (
                  <div className="flex flex-col gap-3.5 animate-in fade-in">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="business-name"
                        className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                      >
                        Business / Establishment Name *
                      </label>
                      <input
                        id="business-name"
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. The Grand Bistro & Caterers"
                        required
                        className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                          isDark
                            ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                    </div>

                    {/* Required Contact Phone & Operating City */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="restaurant-phone"
                          className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                        >
                          Primary Phone Number *
                        </label>
                        <input
                          id="restaurant-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="restaurant-city"
                          className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                        >
                          Operating Metro City *
                        </label>
                        <select
                          id="restaurant-city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all cursor-pointer ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        >
                          {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name} ({c.state})
                            </option>
                          ))}
                          <option value="other">Other City...</option>
                        </select>
                      </div>
                    </div>

                    {city === 'other' && (
                      <div className="flex flex-col gap-1">
                        <label className={`text-[13px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Specify City / Region Name *
                        </label>
                        <input
                          type="text"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                          placeholder="e.g. Surat, Lucknow, Indore"
                          required
                          className={`w-full h-[44px] rounded-xl px-3.5 text-[14px] border focus:outline-none focus:border-[#059669] ${
                            isDark ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]' : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="fssai-num"
                          className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                        >
                          FSSAI License Number (14-digit format) *
                        </label>
                        <span className="text-[11px] font-mono text-[#059669]">
                          {fssaiNumber.replace(/\D/g, '').length}/14 digits
                        </span>
                      </div>
                      <input
                        id="fssai-num"
                        type="text"
                        maxLength={14}
                        value={fssaiNumber}
                        onChange={(e) => setFssaiNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="14-digit number e.g. 10012011000123"
                        required
                        className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] font-mono border focus:outline-none focus:border-[#059669] transition-all ${
                          isDark
                            ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                    </div>

                    {/* Upload Field for FSSAI License Document */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                        FSSAI License Document *
                      </label>
                      <div
                        className={`border-2 border-dashed rounded-xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-colors relative cursor-pointer ${
                          fssaiFile
                            ? isDark
                              ? 'border-[#4ADE80] bg-[#1C3A2F]/30'
                              : 'border-[#0F6E56] bg-[#DCEEE8]/30'
                            : isDark
                            ? 'border-[#233833] hover:border-[#059669] bg-[#121E1C]'
                            : 'border-[#CFDED5] hover:border-[#059669] bg-[#EBF2ED]'
                        }`}
                      >
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileUpload(e, 'fssai')}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        {fssaiFile ? (
                          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0F6E56] dark:text-[#4ADE80]">
                            <span className="material-symbols-outlined text-[22px]">check_circle</span>
                            <span>{fssaiFile.name} ({(fssaiFile.size / 1024).toFixed(0)} KB)</span>
                            <span className="text-[11px] underline ml-2 text-[#059669]">Change</span>
                          </div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[26px] text-[#059669]">
                              upload_file
                            </span>
                            <span className={`text-[13px] font-medium ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                              Click or drag &amp; drop to upload FSSAI Certificate (PDF, PNG, JPG)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-type 2: Individual / Event */}
                {donorSubType === 'individual_event' && (
                  <div className="flex flex-col gap-3.5 animate-in fade-in">
                    <div className="p-3 rounded-xl bg-[#059669]/10 border border-[#059669]/30 text-[12px] flex items-center gap-2 text-[#059669]">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>
                        No FSSAI license required. Your donations will display a verified <strong>"Self-Declared"</strong> safety badge.
                      </span>
                    </div>

                    {/* Organizer / Contact Name */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="individual-name" className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                        Host / Contact Person Name *
                      </label>
                      <input
                        id="individual-name"
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        required
                        className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                          isDark
                            ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                    </div>

                    {/* Phone & City for Individual */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="individual-phone" className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Contact Phone Number *
                        </label>
                        <input
                          id="individual-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor="individual-city" className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          City / Metro Region *
                        </label>
                        <select
                          id="individual-city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all cursor-pointer ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        >
                          {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name} ({c.state})
                            </option>
                          ))}
                          <option value="other">Other City...</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Government ID Type *
                        </label>
                        <select
                          value={govIdType}
                          onChange={(e) => setGovIdType(e.target.value as 'Aadhaar' | 'PAN')}
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        >
                          <option value="Aadhaar">Aadhaar Card (UIDAI)</option>
                          <option value="PAN">PAN Card (Income Tax Dept)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          {govIdType} Number *
                        </label>
                        <input
                          type="text"
                          value={govIdNumber}
                          onChange={(e) => setGovIdNumber(e.target.value)}
                          placeholder={govIdType === 'Aadhaar' ? '12-digit Aadhaar' : '10-char PAN (ABCDE1234F)'}
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] uppercase font-mono border focus:outline-none focus:border-[#059669] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Event Name *
                        </label>
                        <input
                          type="text"
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          placeholder="e.g. Wedding Reception, Corporate Banquet"
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Event Date *
                        </label>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Self-declaration checkbox */}
                    <label
                      className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                        selfDeclaration
                          ? isDark
                            ? 'bg-[#2B2312]/60 border-[#059669]'
                            : 'bg-[#D1FAE5] border-[#059669]'
                          : isDark
                          ? 'bg-[#121E1C] border-[#233833]'
                          : 'bg-[#EBF2ED] border-[#CFDED5]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selfDeclaration}
                        onChange={(e) => setSelfDeclaration(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-[#059669] rounded focus:ring-[#059669] cursor-pointer"
                        required
                      />
                      <span className={`text-[13px] font-medium leading-relaxed ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                        <strong>Mandatory Declaration:</strong> "I confirm this food was prepared/stored safely and is fit for donation."
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* RECIPIENT FLOW - RECEIVER VARIETY (NGO, HOSPITAL, SCHOOL, COMMUNITY KITCHEN, ETC.) */}
            {selectedRole === 'recipient' && (
              <div className="flex flex-col gap-4 animate-in fade-in">
                {/* 1. Category Selector: Select Organization Type */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="receiver-category"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Which organization category are you from? *
                    </label>
                    <span className="text-[11px] font-bold text-[#059669] bg-[#059669]/15 px-2 py-0.5 rounded-full">
                      {RECEIVER_CATEGORIES_CONFIG[recipientSubType].badgeLabel}
                    </span>
                  </div>

                  {/* Dropdown Select Option */}
                  <select
                    id="receiver-category"
                    value={recipientSubType}
                    onChange={(e) => {
                      const nextType = e.target.value as RecipientSubType;
                      setRecipientSubType(nextType);
                      setReceiverDocNumber('');
                    }}
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[14.5px] font-bold border focus:outline-none focus:border-[#059669] transition-all cursor-pointer ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                    }`}
                  >
                    {Object.values(RECEIVER_CATEGORIES_CONFIG).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </select>

                  {/* Visual Category Quick Select Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {Object.values(RECEIVER_CATEGORIES_CONFIG).map((cat) => {
                      const isSelected = recipientSubType === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setRecipientSubType(cat.id);
                            setReceiverDocNumber('');
                          }}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-[12px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#059669] bg-[#059669]/15 text-[#059669] ring-1 ring-[#059669]'
                              : isDark
                              ? 'border-[#233833] bg-[#121E1C] text-[#B8CCC1] hover:border-[#7B9487]'
                              : 'border-[#CFDED5] bg-[#FFFFFF] text-[#4D5C56] hover:border-[#059669]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] text-[#059669] shrink-0">
                            {cat.icon}
                          </span>
                          <span className="truncate">{cat.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className={`text-[12px] leading-relaxed ${isDark ? 'text-[#7B9487]' : 'text-[#827A72]'}`}>
                    {RECEIVER_CATEGORIES_CONFIG[recipientSubType].description}
                  </p>
                </div>

                {/* 2. Facility / Organization Name */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="ngo-name"
                    className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                  >
                    {recipientSubType === 'hospital'
                      ? 'Hospital / Clinic / Medical Ward Name *'
                      : recipientSubType === 'school'
                      ? 'School / Academy / Education Center Name *'
                      : recipientSubType === 'community_kitchen'
                      ? 'Community Kitchen / Langar / Trust Name *'
                      : recipientSubType === 'disaster_relief'
                      ? 'Relief Camp / Municipal Ward Station Name *'
                      : recipientSubType === 'restaurant_canteen'
                      ? 'Restaurant / Canteen / Eatery Name *'
                      : 'Organization / NGO Shelter Name *'}
                  </label>
                  <input
                    id="ngo-name"
                    type="text"
                    value={ngoOrgName}
                    onChange={(e) => setNgoOrgName(e.target.value)}
                    placeholder={
                      recipientSubType === 'hospital'
                        ? 'e.g. St. Jude Charitable Hospital & Patient Canteen'
                        : recipientSubType === 'school'
                        ? 'e.g. Prerna Vidya Mandir & Community School'
                        : recipientSubType === 'community_kitchen'
                        ? 'e.g. Seva Annadanam & Langar Trust'
                        : recipientSubType === 'disaster_relief'
                        ? 'e.g. Ward 4 Emergency Transit Relief Station'
                        : recipientSubType === 'restaurant_canteen'
                        ? 'e.g. Annapurna Community Bistro & Redistribution Kitchen'
                        : 'e.g. Hope Community Shelter & Care Home'
                    }
                    required
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                  />
                </div>

                {/* 3. Phone & City */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="ngo-phone"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Primary Contact Phone *
                    </label>
                    <input
                      id="ngo-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="ngo-city"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Operating Metro City *
                    </label>
                    <select
                      id="ngo-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#059669] transition-all cursor-pointer ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                      }`}
                    >
                      {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.state})
                        </option>
                      ))}
                      <option value="other">Other City...</option>
                    </select>
                  </div>
                </div>

                {/* 4. Respective Mandatory Verification ID */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="receiver-doc-number"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      {RECEIVER_CATEGORIES_CONFIG[recipientSubType].verificationDocTitle}
                    </label>
                    <span className="text-[11px] font-bold text-[#10B981] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Respective Verification</span>
                    </span>
                  </div>
                  <input
                    id="receiver-doc-number"
                    type="text"
                    value={receiverDocNumber}
                    onChange={(e) => setReceiverDocNumber(e.target.value.toUpperCase())}
                    placeholder={RECEIVER_CATEGORIES_CONFIG[recipientSubType].verificationFieldPlaceholder}
                    required
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] font-mono font-bold border focus:outline-none focus:border-[#059669] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                  />
                  <span className={`text-[11.5px] ${isDark ? 'text-[#7B9487]' : 'text-[#827A72]'}`}>
                    {RECEIVER_CATEGORIES_CONFIG[recipientSubType].verificationHint}
                  </span>
                </div>

                {/* 5. Upload Field for Registration Certificate / License */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                    Upload Registration Certificate / Establishment License *
                  </label>
                  <p className={`text-[11.5px] ${isDark ? 'text-[#7B9487]' : 'text-[#827A72]'}`}>
                    {RECEIVER_CATEGORIES_CONFIG[recipientSubType].regCertHelp}
                  </p>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-colors relative cursor-pointer ${
                      regCertFile
                        ? isDark
                          ? 'border-[#4ADE80] bg-[#1C3A2F]/30'
                          : 'border-[#0F6E56] bg-[#DCEEE8]/30'
                        : isDark
                        ? 'border-[#233833] hover:border-[#059669] bg-[#121E1C]'
                        : 'border-[#CFDED5] hover:border-[#059669] bg-[#EBF2ED]'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, 'regCert')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {regCertFile ? (
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0F6E56] dark:text-[#4ADE80]">
                        <span className="material-symbols-outlined text-[22px]">check_circle</span>
                        <span>{regCertFile.name} ({(regCertFile.size / 1024).toFixed(0)} KB)</span>
                        <span className="text-[11px] underline ml-2 text-[#059669]">Change</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-[12.5px] text-[#7B9487]">
                        <span className="material-symbols-outlined text-[24px] text-[#059669]">upload_file</span>
                        <span>Click to browse Certificate / License (PDF, PNG, JPG)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional 12A / 80G number field */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="tax-12a"
                    className={`text-[13.5px] font-bold flex items-center justify-between ${
                      isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                    }`}
                  >
                    <span>12A / 80G Registration Number</span>
                    <span className="text-[11px] font-normal text-[#7B9487] bg-[#F4F8F5] dark:bg-[#0E1715] px-2 py-0.5 rounded">
                      Optional
                    </span>
                  </label>
                  <input
                    id="tax-12a"
                    type="text"
                    value={tax12A80GNumber}
                    onChange={(e) => setTax12A80GNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. AAAT0123EF20211 (Optional for tax receipts)"
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] font-mono border focus:outline-none focus:border-[#059669] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* VOLUNTEER COURIER FLOW */}
            {selectedRole === 'volunteer' && (
              <div className="flex flex-col gap-4 animate-in fade-in">
                <div className="p-3.5 rounded-xl bg-[#2E7D4F]/10 border border-[#2E7D4F]/30 flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[24px] text-[#2E7D4F]">two_wheeler</span>
                  <div>
                    <h4 className="text-[14px] font-bold text-[#2E7D4F]">Voluntary Delivery Courier Registration</h4>
                    <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                      Join volunteer drivers and riders transporting surplus meals to verified shelters in your city.
                    </p>
                  </div>
                </div>

                {/* 1. Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="volunteer-name"
                    className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                  >
                    Full Name (Volunteer Courier) *
                  </label>
                  <input
                    id="volunteer-name"
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Karan Malhotra"
                    required
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#2E7D4F] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                  />
                </div>

                {/* 2. Contact Phone & Operating City */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="volunteer-phone"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Contact Phone *
                    </label>
                    <input
                      id="volunteer-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#2E7D4F] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="volunteer-city"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Operating City *
                    </label>
                    <select
                      id="volunteer-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={`w-full h-[46px] rounded-xl px-3 text-[14px] border focus:outline-none focus:border-[#2E7D4F] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                      }`}
                    >
                      {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.state})
                        </option>
                      ))}
                      <option value="other">Other City...</option>
                    </select>
                  </div>
                </div>

                {city === 'other' && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="volunteer-custom-city"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Specify Your City / Area *
                    </label>
                    <input
                      id="volunteer-custom-city"
                      type="text"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      placeholder="e.g. Mysuru, Karnataka"
                      required
                      className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#2E7D4F] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                      }`}
                    />
                  </div>
                )}

                {/* 3. Transport Mode & Driving License / Government ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="volunteer-vehicle"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Transport / Vehicle Mode *
                    </label>
                    <select
                      id="volunteer-vehicle"
                      value={volunteerVehicleType}
                      onChange={(e) => setVolunteerVehicleType(e.target.value as any)}
                      className={`w-full h-[46px] rounded-xl px-3 text-[14px] border focus:outline-none focus:border-[#2E7D4F] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                      }`}
                    >
                      <option value="bike">Two-Wheeler (Motorcycle / Scooter)</option>
                      <option value="auto">Auto-rickshaw</option>
                      <option value="van">Van / Four-Wheeler</option>
                      <option value="on_foot">Bicycle / On Foot (Neighborhood)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="volunteer-govid"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Govt ID / Driving License *
                    </label>
                    <input
                      id="volunteer-govid"
                      type="text"
                      value={volunteerGovId}
                      onChange={(e) => setVolunteerGovId(e.target.value.toUpperCase())}
                      placeholder="e.g. DL-0420110012345 or Aadhaar"
                      required
                      className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] font-mono border focus:outline-none focus:border-[#2E7D4F] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                      }`}
                    />
                  </div>
                </div>

                {/* 4. Thermal Carrier & Pledge */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                    volunteerHasCrate
                      ? isDark
                        ? 'bg-[#1C3A2F]/40 border-[#2E6B56]'
                        : 'bg-[#EAF3EC] border-[#D9E2DA]'
                      : isDark
                      ? 'bg-[#121E1C] border-[#233833]'
                      : 'bg-[#EBF2ED] border-[#CFDED5]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={volunteerHasCrate}
                    onChange={(e) => setVolunteerHasCrate(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#2E7D4F] rounded focus:ring-[#2E7D4F] cursor-pointer shrink-0"
                  />
                  <div className="text-[12.5px] leading-relaxed">
                    <span className="font-bold text-[#2E7D4F] block">Thermal Crate / Insulated Bag Available</span>
                    <span className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
                      I have an insulated bag, thermal crate, or clean carrier box to keep food within safe temperature limits during delivery.
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                    volunteerPledgeAccepted
                      ? isDark
                        ? 'bg-[#1C3A2F]/40 border-[#2E6B56]'
                        : 'bg-[#EAF3EC] border-[#D9E2DA]'
                      : isDark
                      ? 'bg-[#121E1C] border-[#233833]'
                      : 'bg-[#EBF2ED] border-[#CFDED5]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={volunteerPledgeAccepted}
                    onChange={(e) => setVolunteerPledgeAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#2E7D4F] rounded focus:ring-[#2E7D4F] cursor-pointer shrink-0"
                    required
                  />
                  <div className="text-[12.5px] leading-relaxed">
                    <span className="font-bold text-[#2E7D4F] block">FoodLink Volunteer Courier Safety Pledge *</span>
                    <span className={isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}>
                      I pledge to handle food packages with hygiene, never tamper with sealed containers, verify donor and recipient handover codes, and complete deliveries promptly.
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Account Credentials (if not logged in) */}
            {!currentUser && (
              <div
                className={`p-3.5 rounded-xl border flex flex-col gap-3 pt-3 mt-1 ${
                  isDark
                    ? 'bg-[#0E1715] border-[#233833]'
                    : 'bg-[#F4F8F5]/60 border-[#CFDED5]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#059669]">
                    Account Sign-In Credentials
                  </span>
                  {emailVerified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF3EC] text-[#2E7D4F] border border-[#D9E2DA]">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Email Verified
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-[12.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                      Email address *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailVerified) setEmailVerified(false);
                          if (otpSent) {
                            setOtpSent(false);
                            setOtpCode('');
                            setOtpInput('');
                            setOtpNotice(null);
                            setOtpError(null);
                          }
                        }}
                        placeholder="name@organization.org"
                        required
                        className={`w-full h-[44px] rounded-xl px-3 text-[14px] border focus:outline-none focus:border-[#059669] transition-all ${
                          isDark
                            ? 'bg-[#162421] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#FFFFFF] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                      {!emailVerified && (
                        <button
                          type="button"
                          onClick={() => handleSendOtp('signup')}
                          disabled={otpLoading || otpTimer > 0}
                          className="h-[44px] px-3.5 rounded-xl text-[12.5px] font-bold whitespace-nowrap bg-[#EAF3EC] text-[#2E7D4F] border border-[#D9E2DA] hover:bg-[#2E7D4F] hover:text-white transition-colors cursor-pointer disabled:opacity-60 shrink-0"
                        >
                          {otpSent ? (otpTimer > 0 ? `Resend (${otpTimer}s)` : 'Resend OTP') : 'Send OTP'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className={`text-[12.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                      Create Password (6+ chars) *
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Secure password"
                        required
                        className={`w-full h-[44px] rounded-xl pl-3 pr-10 text-[14px] border focus:outline-none focus:border-[#059669] transition-all ${
                          isDark
                            ? 'bg-[#162421] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#FFFFFF] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 text-[#7B9487] hover:text-[#0E1715] dark:hover:text-white cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* OTP Verification Box */}
                {otpSent && !emailVerified && (
                  <div
                    className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-colors ${
                      isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#EAF3EC] border-[#D9E2DA]'
                    }`}
                  >
                    {otpNotice && (
                      <div className="flex items-center gap-2 text-[12px] text-[#2E7D4F] font-semibold">
                        <span className="material-symbols-outlined text-[16px] shrink-0">mail</span>
                        <span>{otpNotice}</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        className={`h-[44px] flex-1 rounded-xl px-3 text-[15px] font-mono tracking-widest text-center border focus:outline-none focus:border-[#2E7D4F] ${
                          isDark
                            ? 'bg-[#162421] text-[#F2F7F4] border-[#233833]'
                            : 'bg-[#FFFFFF] text-[#1E2A22] border-[#D9E2DA]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        className="h-[44px] px-4 rounded-xl text-[13px] font-bold bg-[#2E7D4F] hover:bg-[#1F5C39] text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span>Verify OTP</span>
                      </button>
                    </div>
                    {otpError && (
                      <p className="text-[12px] font-semibold text-[#DC2626] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        {otpError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mandatory Platform Liability & Food Safety Declaration */}
            <label
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors mt-1 ${
                liabilityConsentAccepted
                  ? isDark
                    ? 'bg-[#2B2312]/60 border-[#059669]'
                    : 'bg-[#D1FAE5] border-[#059669]'
                  : isDark
                  ? 'bg-[#121E1C] border-[#233833]'
                  : 'bg-[#EBF2ED] border-[#CFDED5]'
              }`}
            >
              <input
                type="checkbox"
                checked={liabilityConsentAccepted}
                onChange={(e) => setLiabilityConsentAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#059669] rounded focus:ring-[#059669] cursor-pointer shrink-0"
                required
              />
              <span className={`text-[12.5px] font-medium leading-relaxed ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                <strong>Mandatory Safety &amp; Compliance Declaration:</strong> I certify all registration details are authentic. I agree to uphold FoodLink food safety protocols, hygiene, temperature guidelines, and platform terms for all surplus food activities.
              </span>
            </label>

            {/* Submit Verification Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] bg-[#059669] hover:bg-[#DC2626] active:scale-[0.99] text-white font-bold text-[15px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer mt-1"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
              )}
              <span>Submit Verification &amp; Access Dashboard</span>
            </button>
          </form>
        )}

        {/* =========================================================================
            VIEW 4: QUICK SIGN-IN (FOR RETURNING USERS)
           ========================================================================= */}
        {step === 'signin' && (
          <form onSubmit={handleQuickSignIn} className="flex flex-col gap-3.5 mt-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#CFDED5]/40">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#059669]">
                {adminAuthMode === 'admin' ? 'Administrator Authentication' : 'Registered Member Sign In'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setLocalError(null);
                  setStep('role_select');
                }}
                className="text-[13px] font-semibold text-[#059669] hover:underline cursor-pointer"
              >
                New user? Choose Role
              </button>
            </div>

            {/* Mode Switcher: Member vs Administrator */}
            <div
              className={`grid grid-cols-2 p-1 rounded-xl border text-[13px] font-semibold ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setAdminAuthMode('member');
                  setLocalError(null);
                }}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  adminAuthMode === 'member'
                    ? isDark
                      ? 'bg-[#1C2E2A] text-white shadow-xs font-bold'
                      : 'bg-white text-[#0E1715] shadow-xs font-bold'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-white'
                    : 'text-[#4D5C56] hover:text-[#0E1715]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">group</span>
                <span>Member Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminAuthMode('admin');
                  setLocalError(null);
                }}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  adminAuthMode === 'admin'
                    ? 'bg-[#059669] text-white shadow-xs font-bold'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-[#059669]'
                    : 'text-[#4D5C56] hover:text-[#059669]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">shield_person</span>
                <span>Admin Sign In</span>
              </button>
            </div>

            {adminAuthMode === 'admin' && (
              <div className="p-3 rounded-xl bg-[#059669]/10 border border-[#059669]/30 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-[#059669]">security</span>
                <p className={`text-[12px] leading-relaxed ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                  <strong>Administrator Access:</strong> Review donor licenses, verify NGO documents, and manage platform safety settings.
                </p>
              </div>
            )}

            {/* Member Sign In Method Toggle: Password vs Email OTP */}
            {adminAuthMode !== 'admin' && (
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-[#121E1C] border border-[#CFDED5] dark:border-[#233833] w-fit mb-1">
                <button
                  type="button"
                  onClick={() => setSignInMethod('password')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    signInMethod === 'password'
                      ? 'bg-[#059669] text-white shadow-xs'
                      : isDark
                      ? 'text-[#B8CCC1] hover:text-[#059669]'
                      : 'text-[#4D5C56] hover:text-[#059669]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">key</span>
                  <span>Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignInMethod('otp')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    signInMethod === 'otp'
                      ? 'bg-[#059669] text-white shadow-xs'
                      : isDark
                      ? 'text-[#B8CCC1] hover:text-[#059669]'
                      : 'text-[#4D5C56] hover:text-[#059669]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">mark_email_read</span>
                  <span>Email OTP Code</span>
                </button>
              </div>
            )}

            {/* Email Input */}
            <div className="flex flex-col gap-1.5">
              <label
                className={`text-[14px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                htmlFor="auth-email"
              >
                {adminAuthMode === 'admin' ? 'Administrator Email' : 'Email address'}
              </label>
              <div className="relative flex items-center">
                <span
                  className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                    isDark ? 'text-[#7B9487]' : 'text-[#827A72]'
                  }`}
                >
                  {adminAuthMode === 'admin' ? 'admin_panel_settings' : 'mail'}
                </span>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    adminAuthMode === 'admin'
                      ? 'admin@foodlink.org'
                      : 'name@organization.org'
                  }
                  className={`w-full h-[48px] rounded-xl pl-11 pr-24 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                    isDark
                      ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                      : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                  }`}
                  required
                />
                {adminAuthMode !== 'admin' && signInMethod === 'otp' && (
                  <button
                    type="button"
                    onClick={() => handleSendOtp('login')}
                    disabled={otpLoading || otpTimer > 0}
                    className="absolute right-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#059669] text-white hover:bg-[#047857] disabled:opacity-50 cursor-pointer transition-all"
                  >
                    {otpTimer > 0 ? `${otpTimer}s` : otpSent ? 'Resend' : 'Get OTP'}
                  </button>
                )}
              </div>
            </div>

            {/* Password input OR OTP Code input based on selected method */}
            {adminAuthMode === 'admin' || signInMethod === 'password' ? (
              <div className="flex flex-col gap-1.5">
                <label
                  className={`text-[14px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                  htmlFor="auth-password"
                >
                  Password
                </label>
                <div className="relative flex items-center">
                  <span
                    className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                      isDark ? 'text-[#7B9487]' : 'text-[#827A72]'
                    }`}
                  >
                    lock
                  </span>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      adminAuthMode === 'admin'
                        ? 'Enter administrator security key'
                        : 'Enter your security password'
                    }
                    className={`w-full h-[48px] rounded-xl pl-11 pr-12 text-[15px] border focus:outline-none focus:border-[#059669] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-2 w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer ${
                      isDark ? 'text-[#B8CCC1] hover:bg-[#1C2E2A]' : 'text-[#4D5C56] hover:bg-[#DEEAE2]'
                    }`}
                    aria-label="Toggle password visibility"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1 animate-in fade-in">
                {otpNotice && (
                  <div className="p-2.5 rounded-xl bg-[#059669]/10 border border-[#059669]/30 text-xs font-semibold text-[#059669] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    <span>{otpNotice}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label
                    className={`text-[14px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    htmlFor="auth-otp"
                  >
                    6-Digit Verification Code
                  </label>
                  <div className="relative flex items-center">
                    <span
                      className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                        isDark ? 'text-[#7B9487]' : 'text-[#827A72]'
                      }`}
                    >
                      pin
                    </span>
                    <input
                      id="auth-otp"
                      type="text"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 123456"
                      className={`w-full h-[48px] rounded-xl pl-11 pr-4 text-[16px] font-mono tracking-widest font-bold border focus:outline-none focus:border-[#059669] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                      }`}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otpLoading}
              onClick={
                adminAuthMode === 'admin' || signInMethod === 'password'
                  ? handleQuickSignIn
                  : handleOtpSignIn
              }
              className="w-full h-[48px] bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white font-bold text-[15px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer mt-1"
            >
              {loading || otpLoading ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">
                  {adminAuthMode === 'admin' ? 'admin_panel_settings' : 'login'}
                </span>
              )}
              <span>
                {adminAuthMode === 'admin'
                  ? 'Sign In as Administrator'
                  : signInMethod === 'otp'
                  ? 'Sign In with Verification Code'
                  : 'Sign In'}
              </span>
            </button>

            {/* Google Sign-in exclusively on the Sign In tab */}
            {adminAuthMode !== 'admin' && (
              <>
                <div className="relative my-2 flex items-center justify-center">
                  <div className={`w-full h-[1px] ${isDark ? 'bg-[#233833]' : 'bg-[#E3E8E2]'}`}></div>
                  <span
                    className={`absolute px-3 text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? 'bg-[#14261D] text-[#9AA7A0]' : 'bg-white text-[#5B6B62]'
                    }`}
                  >
                    or
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className={`w-full h-[46px] border active:scale-[0.99] font-bold text-[14px] rounded-xl shadow-xs flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer ${
                    isDark
                      ? 'bg-[#1C2E2A] border-[#233833] text-[#F4F7F5] hover:bg-[#233833]'
                      : 'bg-white border-[#E3E8E2] text-[#10231A] hover:bg-[#EAF3EC]'
                  }`}
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </>
            )}

            {adminAuthMode === 'admin' && !isProduction && isDemoAllowed && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoSignIn('admin')}
                className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-[13px] font-bold transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#162421] border-[#059669]/40 text-[#059669] hover:bg-[#1C2E2A]'
                    : 'bg-[#D1FAE5] border-[#059669]/40 text-[#059669] hover:bg-[#FDE68A]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>Sign In as Demo Admin (Dev Only)</span>
              </button>
            )}

            {adminAuthMode === 'member' && onOpenAdminLogin && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAdminAuthMode('admin');
                    setLocalError(null);
                  }}
                  className="text-xs text-[#5B6B62] dark:text-[#9AA7A0] hover:text-[#0B8F5F] dark:hover:text-white hover:underline cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">shield_person</span>
                  <span>Platform administrator? Switch to Admin Login</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* Divider & Instant Demo Section (hidden in production) */}
        {!isProduction && isDemoAllowed && (
          <>
            <div className="relative my-4 flex items-center justify-center">
              <div className={`w-full h-[1px] ${isDark ? 'bg-[#233833]' : 'bg-[#DDE7E1]'}`}></div>
              <span
                className={`absolute px-3 text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? 'bg-[#162421] text-[#7B9487]' : 'bg-[#FFFFFF] text-[#827A72]'
                }`}
              >
                or test with instant demo persona
              </span>
            </div>

        {/* Demo Section - Four curated demo options running directly and routing cleanly */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[#059669]">
            <span className="material-symbols-outlined text-[17px]">explore</span>
            <span className="text-[13px] font-bold">Interactive Demo Personas (Instant Access)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Demo Option 1: Restaurant (Donor) */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoSignIn('restaurant')}
              className={`min-h-[50px] border p-2.5 rounded-xl flex items-center justify-between text-left transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer group shadow-2xs ${
                isDark
                  ? 'bg-[#1C2E2A] hover:bg-[#233833] border-[#233833] hover:border-[#059669]'
                  : 'bg-[#EBF2ED] hover:bg-[#F4F8F5] border-[#CFDED5] hover:border-[#059669]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#059669]/15 text-[#059669] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">restaurant</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[13px] font-bold truncate ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      Restaurant Demo
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#059669]/15 text-[#059669] text-[10px] font-bold">
                      Verified ✓
                    </span>
                  </div>
                  <span className={`text-[11px] truncate ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                    The Grand Bistro • Donor
                  </span>
                </div>
              </div>
              {activeDemo === 'restaurant' ? (
                <span className="material-symbols-outlined animate-spin text-[#059669] text-[18px] shrink-0 ml-1">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[#7B9487] group-hover:text-[#059669] text-[18px] shrink-0 ml-1 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>

            {/* Demo Option 2: NGO / Recipient */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoSignIn('ngo')}
              className={`min-h-[50px] border p-2.5 rounded-xl flex items-center justify-between text-left transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer group shadow-2xs ${
                isDark
                  ? 'bg-[#1C2E2A] hover:bg-[#233833] border-[#233833] hover:border-[#0F6E56]'
                  : 'bg-[#EBF2ED] hover:bg-[#F4F8F5] border-[#CFDED5] hover:border-[#0F6E56]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#0F6E56]/15 text-[#0F6E56] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[13px] font-bold truncate ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      NGO Demo
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#0F6E56]/15 text-[#0F6E56] text-[10px] font-bold">
                      Verified ✓
                    </span>
                  </div>
                  <span className={`text-[11px] truncate ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                    Hope Shelter • Recipient
                  </span>
                </div>
              </div>
              {activeDemo === 'ngo' ? (
                <span className="material-symbols-outlined animate-spin text-[#0F6E56] text-[18px] shrink-0 ml-1">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[#7B9487] group-hover:text-[#0F6E56] text-[18px] shrink-0 ml-1 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>

            {/* Demo Option 3: Volunteer Courier */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoSignIn('volunteer')}
              className={`min-h-[50px] border p-2.5 rounded-xl flex items-center justify-between text-left transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer group shadow-2xs ${
                isDark
                  ? 'bg-[#1C2E2A] hover:bg-[#233833] border-[#233833] hover:border-[#2E7D4F]'
                  : 'bg-[#EBF2ED] hover:bg-[#F4F8F5] border-[#CFDED5] hover:border-[#2E7D4F]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#2E7D4F]/15 text-[#2E7D4F] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">two_wheeler</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[13px] font-bold truncate ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      Volunteer Demo
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#2E7D4F]/15 text-[#2E7D4F] text-[10px] font-bold">
                      Active ✓
                    </span>
                  </div>
                  <span className={`text-[11px] truncate ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                    Karan M. • Courier
                  </span>
                </div>
              </div>
              {activeDemo === 'volunteer' ? (
                <span className="material-symbols-outlined animate-spin text-[#2E7D4F] text-[18px] shrink-0 ml-1">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[#7B9487] group-hover:text-[#2E7D4F] text-[18px] shrink-0 ml-1 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>

            {/* Demo Option 4: Administrator */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoSignIn('admin')}
              className={`min-h-[50px] border p-2.5 rounded-xl flex items-center justify-between text-left transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer group shadow-2xs ${
                isDark
                  ? 'bg-[#1C2E2A] hover:bg-[#233833] border-[#233833] hover:border-[#059669]'
                  : 'bg-[#EBF2ED] hover:bg-[#F4F8F5] border-[#CFDED5] hover:border-[#059669]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#059669]/15 text-[#059669] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[13px] font-bold truncate ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      Admin Demo
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#059669]/15 text-[#059669] text-[10px] font-bold">
                      Control ✓
                    </span>
                  </div>
                  <span className={`text-[11px] truncate ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                    Super Admin • Panel
                  </span>
                </div>
              </div>
              {activeDemo === 'admin' ? (
                <span className="material-symbols-outlined animate-spin text-[#059669] text-[18px] shrink-0 ml-1">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[#7B9487] group-hover:text-[#059669] text-[18px] shrink-0 ml-1 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>
          </div>
        </div>
      </>
    )}
      </div>

      {/* Right Helper Column on wide screens */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-5 flex-col gap-4 sticky top-0">
        <div
          className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#D1FAE5] border-[#E7E5E4]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-[#059669] font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
            <span>Why FoodLink Verifies Accounts</span>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#B8CCC1]' : 'text-[#6B7280]'}`}>
            To protect donors and recipient shelters, FoodLink verifies government credentials (FSSAI licenses for commercial food donors and NGO Darpan or trust certificates for charities).
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-[#059669] font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">shield</span>
            <span>Good Samaritan Protection</span>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#B8CCC1]' : 'text-[#6B7280]'}`}>
            Food donations made in good faith are shielded from liability under Food Safety and Standards Authority of India (FSSAI) guidelines.
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-[#059669] font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            <span>Automated Tax Receipts</span>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#B8CCC1]' : 'text-[#6B7280]'}`}>
            Every verified rescue automatically generates official CSR impact certificates and environmental audit records for compliance.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-transparent border border-dashed border-[#CFDED5] dark:border-[#233833] text-xs text-[#6B7280] dark:text-[#B8CCC1]">
          <span className="font-bold text-[#064E3B] dark:text-[#F0FDF8] block mb-1">Assistance Helpline</span>
          <span>Need help signing in or verifying your organization? Email support@foodlink.org.</span>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
};
