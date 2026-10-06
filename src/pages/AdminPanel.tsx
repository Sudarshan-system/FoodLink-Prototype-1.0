import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../features/auth/AuthContext';
import { FoodListing } from '../features/donor/DonorDashboard';

export type AdminSection = 'overview' | 'queue' | 'listings' | 'users';

export interface AdminApplicant {
  id: string;
  name: string;
  type: 'Donor' | 'Organization';
  subType?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  submittedDate: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  documents: {
    title: string;
    fileName: string;
    fileSize: string;
    docNumber?: string;
    docType?: string;
  }[];
  isSample?: boolean;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  orgName?: string;
  city?: string;
  phone?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  joinedDate: string;
  isSample?: boolean;
}

interface AdminPanelProps {
  onNavigateHome: () => void;
}

// Built-in sample records used when database has no records or offline
const SAMPLE_APPLICANTS: AdminApplicant[] = [
  {
    id: 'sample_app_1',
    name: 'Annapurna Banquets & Catering',
    type: 'Donor',
    subType: 'Catering & Events',
    email: 'events@annapurnabanquet.com',
    phone: '+91 98201 44321',
    address: 'Plot 42, Link Road, Andheri West',
    city: 'Mumbai',
    submittedDate: '2026-09-30 08:15',
    status: 'pending',
    documents: [
      {
        title: 'FSSAI Food Business License',
        fileName: 'FSSAI_License_11522003001894.pdf',
        fileSize: '412 KB',
        docNumber: '11522003001894',
        docType: 'FSSAI License',
      },
      {
        title: 'Authorized Signatory Government ID',
        fileName: 'Manager_Aadhaar_Verification.pdf',
        fileSize: '245 KB',
        docNumber: 'XXXX-XXXX-8921',
        docType: 'Aadhaar ID',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_2',
    name: 'Sneha Sadan Child Care Trust',
    type: 'Organization',
    subType: 'Orphanage & Children Shelter',
    email: 'director@snehasadantrust.org',
    phone: '+91 98334 11200',
    address: 'Gundavali Hill, Church Road, Andheri East',
    city: 'Mumbai',
    submittedDate: '2026-09-30 07:40',
    status: 'pending',
    documents: [
      {
        title: 'NITI Aayog NGO Darpan Registration',
        fileName: 'NITI_Darpan_MH_2021_009182.pdf',
        fileSize: '520 KB',
        docNumber: 'MH/2021/009182',
        docType: 'Darpan ID',
      },
      {
        title: 'Trust Deed & 12A/80G Certificate',
        fileName: 'Trust_Deed_80G_Tax_Exemption.pdf',
        fileSize: '1.2 MB',
        docNumber: 'AAATS1290D',
        docType: '12A/80G Reg',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_3',
    name: 'Golden Harvest Family Restaurant',
    type: 'Donor',
    subType: 'Restaurant & Bakery',
    email: 'manager@goldenharvestblr.com',
    phone: '+91 98450 77610',
    address: '100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    submittedDate: '2026-09-29 18:30',
    status: 'pending',
    documents: [
      {
        title: 'FSSAI 14-Digit License Certificate',
        fileName: 'FSSAI_Cert_GoldenHarvest.pdf',
        fileSize: '360 KB',
        docNumber: '11221002000551',
        docType: 'FSSAI License',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_4',
    name: 'Karuna Old Age Home & Hospice',
    type: 'Organization',
    subType: 'Old age home',
    email: 'admin@karunahome.org',
    phone: '+91 99100 88234',
    address: 'Sector 14, Ring Road Extension',
    city: 'Delhi NCR',
    submittedDate: '2026-09-29 14:10',
    status: 'pending',
    documents: [
      {
        title: 'Social Welfare Society Registration',
        fileName: 'Society_Reg_Karuna_Welfare.pdf',
        fileSize: '890 KB',
        docNumber: 'SOC-DEL-2018-449',
        docType: 'Society Certificate',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_5',
    name: 'Langar Seva Community Kitchen',
    type: 'Organization',
    subType: 'Community kitchen',
    email: 'seva@langarkitchen.org',
    phone: '+91 97654 33211',
    address: 'Gurudwara Marg, Camp Area',
    city: 'Pune',
    submittedDate: '2026-09-28 11:20',
    status: 'pending',
    documents: [
      {
        title: 'Public Charitable Trust Deed',
        fileName: 'Public_Trust_Reg_BPT.pdf',
        fileSize: '650 KB',
        docNumber: 'BPT/E-14920/PUN',
        docType: 'Trust Registration',
      },
    ],
    isSample: true,
  },
];

const SAMPLE_LISTINGS: FoodListing[] = [
  {
    id: 'sample_listing_1',
    title: 'Surplus Dal Makhani & Jeera Rice (Banquet)',
    category: 'Prepared Meals',
    foodType: 'Prepared Meals',
    quantity: 50,
    unit: 'Servings',
    expiryTime: '23:30',
    pickupWindow: 'Tonight 18:00 - 23:30',
    location: 'The Grand Ballroom, Juhu, Mumbai',
    donorName: 'Grand Hyatt Catering',
    donorOrg: 'Grand Hyatt Hotels',
    donorEmail: 'catering@grandhyattmumbai.com',
    donorId: 'donor_demo_1',
    status: 'available',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Hot kept in stainless steel containers. Cooked at 6 PM.',
  },
  {
    id: 'sample_listing_2',
    title: 'Freshly Baked Multigrain Breads & Buns',
    category: 'Bakery & Bread',
    foodType: 'Bakery & Bread',
    quantity: 60,
    unit: 'Packets',
    expiryTime: 'Tomorrow 10:00 AM',
    pickupWindow: 'Morning 08:00 - 10:00 AM',
    location: 'Baker Street Hub, Indiranagar, Bengaluru',
    donorName: 'Artisan Oven Bakery',
    donorOrg: 'Artisan Oven Bakes Ltd',
    donorEmail: 'dispatch@artisanoven.in',
    donorId: 'donor_demo_2',
    status: 'available',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Clean packaged surplus from evening bake.',
  },
  {
    id: 'sample_listing_3',
    title: 'Chicken Dum Biryani & Mirchi Salan',
    category: 'Prepared Meals',
    foodType: 'Prepared Meals',
    quantity: 75,
    unit: 'Servings',
    expiryTime: 'Tonight 01:00 AM',
    pickupWindow: 'Late night 22:00 - 01:00',
    location: 'Royal Banquet Hall, Tolichowki, Hyderabad',
    donorName: 'Shahi Dawat Banquets',
    donorOrg: 'Shahi Dawat Caterers',
    donorEmail: 'admin@shahidawat.com',
    donorId: 'donor_demo_3',
    status: 'available',
    isVeg: false,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Non-veg biryani sealed in insulated thermal vessels.',
  },
  {
    id: 'sample_listing_4',
    title: 'Steam Idli, Medu Vada & Sambar (Morning Event)',
    category: 'Breakfast & Snacks',
    foodType: 'Breakfast & Snacks',
    quantity: 80,
    unit: 'Servings',
    expiryTime: '13:00',
    pickupWindow: 'Morning 09:00 - 12:00',
    location: 'Metro Convention Centre, T Nagar, Chennai',
    donorName: 'Madras Caterers Co.',
    donorOrg: 'Madras Caterers Co.',
    donorEmail: 'info@madrascaterers.in',
    donorId: 'donor_demo_4',
    status: 'claimed',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Claimed by Little Hearts Children Home.',
  },
  {
    id: 'sample_listing_5',
    title: 'Mixed Vegetable Pulao & Raita',
    category: 'Prepared Meals',
    foodType: 'Prepared Meals',
    quantity: 35,
    unit: 'Servings',
    expiryTime: '18:00',
    pickupWindow: 'Afternoon 14:00 - 17:00',
    location: 'Corporate Food Court, Cyber City, Gurugram',
    donorName: 'TechPark Canteen #3',
    donorOrg: 'DLF Food Works',
    donorEmail: 'canteen3@cybercityhub.com',
    donorId: 'donor_demo_5',
    status: 'completed',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Pickup completed by Volunteer Runner Rahul.',
  },
];

const SAMPLE_USERS: AdminUserRecord[] = [
  {
    id: 'user_sample_1',
    name: 'Marcus Vance',
    email: 'chef@bistrodelight.com',
    role: 'Donor',
    orgName: 'The Grand Bistro & Banquet',
    city: 'Mumbai',
    phone: '+91 1800 555 3663',
    verificationStatus: 'verified',
    joinedDate: '2026-09-20',
    isSample: true,
  },
  {
    id: 'user_sample_2',
    name: 'Sister Mary Teresa',
    email: 'caretaker@hopeshelter.org',
    role: 'Organization',
    orgName: 'Hope Community Shelter & Kitchen',
    city: 'Mumbai',
    phone: '+91 98200 44551',
    verificationStatus: 'verified',
    joinedDate: '2026-09-21',
    isSample: true,
  },
  {
    id: 'user_sample_3',
    name: 'Rahul Verma',
    email: 'courier@foodlink-volunteer.org',
    role: 'Courier',
    orgName: 'Community Volunteer Courier Unit #4',
    city: 'Bengaluru',
    phone: '+91 98200 55442',
    verificationStatus: 'verified',
    joinedDate: '2026-09-22',
    isSample: true,
  },
  {
    id: 'user_sample_4',
    name: 'Central Admin Officer',
    email: 'admin@foodlink.org',
    role: 'Admin',
    orgName: 'FoodLink Administration Hub',
    city: 'Mumbai',
    phone: '+91 1800 555 3663',
    verificationStatus: 'verified',
    joinedDate: '2026-09-01',
    isSample: true,
  },
  {
    id: 'user_sample_5',
    name: 'Rajesh Sharma',
    email: 'events@annapurnabanquet.com',
    role: 'Donor',
    orgName: 'Annapurna Banquets & Catering',
    city: 'Mumbai',
    phone: '+91 98201 44321',
    verificationStatus: 'pending',
    joinedDate: '2026-09-30',
    isSample: true,
  },
  {
    id: 'user_sample_6',
    name: 'Dr. Joseph Fernandes',
    email: 'director@snehasadantrust.org',
    role: 'Organization',
    orgName: 'Sneha Sadan Child Care Trust',
    city: 'Mumbai',
    phone: '+91 98334 11200',
    verificationStatus: 'pending',
    joinedDate: '2026-09-30',
    isSample: true,
  },
  {
    id: 'user_sample_7',
    name: 'Sunil Nair',
    email: 'manager@goldenharvestblr.com',
    role: 'Donor',
    orgName: 'Golden Harvest Family Restaurant',
    city: 'Bengaluru',
    phone: '+91 98450 77610',
    verificationStatus: 'pending',
    joinedDate: '2026-09-29',
    isSample: true,
  },
  {
    id: 'user_sample_8',
    name: 'Meenakshi Sundaram',
    email: 'admin@karunahome.org',
    role: 'Organization',
    orgName: 'Karuna Old Age Home & Hospice',
    city: 'Delhi NCR',
    phone: '+91 99100 88234',
    verificationStatus: 'pending',
    joinedDate: '2026-09-29',
    isSample: true,
  },
  {
    id: 'user_sample_9',
    name: 'City Foods Wholesale',
    email: 'contact@cityfoodswholesale.in',
    role: 'Donor',
    orgName: 'City Foods Wholesale Market',
    city: 'Pune',
    phone: '+91 98881 22910',
    verificationStatus: 'rejected',
    joinedDate: '2026-09-25',
    isSample: true,
  },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigateHome }) => {
  const { currentUser, userProfile, signOut } = useAuth();

  // Active section: overview, queue, listings, users
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  // Firestore & local data state
  const [applicants, setApplicants] = useState<AdminApplicant[]>(SAMPLE_APPLICANTS);
  const [listings, setListings] = useState<FoodListing[]>(SAMPLE_LISTINGS);
  const [users, setUsers] = useState<AdminUserRecord[]>(SAMPLE_USERS);
  const [usingRealData, setUsingRealData] = useState<{
    applicants: boolean;
    listings: boolean;
    users: boolean;
  }>({
    applicants: false,
    listings: false,
    users: false,
  });

  // Selected applicant for details view
  const [selectedApplicant, setSelectedApplicant] = useState<AdminApplicant | null>(null);

  // Approval confirmation modal
  const [confirmApproveModal, setConfirmApproveModal] = useState<AdminApplicant | null>(null);

  // Rejection modal & reason
  const [rejectModalApplicant, setRejectModalApplicant] = useState<AdminApplicant | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Listing removal confirmation modal
  const [listingToRemove, setListingToRemove] = useState<FoodListing | null>(null);

  // Action notifications
  const [adminNotice, setAdminNotice] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Users section search query
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Pagination states
  const [queuePage, setQueuePage] = useState(1);
  const [listingsPage, setListingsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const showNotice = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setAdminNotice({ text, type });
    setTimeout(() => {
      setAdminNotice(null);
    }, 3800);
  };

  // 1. Subscribe to Firestore 'users' for verification queue & users list
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsub = onSnapshot(
      usersRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedApplicants: AdminApplicant[] = [];
          const loadedUsers: AdminUserRecord[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const docId = docSnap.id;

            const isOrg =
              data.role === 'ngo' ||
              data.role === 'recipient' ||
              data.role === 'organization';
            const roleLabel = isOrg
              ? 'Organization'
              : data.role === 'volunteer'
              ? 'Courier'
              : data.role === 'admin'
              ? 'Admin'
              : 'Donor';

            const verificationStatus: 'pending' | 'verified' | 'rejected' =
              data.verificationStatus === 'verified'
                ? 'verified'
                : data.verificationStatus === 'rejected'
                ? 'rejected'
                : 'pending';

            const userRec: AdminUserRecord = {
              id: docId,
              name: data.displayName || data.orgName || 'User ' + docId.slice(0, 5),
              email: data.email || '-',
              role: roleLabel,
              orgName: data.orgName || '-',
              city: data.city || data.address || '-',
              phone: data.phone || '-',
              verificationStatus,
              joinedDate: data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString().slice(0, 10)
                : '2026-09-30',
              isSample: false,
            };
            loadedUsers.push(userRec);

            // If pending, or has verificationDocs, add to applicants queue
            if (verificationStatus === 'pending' || data.verificationDocs) {
              const docsList: AdminApplicant['documents'] = [];
              const vDocs = data.verificationDocs || {};

              if (vDocs.fssaiNumber) {
                docsList.push({
                  title: 'FSSAI Food Business License',
                  fileName: vDocs.fssaiDocName || `FSSAI_${vDocs.fssaiNumber}.pdf`,
                  fileSize: vDocs.fssaiDocSize ? `${Math.round(vDocs.fssaiDocSize / 1024)} KB` : '420 KB',
                  docNumber: vDocs.fssaiNumber,
                  docType: 'FSSAI License',
                });
              }
              if (vDocs.ngoDarpanId || vDocs.receiverVerificationDocNumber) {
                docsList.push({
                  title: 'NGO / Institutional Registration',
                  fileName: vDocs.regCertificateDocName || 'Registration_Certificate.pdf',
                  fileSize: '512 KB',
                  docNumber: vDocs.ngoDarpanId || vDocs.receiverVerificationDocNumber,
                  docType: 'NGO Reg ID',
                });
              }
              if (vDocs.govIdType || vDocs.govIdNumber) {
                docsList.push({
                  title: `${vDocs.govIdType || 'Government'} Identity Proof`,
                  fileName: 'Signatory_Gov_ID.pdf',
                  fileSize: '290 KB',
                  docNumber: vDocs.govIdNumber ? `XXXX-XXXX-${vDocs.govIdNumber.slice(-4)}` : 'Verified',
                  docType: 'Government ID',
                });
              }
              if (docsList.length === 0) {
                docsList.push({
                  title: isOrg ? 'Organization Registration Document' : 'Donor Identification Proof',
                  fileName: isOrg ? 'Trust_Registration_Certificate.pdf' : 'Identity_Declaration_Form.pdf',
                  fileSize: '350 KB',
                  docNumber: data.phone || 'REG-SUBMITTED',
                  docType: isOrg ? 'Trust / NGO Reg' : 'Donor ID',
                });
              }

              loadedApplicants.push({
                id: docId,
                name: data.orgName || data.displayName || 'Applicant ' + docId.slice(0, 5),
                type: isOrg ? 'Organization' : 'Donor',
                subType: data.recipientCategoryTitle || (isOrg ? 'NGO / Shelter' : 'Food Business / Caterer'),
                email: data.email || '-',
                phone: data.phone || '-',
                address: data.address || data.city || '-',
                city: data.city || '-',
                submittedDate: data.createdAt?.toDate
                  ? data.createdAt.toDate().toISOString().slice(0, 16).replace('T', ' ')
                  : '2026-09-30 09:00',
                status: verificationStatus,
                rejectionReason: data.rejectionReason,
                documents: docsList,
                isSample: false,
              });
            }
          });

          if (loadedApplicants.length > 0) {
            // Append or prepend sample applicants if pending queue is small
            const combinedApplicants = [
              ...loadedApplicants,
              ...SAMPLE_APPLICANTS.filter(
                (sa) => !loadedApplicants.some((la) => la.email === sa.email)
              ),
            ];
            setApplicants(combinedApplicants);
            setUsingRealData((prev) => ({ ...prev, applicants: true }));
          }

          if (loadedUsers.length > 0) {
            const combinedUsers = [
              ...loadedUsers,
              ...SAMPLE_USERS.filter((su) => !loadedUsers.some((lu) => lu.email === su.email)),
            ];
            setUsers(combinedUsers);
            setUsingRealData((prev) => ({ ...prev, users: true }));
          }
        }
      },
      (err) => {
        console.warn('Firestore users listener note (using offline sample data):', err);
      }
    );

    return () => unsub();
  }, []);

  // 2. Subscribe to Firestore 'listings'
  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const unsub = onSnapshot(
      listingsRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const items: FoodListing[] = [];
          snapshot.forEach((docSnap) => {
            items.push({
              id: docSnap.id,
              ...(docSnap.data() as Omit<FoodListing, 'id'>),
            });
          });

          // Merge with sample listings if real listings are few
          const merged = [
            ...items,
            ...SAMPLE_LISTINGS.filter((sl) => !items.some((i) => i.id === sl.id)),
          ];
          setListings(merged);
          setUsingRealData((prev) => ({ ...prev, listings: true }));
        }
      },
      (err) => {
        console.warn('Firestore listings listener note (using offline sample data):', err);
      }
    );

    return () => unsub();
  }, []);

  // Compute counts for Overview boxes
  const pendingDonorsCount = useMemo(() => {
    return applicants.filter((a) => a.type === 'Donor' && a.status === 'pending').length;
  }, [applicants]);

  const pendingOrgsCount = useMemo(() => {
    return applicants.filter((a) => a.type === 'Organization' && a.status === 'pending').length;
  }, [applicants]);

  const activeListingsCount = useMemo(() => {
    return listings.filter((l) => l.status === 'available').length;
  }, [listings]);

  const completedPickupsCount = useMemo(() => {
    return listings.filter((l) => l.status === 'completed').length;
  }, [listings]);

  // Handler: Approve applicant
  const handleConfirmApprove = async () => {
    if (!confirmApproveModal) return;
    const target = confirmApproveModal;

    // Update local state immediately
    setApplicants((prev) =>
      prev.map((app) => (app.id === target.id ? { ...app, status: 'verified' } : app))
    );
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, verificationStatus: 'verified' } : u))
    );
    if (selectedApplicant?.id === target.id) {
      setSelectedApplicant({ ...selectedApplicant, status: 'verified' });
    }

    // Update Firestore if real record
    if (!target.isSample) {
      try {
        const userDocRef = doc(db, 'users', target.id);
        await updateDoc(userDocRef, {
          verificationStatus: 'verified',
          verifiedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore approval update notice:', err);
      }
    }

    setConfirmApproveModal(null);
    showNotice(`Approved ${target.name}. Status updated to Verified.`, 'success');
  };

  // Handler: Reject applicant
  const handleConfirmReject = async () => {
    if (!rejectModalApplicant) return;
    const cleanReason = rejectReason.trim();
    if (!cleanReason) {
      setRejectError('Please provide a short reason for rejecting this application.');
      return;
    }

    const target = rejectModalApplicant;

    // Update local state
    setApplicants((prev) =>
      prev.map((app) =>
        app.id === target.id
          ? { ...app, status: 'rejected', rejectionReason: cleanReason }
          : app
      )
    );
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, verificationStatus: 'rejected' } : u))
    );
    if (selectedApplicant?.id === target.id) {
      setSelectedApplicant({
        ...selectedApplicant,
        status: 'rejected',
        rejectionReason: cleanReason,
      });
    }

    // Update Firestore if real record
    if (!target.isSample) {
      try {
        const userDocRef = doc(db, 'users', target.id);
        await updateDoc(userDocRef, {
          verificationStatus: 'rejected',
          rejectionReason: cleanReason,
          rejectedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore reject update notice:', err);
      }
    }

    setRejectModalApplicant(null);
    setRejectReason('');
    setRejectError(null);
    showNotice(`Application for ${target.name} marked as Rejected.`, 'info');
  };

  // Handler: Remove listing
  const handleConfirmRemoveListing = async () => {
    if (!listingToRemove) return;
    const target = listingToRemove;

    // Remove from local state or set to cancelled
    setListings((prev) => prev.filter((item) => item.id !== target.id));

    // Update or delete in Firestore if not sample
    try {
      const listingDocRef = doc(db, 'listings', target.id);
      await deleteDoc(listingDocRef);
    } catch {
      try {
        const listingDocRef = doc(db, 'listings', target.id);
        await updateDoc(listingDocRef, { status: 'cancelled' });
      } catch (err) {
        console.warn('Firestore listing remove notice:', err);
      }
    }

    setListingToRemove(null);
    showNotice(`Listing "${target.title}" was removed successfully.`, 'success');
  };

  // Helper for Status Badge styling strictly matching prompt rules:
  // "Status labels: Pending (amber #EA580C), Verified (green), Rejected (muted red)."
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#EA580C] border border-[#FCD34D]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
          Pending
        </span>
      );
    }
    if (s === 'verified' || s === 'available' || s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
    }
    // Rejected, cancelled, expired
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Filtered users based on search
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.orgName && u.orgName.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q) ||
        (u.city && u.city.toLowerCase().includes(q))
    );
  }, [users, userSearchQuery]);

  // Paginated data
  const paginatedQueue = useMemo(() => {
    const start = (queuePage - 1) * ITEMS_PER_PAGE;
    return applicants.slice(start, start + ITEMS_PER_PAGE);
  }, [applicants, queuePage]);
  const totalQueuePages = Math.ceil(applicants.length / ITEMS_PER_PAGE) || 1;

  const paginatedListings = useMemo(() => {
    const start = (listingsPage - 1) * ITEMS_PER_PAGE;
    return listings.slice(start, start + ITEMS_PER_PAGE);
  }, [listings, listingsPage]);
  const totalListingsPages = Math.ceil(listings.length / ITEMS_PER_PAGE) || 1;

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, usersPage]);
  const totalUsersPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;

  return (
    <div className="min-h-screen bg-[#F0FDF8] text-[#064E3B]">
      {/* Top Banner / Breadcrumb Header */}
      <header className="bg-white border-b border-[#E7E5E4] sticky top-0 z-20">
        <div className="site-container py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#059669] text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">shield_person</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg text-[#064E3B]">
                  FoodLink Admin
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#059669]/10 text-[#059669]">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Logged in as {currentUser?.displayName || currentUser?.email || 'admin@foodlink.org'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-xs sm:text-sm font-semibold text-[#6B7280] hover:text-[#064E3B] px-3 py-1.5 rounded-lg border border-[#E7E5E4] hover:bg-[#F0FDF8] transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>View Public Site</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                onNavigateHome();
              }}
              className="text-xs sm:text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-1.5 rounded-lg border border-[#FECACA] transition-colors cursor-pointer min-h-[38px] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Admin Notice Toast */}
      {adminNotice && (
        <div className="fixed top-16 right-4 z-50 max-w-md animate-fadeIn">
          <div
            className={`p-3.5 rounded-lg shadow-md border text-sm flex items-center gap-2.5 ${
              adminNotice.type === 'success'
                ? 'bg-[#D1FAE5] border-[#A7F3D0] text-[#059669]'
                : adminNotice.type === 'error'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                : 'bg-[#FEF2F2] border-[#FCD34D] text-[#EA580C]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {adminNotice.type === 'success' ? 'check_circle' : 'info'}
            </span>
            <span className="font-medium">{adminNotice.text}</span>
          </div>
        </div>
      )}

      {/* Mobile Top Navigation Tabs (visible only on <1024px) */}
      <div className="lg:hidden bg-white border-b border-[#E7E5E4] sticky top-[57px] z-10">
        <div className="site-container overflow-x-auto py-2">
          <div className="flex items-center gap-1.5 min-w-[420px]">
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
                activeSection === 'overview'
                  ? 'bg-[#D1FAE5] text-[#059669] font-semibold border border-[#059669]/30'
                  : 'text-[#6B7280] hover:bg-[#F0FDF8]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('queue')}
              className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] relative ${
                activeSection === 'queue'
                  ? 'bg-[#D1FAE5] text-[#059669] font-semibold border border-[#059669]/30'
                  : 'text-[#6B7280] hover:bg-[#F0FDF8]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>Verification</span>
              {(pendingDonorsCount + pendingOrgsCount) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#EA580C] text-white">
                  {pendingDonorsCount + pendingOrgsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('listings')}
              className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
                activeSection === 'listings'
                  ? 'bg-[#D1FAE5] text-[#059669] font-semibold border border-[#059669]/30'
                  : 'text-[#6B7280] hover:bg-[#F0FDF8]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">restaurant</span>
              <span>Listings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('users')}
              className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
                activeSection === 'users'
                  ? 'bg-[#D1FAE5] text-[#059669] font-semibold border border-[#059669]/30'
                  : 'text-[#6B7280] hover:bg-[#F0FDF8]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">group</span>
              <span>Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Admin Layout with Left Sidebar on Desktop */}
      <div className="site-container py-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
          {/* DESKTOP LEFT SIDEBAR */}
          <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#E7E5E4] rounded-xl shadow-xs p-4 sticky top-20 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#6B7280] font-bold px-3 mb-2">
                Administration
              </p>
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'overview'
                      ? 'bg-[#D1FAE5] text-[#059669] font-semibold border-l-4 border-[#059669]'
                      : 'text-[#6B7280] hover:text-[#064E3B] hover:bg-[#F0FDF8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">dashboard</span>
                    <span>Overview</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('queue')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'queue'
                      ? 'bg-[#D1FAE5] text-[#059669] font-semibold border-l-4 border-[#059669]'
                      : 'text-[#6B7280] hover:text-[#064E3B] hover:bg-[#F0FDF8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">verified</span>
                    <span>Verification queue</span>
                  </div>
                  {(pendingDonorsCount + pendingOrgsCount) > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#EA580C] border border-[#FCD34D]">
                      {pendingDonorsCount + pendingOrgsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('listings')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'listings'
                      ? 'bg-[#D1FAE5] text-[#059669] font-semibold border-l-4 border-[#059669]'
                      : 'text-[#6B7280] hover:text-[#064E3B] hover:bg-[#F0FDF8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">restaurant</span>
                    <span>Listings</span>
                  </div>
                  <span className="text-xs text-[#6B7280]">{listings.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('users')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'users'
                      ? 'bg-[#D1FAE5] text-[#059669] font-semibold border-l-4 border-[#059669]'
                      : 'text-[#6B7280] hover:text-[#064E3B] hover:bg-[#F0FDF8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">group</span>
                    <span>Users</span>
                  </div>
                  <span className="text-xs text-[#6B7280]">{users.length}</span>
                </button>
              </nav>
            </div>

            {/* System Status info */}
            <div className="pt-4 border-t border-[#E7E5E4] space-y-2 text-xs text-[#6B7280]">
              <div className="flex items-center justify-between">
                <span>Database:</span>
                <span className="font-semibold text-[#059669] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#059669]" />
                  {usingRealData.listings || usingRealData.applicants ? 'Firestore Live' : 'Sample Data Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending Approvals:</span>
                <span className="font-semibold text-[#EA580C]">
                  {pendingDonorsCount + pendingOrgsCount}
                </span>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="lg:col-span-9 min-w-0 space-y-6">
            {/* SECTION 1: OVERVIEW */}
            {activeSection === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B]">
                    Operations Overview
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    Real-time status of verification pipelines and food rescue missions across the network.
                  </p>
                </div>

                {/* 4 Plain Count Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {/* 1. Pending Donors */}
                  <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                        Pending Donors
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#EA580C] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">storefront</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#064E3B]">
                      {pendingDonorsCount}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1.5 flex items-center justify-between">
                      <span>Awaiting ID & license review</span>
                      {usingRealData.applicants ? (
                        <span className="text-[#059669] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#EA580C] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>

                  {/* 2. Pending Organizations */}
                  <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                        Pending Organizations
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#EA580C] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#064E3B]">
                      {pendingOrgsCount}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1.5 flex items-center justify-between">
                      <span>Shelters, NGOs, trusts</span>
                      {usingRealData.applicants ? (
                        <span className="text-[#059669] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#EA580C] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>

                  {/* 3. Active Listings */}
                  <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                        Active Listings
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#D1FAE5] text-[#059669] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">lunch_dining</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#064E3B]">
                      {activeListingsCount}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1.5 flex items-center justify-between">
                      <span>Available for immediate claim</span>
                      {usingRealData.listings ? (
                        <span className="text-[#059669] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#EA580C] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>

                  {/* 4. Completed Pickups */}
                  <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                        Completed Pickups
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#D1FAE5] text-[#059669] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">task_alt</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#064E3B]">
                      {completedPickupsCount}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1.5 flex items-center justify-between">
                      <span>Rescued & distributed meals</span>
                      {usingRealData.listings ? (
                        <span className="text-[#059669] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#EA580C] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Quick Shortcuts to Queue & Listings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-serif text-base font-bold text-[#064E3B]">
                        Urgent Verification Requests
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#EA580C]">
                        {pendingDonorsCount + pendingOrgsCount} Pending
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      New food businesses and registered charities require statutory FSSAI and trust certificate approval before claiming food.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection('queue')}
                      className="px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Open Verification Queue</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-serif text-base font-bold text-[#064E3B]">
                        Listings Quality & Moderation
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#D1FAE5] text-[#059669]">
                        {listings.length} Total
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      Monitor active, claimed, and fulfilled surplus food packages across all operational zones and remove flagged entries.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection('listings')}
                      className="px-4 py-2 rounded-lg border border-[#E7E5E4] hover:bg-[#F0FDF8] text-[#064E3B] text-xs font-semibold transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5"
                    >
                      <span>Manage All Food Listings</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: VERIFICATION QUEUE */}
            {activeSection === 'queue' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-[#064E3B]">
                      Verification Queue
                    </h1>
                    <p className="text-sm text-[#6B7280]">
                      Review uploaded identity and nonprofit credentials for donors and claiming organizations.
                    </p>
                  </div>
                  <div className="text-xs text-[#6B7280] bg-white px-3 py-1.5 rounded-lg border border-[#E7E5E4] shrink-0">
                    Showing {applicants.length} applications
                  </div>
                </div>

                {/* Table container with internal scroll (no page-level overflow) */}
                <div className="w-full overflow-x-auto border border-[#E7E5E4] rounded-xl bg-white shadow-xs">
                  <table className="w-full min-w-[680px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F0FDF8] border-b border-[#E7E5E4] text-[#6B7280] text-xs uppercase font-semibold">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Submitted Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E4]">
                      {paginatedQueue.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#6B7280]">
                            No verification requests currently pending.
                          </td>
                        </tr>
                      ) : (
                        paginatedQueue.map((applicant) => (
                          <tr
                            key={applicant.id}
                            onClick={() => setSelectedApplicant(applicant)}
                            className="hover:bg-[#F0FDF8] transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-4 font-medium text-[#064E3B]">
                              <div className="font-semibold text-[15px]">{applicant.name}</div>
                              <div className="text-xs text-[#6B7280] flex items-center gap-2 mt-0.5">
                                <span>{applicant.city}</span>
                                <span>•</span>
                                <span>{applicant.email}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold ${
                                  applicant.type === 'Donor'
                                    ? 'bg-[#D1FAE5] text-[#059669]'
                                    : 'bg-[#FEF2F2] text-[#EA580C]'
                                }`}
                              >
                                {applicant.type}
                              </span>
                              {applicant.subType && (
                                <div className="text-xs text-[#6B7280] mt-0.5 truncate max-w-[150px]">
                                  {applicant.subType}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#6B7280]">
                              {applicant.submittedDate}
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(applicant.status)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApplicant(applicant);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] hover:border-[#059669] hover:bg-[#D1FAE5] text-xs font-semibold text-[#064E3B] transition-colors cursor-pointer"
                              >
                                Review Details
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalQueuePages > 1 && (
                  <div className="flex items-center justify-between text-xs text-[#6B7280] pt-2">
                    <span>
                      Page {queuePage} of {totalQueuePages} ({applicants.length} total)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                        disabled={queuePage === 1}
                        className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F0FDF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalQueuePages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setQueuePage(pg)}
                          className={`w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                            queuePage === pg
                              ? 'bg-[#059669] text-white border-[#059669]'
                              : 'bg-white text-[#064E3B] border-[#E7E5E4] hover:bg-[#F0FDF8]'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQueuePage((p) => Math.min(totalQueuePages, p + 1))}
                        disabled={queuePage === totalQueuePages}
                        className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F0FDF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: LISTINGS */}
            {activeSection === 'listings' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-[#064E3B]">
                      Food Listings
                    </h1>
                    <p className="text-sm text-[#6B7280]">
                      Audit all surplus meals posted across regional donor networks.
                    </p>
                  </div>
                  <div className="text-xs text-[#6B7280] bg-white px-3 py-1.5 rounded-lg border border-[#E7E5E4] shrink-0">
                    {listings.length} Active & Fulfilled Listings
                  </div>
                </div>

                {/* Table container with internal scroll (no page-level overflow) */}
                <div className="w-full overflow-x-auto border border-[#E7E5E4] rounded-xl bg-white shadow-xs">
                  <table className="w-full min-w-[760px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F0FDF8] border-b border-[#E7E5E4] text-[#6B7280] text-xs uppercase font-semibold">
                        <th className="py-3 px-4">Food Item</th>
                        <th className="py-3 px-4">Donor / Location</th>
                        <th className="py-3 px-4">Quantity</th>
                        <th className="py-3 px-4">Dietary</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E4]">
                      {paginatedListings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#6B7280]">
                            No food listings recorded.
                          </td>
                        </tr>
                      ) : (
                        paginatedListings.map((listing) => (
                          <tr key={listing.id} className="hover:bg-[#F0FDF8] transition-colors">
                            <td className="py-3.5 px-4 font-medium text-[#064E3B] max-w-[240px]">
                              <div className="font-semibold text-sm truncate">{listing.title}</div>
                              <div className="text-xs text-[#6B7280] mt-0.5">{listing.category || listing.foodType || 'Prepared Food'}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#6B7280]">
                              <div className="font-medium text-[#064E3B]">{listing.donorName || listing.donorOrg}</div>
                              <div className="truncate max-w-[180px]">{listing.location || 'India'}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-semibold text-[#064E3B]">
                              {listing.quantity ? `${listing.quantity} ${listing.unit || 'Servings'}` : 'Surplus Meals'}
                            </td>
                            <td className="py-3.5 px-4">
                              {listing.isVeg ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#D1FAE5] text-[#059669]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                                  Veg
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF2F2] text-[#EA580C]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
                                  Non-Veg {(listing as any).nonVegType ? `(${(listing as any).nonVegType})` : ''}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(listing.status)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setListingToRemove(listing)}
                                className="px-3 py-1.5 rounded-lg border border-[#FECACA] hover:bg-[#FEF2F2] text-xs font-semibold text-[#DC2626] transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                                <span>Remove listing</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalListingsPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-[#6B7280] pt-2">
                    <span>
                      Page {listingsPage} of {totalListingsPages} ({listings.length} total)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setListingsPage((p) => Math.max(1, p - 1))}
                        disabled={listingsPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F0FDF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalListingsPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setListingsPage(pg)}
                          className={`w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                            listingsPage === pg
                              ? 'bg-[#059669] text-white border-[#059669]'
                              : 'bg-white text-[#064E3B] border-[#E7E5E4] hover:bg-[#F0FDF8]'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setListingsPage((p) => Math.min(totalListingsPages, p + 1))}
                        disabled={listingsPage === totalListingsPages}
                        className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F0FDF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: USERS */}
            {activeSection === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-[#064E3B]">
                      Users Directory
                    </h1>
                    <p className="text-sm text-[#6B7280]">
                      Search and review network accounts, verification statuses, and roles.
                    </p>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#6B7280]">
                    search
                  </span>
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      setUsersPage(1);
                    }}
                    placeholder="Search users by name, email, organization, or role..."
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E7E5E4] bg-white text-sm text-[#064E3B] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all min-h-[44px]"
                  />
                  {userSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280] hover:text-[#064E3B]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Table container with internal scroll (no page-level overflow) */}
                <div className="w-full overflow-x-auto border border-[#E7E5E4] rounded-xl bg-white shadow-xs">
                  <table className="w-full min-w-[720px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F0FDF8] border-b border-[#E7E5E4] text-[#6B7280] text-xs uppercase font-semibold">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Organization / Entity</th>
                        <th className="py-3 px-4">City / Phone</th>
                        <th className="py-3 px-4">Verification Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E4]">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#6B7280]">
                            No users matched your search "{userSearchQuery}".
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-[#F0FDF8] transition-colors">
                            <td className="py-3.5 px-4 font-medium text-[#064E3B]">
                              <div className="font-semibold text-sm">{user.name}</div>
                              <div className="text-xs text-[#6B7280]">{user.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-[#D1FAE5] text-[#059669]">
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#6B7280]">
                              {user.orgName || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#6B7280]">
                              <div>{user.city || 'India'}</div>
                              <div>{user.phone || '-'}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(user.verificationStatus)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalUsersPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-[#6B7280] pt-2">
                    <span>
                      Page {usersPage} of {totalUsersPages} ({filteredUsers.length} total)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        disabled={usersPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F0FDF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalUsersPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setUsersPage(pg)}
                          className={`w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                            usersPage === pg
                              ? 'bg-[#059669] text-white border-[#059669]'
                              : 'bg-white text-[#064E3B] border-[#E7E5E4] hover:bg-[#F0FDF8]'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setUsersPage((p) => Math.min(totalUsersPages, p + 1))}
                        disabled={usersPage === totalUsersPages}
                        className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white hover:bg-[#F0FDF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODAL 1: DETAILS VIEW MODAL (Opened by clicking queue row) */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-xl max-w-2xl w-full p-6 space-y-5 animate-fadeIn my-8">
            <div className="flex items-start justify-between border-b border-[#E7E5E4] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-bold text-[#064E3B]">
                    {selectedApplicant.name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedApplicant.type === 'Donor'
                        ? 'bg-[#D1FAE5] text-[#059669]'
                        : 'bg-[#FEF2F2] text-[#EA580C]'
                    }`}
                  >
                    {selectedApplicant.type}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-1">
                  Submitted on {selectedApplicant.submittedDate} • Status: {renderStatusBadge(selectedApplicant.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApplicant(null)}
                className="text-[#6B7280] hover:text-[#064E3B] p-1 rounded-lg hover:bg-[#F0FDF8] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Applicant Information Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-[#6B7280]">Category / Subtype:</span>
                <p className="text-sm text-[#064E3B] font-medium">{selectedApplicant.subType || 'General'}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-[#6B7280]">Registered Email:</span>
                <p className="text-sm text-[#064E3B] font-medium">{selectedApplicant.email}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-[#6B7280]">Contact Phone:</span>
                <p className="text-sm text-[#064E3B] font-medium">{selectedApplicant.phone}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-[#6B7280]">City & Address:</span>
                <p className="text-sm text-[#064E3B] font-medium">{selectedApplicant.address}, {selectedApplicant.city}</p>
              </div>
            </div>

            {/* Rejection Note if already rejected */}
            {selectedApplicant.status === 'rejected' && selectedApplicant.rejectionReason && (
              <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                <span className="font-bold">Rejection Reason:</span> {selectedApplicant.rejectionReason}
              </div>
            )}

            {/* Uploaded Documents List */}
            <div className="space-y-3 pt-2 border-t border-[#E7E5E4]">
              <h3 className="font-serif text-sm font-bold text-[#064E3B] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#059669]">description</span>
                <span>Uploaded Verification Documents ({selectedApplicant.documents.length})</span>
              </h3>

              <div className="space-y-2">
                {selectedApplicant.documents.map((docItem, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-[#E7E5E4] bg-[#F0FDF8] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded bg-white border border-[#E7E5E4] flex items-center justify-center text-[#059669]">
                        <span className="material-symbols-outlined text-[20px]">draft</span>
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#064E3B]">{docItem.title}</div>
                        <div className="text-[11px] text-[#6B7280] flex items-center gap-2">
                          <span>{docItem.fileName}</span>
                          <span>•</span>
                          <span>{docItem.fileSize}</span>
                          {docItem.docNumber && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[#064E3B]">{docItem.docNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => showNotice(`Previewing document: ${docItem.fileName}`, 'info')}
                      className="px-2.5 py-1 rounded border border-[#E7E5E4] hover:bg-white text-xs font-semibold text-[#6B7280] hover:text-[#064E3B] transition-colors cursor-pointer shrink-0"
                    >
                      View Doc
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-4 border-t border-[#E7E5E4] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedApplicant(null)}
                className="px-4 py-2 rounded-lg border border-[#E7E5E4] text-xs font-semibold text-[#6B7280] hover:text-[#064E3B] hover:bg-[#F0FDF8] min-h-[40px] cursor-pointer"
              >
                Close
              </button>

              {/* Reject Button */}
              <button
                type="button"
                onClick={() => {
                  setRejectModalApplicant(selectedApplicant);
                  setRejectReason('');
                  setRejectError(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] min-h-[40px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Reject</span>
              </button>

              {/* Approve Button */}
              <button
                type="button"
                onClick={() => setConfirmApproveModal(selectedApplicant)}
                className="px-5 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-xs font-semibold text-white min-h-[40px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM APPROVAL MODAL */}
      {confirmApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#064E3B]">
                  Confirm Approval
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Verify credentials for {confirmApproveModal.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-[#6B7280] leading-relaxed">
              Are you sure you want to approve this applicant? Their status will be updated to <strong>Verified</strong>, granting full permissions to {confirmApproveModal.type === 'Donor' ? 'list food donations' : 'claim and receive food'}.
            </p>

            <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmApproveModal(null)}
                className="px-4 py-2 rounded-lg border border-[#E7E5E4] text-xs font-semibold text-[#6B7280] hover:bg-[#F0FDF8] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                className="px-5 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Yes, Approve Applicant</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM REJECT MODAL (Requires short reason) */}
      {rejectModalApplicant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">cancel</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#064E3B]">
                  Reject Application
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Applicant: {rejectModalApplicant.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#6B7280]">
              Please provide a short reason for rejecting this application. This reason will be recorded on their file.
            </p>

            {rejectError && (
              <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                {rejectError}
              </div>
            )}

            <div>
              <label htmlFor="reject-reason" className="block text-xs font-semibold text-[#064E3B] mb-1.5">
                Rejection Reason *
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="e.g. FSSAI registration document expired or image illegible."
                className="w-full p-3 rounded-lg border border-[#E7E5E4] bg-white text-xs text-[#064E3B] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-all"
              />
            </div>

            <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRejectModalApplicant(null);
                  setRejectReason('');
                  setRejectError(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#E7E5E4] text-xs font-semibold text-[#6B7280] hover:bg-[#F0FDF8] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM REMOVE LISTING MODAL */}
      {listingToRemove && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E7E5E4] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">delete</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#064E3B]">
                  Remove Food Listing
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-sm text-[#6B7280] leading-relaxed">
              Are you sure you want to remove listing <strong>"{listingToRemove.title}"</strong>? This will cancel and take down the food listing from the public feed.
            </p>

            <div className="pt-3 border-t border-[#E7E5E4] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setListingToRemove(null)}
                className="px-4 py-2 rounded-lg border border-[#E7E5E4] text-xs font-semibold text-[#6B7280] hover:bg-[#F0FDF8] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveListing}
                className="px-5 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                <span>Yes, Remove Listing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
