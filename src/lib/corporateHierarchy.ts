/**
 * Multi-Branch Corporate Account Hierarchy
 * Allows central enterprise corporate accounts (e.g., hotel chains, IT cafeteria operators)
 * to manage multiple branch profiles (kitchens/properties) across cities with centralized impact
 * metrics and manager approvals.
 */

export interface CorporateBranch {
  id: string;
  name: string;
  city: string;
  location: string;
  fssaiNumber: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  totalKgRescued: number;
  totalRuns: number;
  isActive: boolean;
}

export interface CorporateAccount {
  id: string;
  name: string;
  legalEntity: string;
  cinNumber: string;
  panNumber: string;
  centralContactEmail: string;
  branches: CorporateBranch[];
}

export const DEMO_CORPORATE_ACCOUNT: CorporateAccount = {
  id: 'corp-taj-hospitality-group',
  name: 'Taj Hospitality Network India',
  legalEntity: 'The Indian Hotels Company Limited (IHCL)',
  cinNumber: 'L55101MH1903PLC000199',
  panNumber: 'AABCT1234F',
  centralContactEmail: 'sustainability@tajhotels.com',
  branches: [
    {
      id: 'branch-taj-lands-end',
      name: 'Taj Lands End - Bandra West',
      city: 'Mumbai',
      location: 'Bandstand, BJ Road, Bandra West, Mumbai 400050',
      fssaiNumber: '11516002000341',
      managerName: 'Executive Chef Marcus Vance',
      managerPhone: '+91 98200 55442',
      managerEmail: 'marcus.vance@tajhotels.com',
      totalKgRescued: 460,
      totalRuns: 18,
      isActive: true,
    },
    {
      id: 'branch-taj-mahal-palace',
      name: 'The Taj Mahal Palace - Colaba',
      city: 'Mumbai',
      location: 'Apollo Bunder, Colaba, Mumbai 400001',
      fssaiNumber: '11515001000129',
      managerName: 'Chef Hemant Oberoi',
      managerPhone: '+91 98201 44331',
      managerEmail: 'kitchen.colaba@tajhotels.com',
      totalKgRescued: 520,
      totalRuns: 22,
      isActive: true,
    },
    {
      id: 'branch-taj-santacruz',
      name: 'Taj Santacruz - Airport Terminal Kitchen',
      city: 'Mumbai',
      location: 'Chhatrapati Shivaji Maharaj Airport, Santacruz East',
      fssaiNumber: '11517004000215',
      managerName: 'Sous Chef Rajesh Nair',
      managerPhone: '+91 98202 88776',
      managerEmail: 'kitchen.santacruz@tajhotels.com',
      totalKgRescued: 290,
      totalRuns: 11,
      isActive: true,
    },
    {
      id: 'branch-taj-west-end',
      name: 'Taj West End - Race Course Road',
      city: 'Bengaluru',
      location: 'Race Course Road, High Grounds, Bengaluru 560001',
      fssaiNumber: '11218001000452',
      managerName: 'Chef Ananya Rao',
      managerPhone: '+91 98450 33221',
      managerEmail: 'kitchen.westend@tajhotels.com',
      totalKgRescued: 340,
      totalRuns: 14,
      isActive: true,
    },
  ],
};

const STORAGE_KEY_BRANCH = 'foodlink_active_corporate_branch';
const STORAGE_KEY_CORP = 'foodlink_corporate_account';

export function loadCorporateAccount(): CorporateAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CORP);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEMO_CORPORATE_ACCOUNT;
}

export function saveCorporateAccount(acc: CorporateAccount): void {
  try {
    localStorage.setItem(STORAGE_KEY_CORP, JSON.stringify(acc));
  } catch {}
}

export function getSelectedBranchId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BRANCH);
    if (raw) return raw;
  } catch {}
  return 'all'; // 'all' means consolidated corporate view
}

export function setSelectedBranchId(branchId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_BRANCH, branchId);
  } catch {}
}

export function getBranchById(id: string): CorporateBranch | undefined {
  const account = loadCorporateAccount();
  return account.branches.find((b) => b.id === id);
}

export interface CorporateAggregates {
  totalKgRescued: number;
  totalMealsServed: number;
  totalCo2SavedKg: number;
  activeBranchesCount: number;
  totalRuns: number;
}

export function computeCorporateAggregates(account?: CorporateAccount): CorporateAggregates {
  const acc = account || loadCorporateAccount();
  const totalKgRescued = acc.branches.reduce((sum, b) => sum + (b.totalKgRescued || 0), 0);
  const totalRuns = acc.branches.reduce((sum, b) => sum + (b.totalRuns || 0), 0);
  const activeBranchesCount = acc.branches.filter((b) => b.isActive).length;
  const totalMealsServed = Math.round(totalKgRescued * 2.5);
  const totalCo2SavedKg = Math.round(totalKgRescued * 2.45 * 100) / 100;

  return {
    totalKgRescued,
    totalMealsServed,
    totalCo2SavedKg,
    activeBranchesCount,
    totalRuns,
  };
}
