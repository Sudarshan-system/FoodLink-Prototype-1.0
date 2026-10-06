import React from 'react';
import { useAuth } from '../auth/AuthContext';

interface VerificationModuleProps {
  onOpenAuth: () => void;
  onNavigateDonor?: () => void;
  onNavigateRecipient?: () => void;
}

export const VerificationModule: React.FC<VerificationModuleProps> = ({
  onOpenAuth,
  onNavigateDonor,
  onNavigateRecipient,
}) => {
  const { currentUser, userProfile, signInAsDemo } = useAuth();

  // Helper for status label styling:
  // Pending (amber #EA580C), Verified (green), Rejected (muted red)
  const renderStatusBadge = (status?: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'verified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
          Verified
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#EA580C] border border-[#FCD34D]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
        Pending
      </span>
    );
  };

  // Rejection reason fallback
  const rejectionReason =
    (userProfile as any)?.rejectionReason ||
    'Document image was unreadable or FSSAI registration could not be verified in the national database. Please re-upload a clear copy.';

  return (
    <div className="w-full">
      {/* TWO-COLUMN LAYOUT: Left Side Explanation & Food Checks, Right Side Verification Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* LEFT SIDE: Plain explanation in numbered lists */}
        <div className="lg:col-span-7 space-y-10">
          {/* SECTION 1: For donors */}
          <section className="space-y-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#064E3B]">
                For donors
              </h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Restaurants, hotels, caterers, and food businesses must verify their identity before publishing food donations.
              </p>
            </div>

            <div className="text-sm text-[#064E3B] space-y-3">
              <p className="font-semibold text-[#064E3B]">What is needed:</p>
              <ol className="list-decimal list-outside ml-5 space-y-2 text-[#6B7280] leading-relaxed">
                <li>
                  <strong className="text-[#064E3B]">Establishment &amp; contact details:</strong> Business or kitchen name, manager name, phone number, and physical dispatch address.
                </li>
                <li>
                  <strong className="text-[#064E3B]">Food safety registration:</strong> 14-digit FSSAI Food Business Operator license number or valid government identity proof (Aadhaar or PAN) for event donors.
                </li>
                <li>
                  <strong className="text-[#064E3B]">Handling confirmation:</strong> Agreement to prepare, store, and package all surplus food in clean food-grade containers.
                </li>
              </ol>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F0FDF8] border border-[#E7E5E4] text-xs text-[#6B7280]">
              <strong className="text-[#064E3B]">How long review takes:</strong> We will notify you by email.
            </div>
          </section>

          {/* SECTION 2: For organizations */}
          <section className="space-y-4 pt-6 border-t border-[#E7E5E4]">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#064E3B]">
                For organizations
              </h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Shelters, orphanages, old age homes, and community kitchens must register to ensure safe distribution to beneficiaries.
              </p>
            </div>

            <div className="text-sm text-[#064E3B] space-y-3">
              <p className="font-semibold text-[#064E3B]">What is needed:</p>
              <ol className="list-decimal list-outside ml-5 space-y-2 text-[#6B7280] leading-relaxed">
                <li>
                  <strong className="text-[#064E3B]">Institutional details:</strong> Organization legal name, type of institution (orphanage, shelter, old age home, care home, community kitchen), and operational address.
                </li>
                <li>
                  <strong className="text-[#064E3B]">Registration documentation:</strong> Society Registration Certificate, Public Trust Deed, Section 8 license, or NITI Aayog NGO Darpan unique identification number.
                </li>
                <li>
                  <strong className="text-[#064E3B]">Authorized intake officer:</strong> Name and direct phone number of the coordinator responsible for receiving and inspecting food parcels.
                </li>
              </ol>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F0FDF8] border border-[#E7E5E4] text-xs text-[#6B7280]">
              <strong className="text-[#064E3B]">How long review takes:</strong> We will notify you by email.
            </div>
          </section>

          {/* SECTION 3: How we check food */}
          <section className="space-y-4 pt-6 border-t border-[#E7E5E4]">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#064E3B]">
                How we check food
              </h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Every surplus food listing undergoes a systematic 5-point verification standard before and during handover.
              </p>
            </div>

            <ol className="list-decimal list-outside ml-5 space-y-3 text-sm text-[#6B7280] leading-relaxed">
              <li>
                <strong className="text-[#064E3B]">Prepared time:</strong> Donors record the exact cooking date and time so recipient shelters know the freshness timeline of every meal.
              </li>
              <li>
                <strong className="text-[#064E3B]">Storage:</strong> Temperature integrity is declared as hot and covered (above 60°C), refrigerated (below 5°C), or room temperature sealed.
              </li>
              <li>
                <strong className="text-[#064E3B]">Allergen declaration:</strong> Complete declaration of common allergens (Nuts, Dairy, Gluten, Eggs, Soy, or None) to protect vulnerable individuals.
              </li>
              <li>
                <strong className="text-[#064E3B]">Safe holding window:</strong> Automated countdown timer calculates the maximum safe consumption window; items with less than 1 hour remaining are automatically closed.
              </li>
              <li>
                <strong className="text-[#064E3B]">Offline check at pickup:</strong> A mandatory visual and temperature inspection is conducted at pickup before the food is handed over to the receiving organization.
              </li>
            </ol>
          </section>
        </div>

        {/* RIGHT SIDE (or below on mobile): Verification Status or Sign-in Prompt */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          {currentUser ? (
            /* Signed In: Show Verification Status Card */
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-[#E7E5E4] pb-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#064E3B]">
                    Your verification status
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Account: {currentUser.email}
                  </p>
                </div>
                <div>
                  {renderStatusBadge(userProfile?.verificationStatus)}
                </div>
              </div>

              {/* Account Details */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B7280]">Account Name:</span>
                  <span className="font-bold text-[#064E3B]">
                    {userProfile?.displayName || currentUser.displayName || 'Member'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B7280]">Role:</span>
                  <span className="font-semibold text-[#059669] capitalize">
                    {userProfile?.role === 'ngo' || userProfile?.role === 'recipient'
                      ? 'Organization'
                      : userProfile?.role === 'volunteer'
                      ? 'Courier'
                      : userProfile?.role === 'admin'
                      ? 'Admin'
                      : 'Donor'}
                  </span>
                </div>

                {userProfile?.orgName && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280]">Organization:</span>
                    <span className="font-medium text-[#064E3B]">
                      {userProfile.orgName}
                    </span>
                  </div>
                )}

                {userProfile?.phone && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280]">Phone:</span>
                    <span className="text-[#064E3B]">{userProfile.phone}</span>
                  </div>
                )}
              </div>

              {/* Status Specific Message & Rejection Reason */}
              {userProfile?.verificationStatus === 'rejected' ? (
                <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#DC2626]">
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    <span>Application Rejected</span>
                  </div>
                  <div className="text-xs text-[#DC2626] leading-relaxed">
                    <strong className="block mb-1">Reason for rejection:</strong>
                    <span>{rejectionReason}</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] pt-1">
                    Please review your documents or contact verification support at contact@foodlink.org.
                  </p>
                </div>
              ) : userProfile?.verificationStatus === 'verified' || userProfile?.isDemo ? (
                <div className="p-4 rounded-xl bg-[#D1FAE5] border border-[#A7F3D0] space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#059669]">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Account Fully Verified</span>
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    Your profile and food safety credentials are verified. You have full access to donate surplus food or claim parcels for your institution.
                  </p>
                  {onNavigateDonor && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={onNavigateDonor}
                        className="px-3.5 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Go to Donor Portal →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCD34D] space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#EA580C]">
                    <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
                    <span>Review in Progress</span>
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    Your documents have been submitted and are currently in the verification queue. We will notify you by email as soon as the review is complete.
                  </p>
                </div>
              )}

              {/* Demo status toggle helper for review */}
              <div className="pt-2 border-t border-[#E7E5E4] flex items-center justify-between text-xs text-[#6B7280]">
                <span>Reviewer demo shortcut:</span>
                <button
                  type="button"
                  onClick={() => signInAsDemo('restaurant')}
                  className="font-semibold text-[#059669] hover:underline"
                >
                  Switch to Verified Donor
                </button>
              </div>
            </div>
          ) : (
            /* Signed Out: Show "Sign in to see your status" */
            <div className="bg-[#D1FAE5] border border-[#E7E5E4] rounded-2xl p-7 text-center space-y-5">
              <div className="w-12 h-12 rounded-xl bg-[#059669]/15 text-[#059669] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[28px]">verified_user</span>
              </div>

              <div>
                <h3 className="font-serif text-xl font-bold text-[#064E3B]">
                  Check your verification status
                </h3>
                <p className="text-sm text-[#6B7280] mt-2 leading-relaxed">
                  Sign in with your FoodLink account to view whether your donor or organization application is pending, verified, or requires updated documents.
                </p>
              </div>

              {/* Sign in to see your status button */}
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[48px]"
              >
                <span className="material-symbols-outlined text-[20px]">login</span>
                <span>Sign in to see your status</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
