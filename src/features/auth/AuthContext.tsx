import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from '../../lib/firebase';

export type UserRole =
  | 'restaurant'
  | 'ngo'
  | 'individual_donor'
  | 'individual_recipient'
  | 'donor'
  | 'recipient'
  | 'volunteer'
  | 'admin';

export type DonorSubType = 'restaurant' | 'individual_event';
export type RecipientSubType =
  | 'ngo_shelter'
  | 'hospital'
  | 'school'
  | 'community_kitchen'
  | 'disaster_relief'
  | 'restaurant_canteen';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface VolunteerInfo {
  vehicleType: 'bike' | 'auto' | 'van' | 'on_foot';
  licenseOrGovId: string;
  hasThermalCrate: boolean;
  city?: string;
  volunteerPledgeAccepted?: boolean;
  totalMissionsCompleted?: number;
}

export interface ReceiverCategoryConfig {
  id: RecipientSubType;
  title: string;
  icon: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  verificationDocTitle: string;
  verificationFieldPlaceholder: string;
  verificationHint: string;
  regCertHelp: string;
}

export const RECEIVER_CATEGORIES_CONFIG: Record<RecipientSubType, ReceiverCategoryConfig> = {
  ngo_shelter: {
    id: 'ngo_shelter',
    title: 'NGO / Shelter / Care Home',
    icon: 'volunteer_activism',
    shortLabel: 'Shelter / NGO',
    badgeLabel: 'NITI Aayog NGO Verified',
    description: 'Registered orphanages, elder care homes, rehabilitation centers, and night shelters.',
    verificationDocTitle: 'NITI Aayog NGO Darpan ID or 12A/80G Reg. No. *',
    verificationFieldPlaceholder: 'e.g. MH/2022/0123456 or 12A-AAAT0123D',
    verificationHint: 'Enter 11-15 character Darpan or 12A registration number for nonprofit compliance.',
    regCertHelp: 'Upload NGO Society / Trust Deed / Section 8 Incorporation Certificate',
  },
  hospital: {
    id: 'hospital',
    title: 'Hospital & Healthcare Facility',
    icon: 'local_hospital',
    shortLabel: 'Hospital / Clinic',
    badgeLabel: 'Clinical Reg. Verified (CEA/NABH)',
    description: 'Charitable hospitals, government medical wards, and patient attendee welfare canteens.',
    verificationDocTitle: 'Clinical Establishment Act (CEA) Reg. No. or Hospital License *',
    verificationFieldPlaceholder: 'e.g. CEA/MH/2021/89201 or NABH/HOSP-8821',
    verificationHint: 'Enter State Clinical Establishment Act license or Directorate of Health Services registration.',
    regCertHelp: 'Upload Hospital Establishment License or NABH Accreditation Certificate',
  },
  school: {
    id: 'school',
    title: 'School & Educational Institution',
    icon: 'school',
    shortLabel: 'School / Slum Academy',
    badgeLabel: 'UDISE+ Education Verified',
    description: 'Slum learning centers, aided schools, and community mid-day meal hunger relief programs.',
    verificationDocTitle: 'UDISE+ School Registration Code or Board Affiliation Code *',
    verificationFieldPlaceholder: 'e.g. 27210100101 (11-digit UDISE+) or CBSE-AFF-193021',
    verificationHint: 'Enter 11-digit UDISE+ school code or state educational society registration number.',
    regCertHelp: 'Upload School Recognition Certificate or State Education Department Letter',
  },
  community_kitchen: {
    id: 'community_kitchen',
    title: 'Community Kitchen & Food Relief Trust',
    icon: 'soup_kitchen',
    shortLabel: 'Community Kitchen',
    badgeLabel: 'Charitable Trust Verified',
    description: 'Langar kitchens, Annadanam trusts, citizen disaster pantries, and collective soup kitchens.',
    verificationDocTitle: 'Public Trust Registration Number or Ward Sanitation Permit *',
    verificationFieldPlaceholder: 'e.g. BPT/E-14920/MUM or WARD-HEALTH-2023-99',
    verificationHint: 'Enter Public Charitable Trust Registration (under State Trust Act) or Ward Health Permit.',
    regCertHelp: 'Upload Public Trust Registration Certificate or Municipal Sanitary Inspection Permit',
  },
  disaster_relief: {
    id: 'disaster_relief',
    title: 'Disaster Relief & Municipal Welfare Camp',
    icon: 'campaign',
    shortLabel: 'Disaster Relief Camp',
    badgeLabel: 'Municipal Emergency Verified',
    description: 'Emergency flood/heatwave relief camps, transit shelters, and municipal relief stations.',
    verificationDocTitle: 'Municipal Authority / Disaster Management Cell Authorization ID *',
    verificationFieldPlaceholder: 'e.g. MC/DM-WARD-B/882 or NDRF-CAMP-04',
    verificationHint: 'Enter Municipal Corporation or District Disaster Management Authority authorization number.',
    regCertHelp: 'Upload Disaster Management Cell Sanction Order or Ward Relief In-Charge Authorization',
  },
  restaurant_canteen: {
    id: 'restaurant_canteen',
    title: 'Partner Restaurant & Subsidized Canteen',
    icon: 'restaurant',
    shortLabel: 'Restaurant / Canteen',
    badgeLabel: 'FSSAI License Verified',
    description: 'Community dining canteens, redistribution restaurants, and partner food banks.',
    verificationDocTitle: 'FSSAI 14-Digit Food Safety License Number *',
    verificationFieldPlaceholder: 'e.g. 11522003001894 (14-digit FSSAI)',
    verificationHint: 'Enter 14-digit Food Safety and Standards Authority of India (FSSAI) license number.',
    regCertHelp: 'Upload FSSAI Food Business Operator Registration / License Certificate',
  },
};

export interface VerificationDocs {
  // Restaurant / Food Business
  businessName?: string;
  fssaiNumber?: string;
  fssaiDocName?: string;
  fssaiDocSize?: number;
  fssaiDocUrl?: string;

  // Individual / Event
  govIdType?: 'Aadhaar' | 'PAN';
  govIdNumber?: string;
  eventName?: string;
  eventDate?: string;
  selfDeclaration?: boolean;

  // Recipient / Receiver Institutions (Varied Categories)
  orgName?: string;
  recipientCategory?: RecipientSubType;
  ngoDarpanId?: string;
  hospitalCeaNumber?: string;
  schoolUdiseCode?: string;
  trustRegistrationNumber?: string;
  disasterAuthId?: string;
  receiverVerificationDocType?: string;
  receiverVerificationDocNumber?: string;
  receiverVerificationBadge?: string;
  registrationCertificateNumber?: string;
  regCertificateDocName?: string;
  regCertificateDocSize?: number;
  regCertificateDocUrl?: string;
  tax12A80GNumber?: string;

  // Volunteer Courier Docs
  courierName?: string;
  vehicleType?: string;
  licenseOrGovId?: string;
  hasThermalCrate?: boolean;

  submittedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  donorType?: DonorSubType;
  recipientType?: RecipientSubType;
  recipientCategoryTitle?: string;
  receiverVerificationDocNumber?: string;
  receiverVerificationBadge?: string;
  verificationDocs?: VerificationDocs;
  verificationStatus?: VerificationStatus;
  orgName?: string;
  volunteerInfo?: VolunteerInfo;
  isDemo?: boolean;
  avatarUrl?: string;
  phone?: string;
  city?: string;
  address?: string;
  createdAt?: unknown;
  liabilityConsentAccepted?: boolean;
  consentTimestamp?: unknown;
}

export const isProfileComplete = (profile: UserProfile | null | undefined): boolean => {
  if (!profile) return false;
  if (profile.isDemo) return true;

  // Volunteer specific completion
  if (profile.role === 'volunteer') {
    const hasName = Boolean((profile.displayName || '').trim());
    const cleanPhone = (profile.phone || '').replace(/\D/g, '');
    const hasPhone = cleanPhone.length >= 8;
    const hasCity = Boolean((profile.city || profile.address || '').trim());
    const hasVehicle = Boolean(profile.volunteerInfo?.vehicleType);
    return hasName && hasPhone && hasCity && hasVehicle;
  }
  
  // 1. role: Must be non-empty
  const hasRole = Boolean(profile.role && String(profile.role).trim().length > 0);
  
  // 2. organization / contact name: Must be non-empty
  const orgOrContact = (profile.orgName || profile.displayName || '').trim();
  const hasOrg = orgOrContact.length > 0;
  
  // 3. phone: Must be non-empty and at least 8 digits
  const cleanPhone = (profile.phone || '').replace(/\D/g, '');
  const hasPhone = cleanPhone.length >= 8;
  
  // 4. city: Must be non-empty
  const cityStr = (profile.city || profile.address || '').trim();
  const hasCity = cityStr.length > 0;

  return hasRole && hasOrg && hasPhone && hasCity;
};

export interface GoogleAuthResult {
  user: User;
  existsInDb: boolean;
  role?: UserRole;
  profile?: UserProfile;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  hasCompletedProfile: boolean;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<UserProfile | null>;
  signUpWithEmail: (email: string, pass: string, role?: UserRole) => Promise<void>;
  signUpWithVerification: (email: string, pass: string, verificationData: Partial<UserProfile>) => Promise<void>;
  saveVerificationProfile: (verificationData: Partial<UserProfile>) => Promise<void>;
  sendEmailOtp: (email: string, purpose?: 'signup' | 'login' | 'reset') => Promise<{ success: boolean; testOtp?: string; message: string }>;
  verifyEmailOtp: (email: string, otp: string) => Promise<{ success: boolean; verified: boolean; message: string }>;
  signInWithOtp: (email: string, otp: string) => Promise<UserProfile | null>;
  signInWithGoogle: () => Promise<GoogleAuthResult>;
  signInAsDemo: (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin') => Promise<UserProfile>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
  isDemoAllowed: boolean;
  isProduction: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Detects whether the current execution runtime is production.
 * In production, demo personas, client-side auto-logins, and mock tokens are strictly forbidden.
 */
export const isProductionEnvironment = (): boolean => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.PROD || import.meta.env.MODE === 'production') return true;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'production') return true;
    }
  } catch {}
  return false;
};

/**
 * Mask Aadhaar and PAN numbers in compliance with the Aadhaar Act Sec 29 & DPDP Act 2023.
 * Only the last 4 digits are retained in plaintext (e.g. XXXX-XXXX-1234 or XXXXXX1234).
 */
export function maskSensitiveGovId(idNumber?: string, idType?: 'Aadhaar' | 'PAN' | string): string | undefined {
  if (!idNumber) return idNumber;
  const trimmed = idNumber.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (idType === 'Aadhaar' || digitsOnly.length === 12) {
    if (digitsOnly.length >= 4) {
      return `XXXX-XXXX-${digitsOnly.slice(-4)}`;
    }
  } else if (idType === 'PAN' || /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(trimmed)) {
    const pan = trimmed.toUpperCase();
    return `XXXXXX${pan.slice(-4)}`;
  }
  return trimmed;
}

// Preset demo accounts credentials and profiles
export const DEMO_USERS: Record<'restaurant' | 'ngo' | 'volunteer' | 'admin', {
  uid: string;
  email: string;
  password?: string;
  displayName: string;
  role: UserRole;
  donorType?: DonorSubType;
  recipientType?: RecipientSubType;
  volunteerInfo?: VolunteerInfo;
  verificationStatus: VerificationStatus;
  orgName: string;
  phone: string;
  address: string;
  isDemo: boolean;
  liabilityConsentAccepted?: boolean;
  consentTimestamp?: unknown;
}> = {
  restaurant: {
    uid: 'demo_restaurant_user',
    email: 'chef@bistrodelight.com',
    displayName: 'Chef Marcus (The Grand Bistro)',
    role: 'restaurant' as UserRole,
    donorType: 'restaurant' as DonorSubType,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'The Grand Bistro & Banquet',
    phone: '+1 (800) 555-FOOD',
    address: 'Loading Bay #3, Grand Hotel, Downtown',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
  },
  ngo: {
    uid: 'demo_ngo_user',
    email: 'caretaker@hopeshelter.org',
    displayName: 'Sister Mary (Hope Community Shelter)',
    role: 'ngo' as UserRole,
    recipientType: 'ngo_shelter' as RecipientSubType,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'Hope Community Shelter & Kitchen',
    phone: '+1 (800) 555-CARE',
    address: 'East Ward Community Center, Building 4',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
  },
  volunteer: {
    uid: 'demo_volunteer_runner',
    email: 'courier@foodlink-volunteer.org',
    displayName: 'Rahul Verma (Eco Courier Runner)',
    role: 'volunteer' as UserRole,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'Community Volunteer Courier Unit #4',
    phone: '+91 98200 55442',
    address: 'Indiranagar Central Hub, Bengaluru',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
    volunteerInfo: {
      vehicleType: 'bike',
      licenseOrGovId: 'DL-0420220098214',
      hasThermalCrate: true,
      city: 'bengaluru',
      volunteerPledgeAccepted: true,
      totalMissionsCompleted: 14,
    },
  },
  admin: {
    uid: 'demo_admin_user',
    email: 'admin@foodlink.org',
    displayName: 'Central Admin Officer',
    role: 'admin' as UserRole,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'FoodLink Administration Hub',
    phone: '+91 1800 555 3663',
    address: 'FoodLink HQ, National Operations, Mumbai',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const fetchOrCreateProfile = async (
    user: User,
    defaultRole: UserRole = 'restaurant',
    customData?: Partial<UserProfile>
  ): Promise<UserProfile> => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserProfile;
        // Merge if new customData provided
        if (customData && Object.keys(customData).length > 0) {
          const merged: UserProfile = {
            ...existingData,
            ...customData,
            uid: user.uid,
            email: user.email,
          };
          await setDoc(userDocRef, merged, { merge: true });
          setUserProfile(merged);
          return merged;
        }
        setUserProfile(existingData);
        return existingData;
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName:
            customData?.displayName ||
            user.displayName ||
            (user.email ? user.email.split('@')[0] : 'Community Member'),
          role: customData?.role || defaultRole,
          donorType: customData?.donorType,
          recipientType: customData?.recipientType,
          verificationDocs: customData?.verificationDocs,
          verificationStatus: customData?.verificationStatus || (customData?.isDemo ? 'verified' : 'pending'),
          orgName:
            customData?.orgName ||
            (defaultRole === 'restaurant'
              ? 'Commercial Food Donor'
              : 'Community Care Recipient'),
          avatarUrl: user.photoURL || undefined,
          phone: customData?.phone || '',
          address: customData?.address || '',
          isDemo: customData?.isDemo || false,
          createdAt: serverTimestamp(),
          ...customData,
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      console.warn('Could not read/write Firestore profile, using local fallback:', err);
      const fallback: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName:
          customData?.displayName ||
          user.displayName ||
          'Community Member',
        role: customData?.role || defaultRole,
        donorType: customData?.donorType,
        recipientType: customData?.recipientType,
        verificationDocs: customData?.verificationDocs,
        verificationStatus: customData?.verificationStatus || 'pending',
        orgName:
          customData?.orgName ||
          (defaultRole === 'restaurant' ? 'Commercial Donor' : 'Community Care Center'),
        ...customData,
      };
      setUserProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Clean up previous profile subscription if any
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (user) {
        try {
          localStorage.removeItem('foodlink_demo_persona');
        } catch {
          // ignore
        }
        setCurrentUser(user);

        // Check if demo user
        if (user.email === DEMO_USERS.restaurant.email) {
          await fetchOrCreateProfile(user, 'restaurant', {
            isDemo: true,
            role: 'restaurant',
            donorType: 'restaurant',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.restaurant.displayName,
            orgName: DEMO_USERS.restaurant.orgName,
            address: DEMO_USERS.restaurant.address,
            phone: DEMO_USERS.restaurant.phone,
          });
          setLoading(false);
        } else if (user.email === DEMO_USERS.ngo.email) {
          await fetchOrCreateProfile(user, 'ngo', {
            isDemo: true,
            role: 'ngo',
            recipientType: 'ngo_shelter',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.ngo.displayName,
            orgName: DEMO_USERS.ngo.orgName,
            address: DEMO_USERS.ngo.address,
            phone: DEMO_USERS.ngo.phone,
          });
          setLoading(false);
        } else if (user.email === DEMO_USERS.volunteer.email) {
          await fetchOrCreateProfile(user, 'volunteer', {
            isDemo: true,
            role: 'volunteer',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.volunteer.displayName,
            orgName: DEMO_USERS.volunteer.orgName,
            address: DEMO_USERS.volunteer.address,
            phone: DEMO_USERS.volunteer.phone,
            volunteerInfo: DEMO_USERS.volunteer.volunteerInfo,
          });
          setLoading(false);
        } else if (user.email === DEMO_USERS.admin.email) {
          await fetchOrCreateProfile(user, 'admin', {
            isDemo: true,
            role: 'admin',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.admin.displayName,
            orgName: DEMO_USERS.admin.orgName,
            address: DEMO_USERS.admin.address,
            phone: DEMO_USERS.admin.phone,
          });
          setLoading(false);
        } else {
          // Real-time Cloud Firestore Profile Listener:
          // Immediately syncs updates, verification status, and claims across all logged-in devices
          const userDocRef = doc(db, 'users', user.uid);
          try {
            profileUnsub = onSnapshot(
              userDocRef,
              (snap) => {
                if (snap.exists()) {
                  setUserProfile(snap.data() as UserProfile);
                } else {
                  // Fallback: create base profile if first-time sign-in on a new device
                  fetchOrCreateProfile(user).catch(() => setUserProfile(null));
                }
                setLoading(false);
              },
              (err) => {
                console.warn('Real-time profile listener note:', err.message);
                getDoc(userDocRef)
                  .then((snap) => {
                    if (snap.exists()) setUserProfile(snap.data() as UserProfile);
                    setLoading(false);
                  })
                  .catch(() => setLoading(false));
              }
            );
          } catch {
            setLoading(false);
          }
        }
      } else {
        // Check if demo persona is stored in localStorage
        try {
          const storedRole = localStorage.getItem('foodlink_demo_persona') as 'restaurant' | 'ngo' | 'volunteer' | null;
          if (storedRole && DEMO_USERS[storedRole]) {
            const demo = DEMO_USERS[storedRole];
            const demoAuthUser = {
              uid: demo.uid,
              email: demo.email,
              displayName: demo.displayName,
            } as unknown as User;

            setCurrentUser(demoAuthUser);
            setUserProfile({
              uid: demo.uid,
              email: demo.email,
              displayName: demo.displayName,
              role: demo.role,
              donorType: demo.donorType,
              recipientType: demo.recipientType,
              volunteerInfo: demo.volunteerInfo,
              verificationStatus: 'verified',
              orgName: demo.orgName,
              phone: demo.phone,
              address: demo.address,
              isDemo: true,
            });
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsub) {
        profileUnsub();
      }
    };
  }, []);

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is disabled in your Firebase console. Please enable it in Firebase Authentication > Sign-in method.';
    }
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Invalid email or password. Please verify your credentials.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account already exists with this email address.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in window was closed before completing.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection failed. Please check your internet connection.';
    }
    return err?.message || 'An error occurred during authentication.';
  };

  const signInWithEmail = async (email: string, pass: string): Promise<UserProfile | null> => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await fetchOrCreateProfile(cred.user);
      return profile;
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, role: UserRole = 'restaurant') => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await fetchOrCreateProfile(cred.user, role);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithVerification = async (
    email: string,
    pass: string,
    verificationData: Partial<UserProfile>
  ) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await fetchOrCreateProfile(cred.user, verificationData.role || 'donor', {
        ...verificationData,
        verificationStatus: 'pending',
      });
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const saveVerificationProfile = async (verificationData: Partial<UserProfile>) => {
    setError(null);
    if (!currentUser) {
      throw new Error('Must be signed in to save verification documents.');
    }
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);

      // Mask sensitive Govt ID numbers (Aadhaar/PAN) before persisting (Aadhaar Act Sec 29 & DPDP Act 2023)
      const sanitizedVerificationDocs = verificationData.verificationDocs
        ? {
            ...verificationData.verificationDocs,
            govIdNumber: maskSensitiveGovId(
              verificationData.verificationDocs.govIdNumber,
              verificationData.verificationDocs.govIdType
            ),
            licenseOrGovId: maskSensitiveGovId(
              verificationData.verificationDocs.licenseOrGovId
            ),
          }
        : undefined;

      const updatedData: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: verificationData.displayName || currentUser.displayName || 'Community Member',
        role: verificationData.role || 'donor',
        donorType: verificationData.donorType,
        recipientType: verificationData.recipientType,
        verificationDocs: sanitizedVerificationDocs,
        verificationStatus: 'pending',
        orgName: verificationData.orgName || verificationData.displayName || 'Organization',
        phone: verificationData.phone || '',
        city: verificationData.city || '',
        address: verificationData.address || verificationData.city || '',
        liabilityConsentAccepted: verificationData.liabilityConsentAccepted ?? true,
        consentTimestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        ...verificationData,
      };
      await setDoc(userDocRef, updatedData, { merge: true });
      setUserProfile(updatedData);
    } catch (err: any) {
      console.error('Error saving verification profile:', err);
      // Fallback local update
      const fallback: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: verificationData.displayName || currentUser.displayName || 'Community Member',
        role: verificationData.role || 'donor',
        orgName: verificationData.orgName || 'Organization',
        phone: verificationData.phone || '',
        city: verificationData.city || '',
        ...verificationData,
        verificationStatus: 'pending',
      };
      setUserProfile(fallback);
    }
  };

  const sendEmailOtp = async (
    email: string,
    purpose: 'signup' | 'login' | 'reset' = 'signup'
  ): Promise<{ success: boolean; testOtp?: string; message: string }> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), purpose }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send verification code.');
      }
      return data;
    } catch (err: any) {
      const msg = err.message || 'Error sending OTP';
      setError(msg);
      throw new Error(msg);
    }
  };

  const verifyEmailOtp = async (
    email: string,
    otp: string
  ): Promise<{ success: boolean; verified: boolean; message: string }> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid verification code.');
      }
      return data;
    } catch (err: any) {
      const msg = err.message || 'Error verifying OTP';
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInWithOtp = async (email: string, otp: string): Promise<UserProfile | null> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/otp-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign in with OTP.');
      }

      if (data.customToken) {
        const cred = await signInWithCustomToken(auth, data.customToken);
        const profile = await fetchOrCreateProfile(cred.user);
        return profile;
      }

      return null;
    } catch (err: any) {
      const msg = err.message || 'Error signing in with OTP';
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists() && snap.data()?.role) {
        const existingData = snap.data() as UserProfile;
        const complete = isProfileComplete(existingData);
        if (complete) {
          setUserProfile(existingData);
          return {
            user: cred.user,
            existsInDb: true,
            role: existingData.role,
            profile: existingData,
          };
        }
        // Document exists but profile is incomplete (e.g. missing phone or city)
        setUserProfile(existingData);
        return {
          user: cred.user,
          existsInDb: false,
          role: existingData.role,
          profile: existingData,
        };
      }

      setUserProfile(null);
      return {
        user: cred.user,
        existsInDb: false,
      };
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInAsDemo = async (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin'): Promise<UserProfile> => {
    setError(null);
    if (isProductionEnvironment()) {
      const msg = 'Demo persona logins are strictly disabled in production. Please sign in with genuine credentials.';
      setError(msg);
      throw new Error(msg);
    }
    const demo = DEMO_USERS[role];

    const demoAuthUser = {
      uid: demo.uid,
      email: demo.email,
      displayName: demo.displayName,
      isAnonymous: false,
    } as unknown as User;

    const demoProfile: UserProfile = {
      uid: demo.uid,
      email: demo.email,
      displayName: demo.displayName,
      role: demo.role,
      donorType: demo.donorType,
      recipientType: demo.recipientType,
      volunteerInfo: demo.volunteerInfo,
      verificationStatus: 'verified',
      orgName: demo.orgName,
      phone: demo.phone,
      address: demo.address,
      isDemo: true,
      verificationDocs: {
        businessName: demo.orgName,
        fssaiNumber: role === 'restaurant' ? '10012011000123' : undefined,
        orgName: demo.orgName,
        ngoDarpanId: role === 'ngo' ? 'DL/2022/0123456' : undefined,
        registrationCertificateNumber: role === 'ngo' ? 'REG-88219-NGO' : undefined,
        submittedAt: new Date().toISOString(),
      },
    };

    try {
      localStorage.setItem('foodlink_demo_persona', role);
    } catch {
      // ignore
    }

    // Set active user and profile synchronously so both demo buttons work instantly
    setCurrentUser(demoAuthUser);
    setUserProfile(demoProfile);

    // Ensure Firestore document exists
    try {
      const userDocRef = doc(db, 'users', demo.uid);
      await setDoc(userDocRef, { ...demoProfile, createdAt: serverTimestamp() }, { merge: true });
    } catch (writeErr) {
      console.warn('Firestore demo seed note:', writeErr);
    }

    return demoProfile;
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('foodlink_demo_persona');
    } catch {
      // ignore
    }
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      console.warn('Sign out warning:', err);
    }
    setCurrentUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        setUserProfile,
        hasCompletedProfile: isProfileComplete(userProfile),
        loading,
        signInWithEmail,
        signUpWithEmail,
        signUpWithVerification,
        saveVerificationProfile,
        sendEmailOtp,
        verifyEmailOtp,
        signInWithOtp,
        signInWithGoogle,
        signInAsDemo,
        signOut,
        resetPassword,
        error,
        clearError,
        isDemoAllowed: !isProductionEnvironment(),
        isProduction: isProductionEnvironment(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
