import React, { useState } from 'react';
import { useLanguage } from '../../lib/i18n';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Who can donate food through FoodLink?',
    a: 'Restaurants, wedding halls, banquet caterers, and corporate dining facilities with surplus unserved food can post listings. All donations must be unserved and packed in food-grade containers.',
  },
  {
    q: 'Who is eligible to claim food donations?',
    a: 'Only verified organizations can claim surplus batches. This includes registered NGOs, orphanages, elder care homes, and certified community kitchens verified through official credentials like NGO Darpan or trust registration.',
  },
  {
    q: 'How does FoodLink verify food safety?',
    a: 'Donors state the prepared time and the safe consumption window (hot meals must be consumed within 4 hours). Receiving shelters inspect container integrity and temperature before confirming delivery.',
  },
  {
    q: 'Can individual volunteers help with pickup and delivery?',
    a: 'Yes. Citizens can register as Volunteer Couriers with valid identity proof to transport food packages between donors and nearby shelters using bikes, autos, or vans.',
  },
  {
    q: 'Are there any platform or transaction fees?',
    a: 'No. FoodLink is completely free to use for both donors and receiving charities. Donors also receive verified CSR impact certificates and environmental records.',
  },
];

export function FaqSection() {
  const { t } = useLanguage();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <section className="border-t border-[#E7E5E4] dark:border-[#1E5C38] bg-[#F0FDF8] dark:bg-[#071A12] py-12 sm:py-16 lg:py-20">
      <div className="site-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column (Heading & Subtext) */}
          <div className="lg:col-span-5">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#064E3B] dark:text-[#F0FDF8] mb-3">
              {t('faqTitle', 'Frequently asked questions')}
            </h2>
            <p className="text-base text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed mb-6 max-w-[65ch]">
              {t('faqSubtitle', 'Answers to common questions about donation guidelines, organization verification, and food safety standards.')}
            </p>
            <div className="p-5 rounded-lg bg-[#D1FAE5] dark:bg-[#064E3B] border border-[#E7E5E4] dark:border-[#1E5C38] text-sm text-[#064E3B] dark:text-[#F0FDF8]">
              <div className="flex items-center gap-2 font-bold mb-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#059669]">support_agent</span>
                <span>{t('needAssistance', 'Need direct assistance?')}</span>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed mb-3">
                {t('supportDeskDesc', 'Our coordination desk helps caterers, wedding organizers, and shelters set up emergency pickups.')}
              </p>
              <span className="font-semibold text-xs text-[#059669]">{t('supportEmail', 'Email: support@foodlink.org')}</span>
            </div>
          </div>

          {/* Right Column (Accordion List) */}
          <div className="lg:col-span-7 divide-y divide-[#E7E5E4] dark:divide-[#1E5C38] border-y border-[#E7E5E4] dark:border-[#1E5C38]">
            {FAQ_ITEMS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full text-left flex items-center justify-between gap-4 py-2 cursor-pointer font-bold text-base text-[#064E3B] dark:text-[#F0FDF8] hover:text-[#059669] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="material-symbols-outlined text-[20px] text-[#6B7280] dark:text-[#9CA3AF] shrink-0">
                      {isOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pt-2 pb-3 text-sm sm:text-base text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed max-w-[65ch]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
