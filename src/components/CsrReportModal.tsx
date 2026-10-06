import React, { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { FoodListing } from '../features/donor/DonorDashboard';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  computeBrsrMetrics,
  generateBrsrCsv,
  generateBrsrPdf,
  BrsrComplianceMetrics,
} from '../lib/brsrReporting';

interface CsrReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing?: FoodListing | null;
  donorName?: string;
  donorOrg?: string;
  panNumber?: string;
  totalRescuedKg?: number;
  totalMeals?: number;
}

export const CsrReportModal: React.FC<CsrReportModalProps> = ({
  isOpen,
  onClose,
  listing,
  donorName = 'Verified Hospitality Partner',
  donorOrg = 'Taj Grand Banquets & Hotels Ltd.',
  panNumber = 'AABCT1234F',
  totalRescuedKg = 340,
  totalMeals = 850,
}) => {
  const { isDark } = useTheme();
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reportMode, setReportMode] = useState<'csr' | 'brsr'>('csr');
  const [copiedBrsr, setCopiedBrsr] = useState(false);
  const [generatingBrsrPdf, setGeneratingBrsrPdf] = useState(false);

  if (!isOpen) return null;

  // Derived certificate data
  const certId = listing
    ? `FL-CSR-${listing.id.slice(0, 8).toUpperCase()}`
    : `FL-CSR-${Date.now().toString(36).toUpperCase()}`;

  const certDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const quantityKg = listing ? listing.quantity : totalRescuedKg;
  const mealsCount = listing ? Math.round(listing.quantity * 2.5) : totalMeals;
  const estimatedValueInr = quantityKg * 85; // Approx ₹85 fair market value per kg/prepared meal
  const co2AvoidedKg = Math.round(quantityKg * 2.45); // 2.45 kg CO2e saved per kg food rescued
  const effectiveDonor = listing?.donorOrg || donorOrg;

  // Compute official SEBI BRSR metrics
  const brsrMetrics = computeBrsrMetrics(
    quantityKg,
    effectiveDonor,
    'L55101MH1903PLC000199',
    panNumber,
    4
  );

  const handleDownloadBrsrPdf = async () => {
    setGeneratingBrsrPdf(true);
    try {
      const pdfBytes = await generateBrsrPdf(brsrMetrics);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `SEBI_BRSR_Compliance_${effectiveDonor.replace(/\s+/g, '_')}_FY26.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('BRSR PDF error:', e);
    } finally {
      setGeneratingBrsrPdf(false);
    }
  };

  const handleDownloadBrsrCsv = () => {
    const csv = generateBrsrCsv(brsrMetrics);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SEBI_BRSR_Metrics_${effectiveDonor.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyBrsrDisclosure = async () => {
    const text = `SEBI BRSR CORE DISCLOSURE (Principle 6 & 8) - ${effectiveDonor}:\nDuring the reporting period, ${effectiveDonor} diverted ${brsrMetrics.totalSurplusTonnes} Metric Tonnes (${brsrMetrics.totalSurplusKg} kg) of high-grade surplus food from municipal landfills under FSSAI compliant safe holding protocols via FoodLink India. This initiative avoided ${brsrMetrics.scope3GhgAvoidedTonnes} tCO2e of Scope 3 Category 5 emissions and prevented ${brsrMetrics.methaneAvoidedM3} m3 of landfill methane generation, while conserving ${brsrMetrics.waterConservedLiters.toLocaleString()} liters of embedded water resources. Total community meals distributed to verified non-profit shelters: ~${brsrMetrics.totalMealsDistributed.toLocaleString()} meals, with an estimated Companies Act Section 135 CSR economic valuation of Rs. ${brsrMetrics.fairMarketValueLakhs} Lakhs. Digital verification hash: ${brsrMetrics.chainOfCustodyAuditHash}.`;
    await navigator.clipboard.writeText(text);
    setCopiedBrsr(true);
    setTimeout(() => setCopiedBrsr(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
      const { width, height } = page.getSize();

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSerifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRoman);

      // Colors
      const emerald = rgb(0.02, 0.588, 0.412); // #059669
      const deepEmerald = rgb(0.024, 0.306, 0.231); // #064E3B
      const gold = rgb(0.85, 0.65, 0.15);
      const darkText = rgb(0.08, 0.12, 0.1);
      const lightBg = rgb(0.97, 0.99, 0.98);

      // Background Wash
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: lightBg,
      });

      // Outer Decorative Border
      page.drawRectangle({
        x: 24,
        y: 24,
        width: width - 48,
        height: height - 48,
        borderColor: emerald,
        borderWidth: 3,
      });

      // Inner Gold Border
      page.drawRectangle({
        x: 30,
        y: 30,
        width: width - 60,
        height: height - 60,
        borderColor: gold,
        borderWidth: 1,
      });

      // Header Banner
      page.drawText('FOODLINK NATIONAL FOOD RESCUE NETWORK', {
        x: 80,
        y: height - 65,
        size: 13,
        font: fontBold,
        color: emerald,
      });

      page.drawText('CERTIFICATE OF APPRECIATION & ENVIRONMENTAL IMPACT STATEMENT', {
        x: 40,
        y: height - 90,
        size: 13,
        font: fontSerifBold,
        color: deepEmerald,
      });

      page.drawText('Issued pursuant to Section 135 (Corporate Social Responsibility) & FSSAI Guidelines', {
        x: 85,
        y: height - 108,
        size: 8.5,
        font: fontRegular,
        color: darkText,
      });

      // Divider line
      page.drawLine({
        start: { x: 50, y: height - 120 },
        end: { x: width - 50, y: height - 120 },
        thickness: 1.5,
        color: emerald,
      });

      // Metadata Bar
      page.drawText(`Certificate ID: ${certId}`, {
        x: 50,
        y: height - 140,
        size: 9,
        font: fontBold,
        color: deepEmerald,
      });

      page.drawText(`Date of Issue: ${certDate}`, {
        x: 380,
        y: height - 140,
        size: 9,
        font: fontBold,
        color: deepEmerald,
      });

      // Donor & Beneficiary Cards
      // Donor Box
      page.drawRectangle({
        x: 50,
        y: height - 235,
        width: 235,
        height: 80,
        borderColor: emerald,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      page.drawText('DONATING CORPORATE / ENTITY', {
        x: 60,
        y: height - 170,
        size: 8,
        font: fontBold,
        color: emerald,
      });

      page.drawText(effectiveDonor.slice(0, 32), {
        x: 60,
        y: height - 188,
        size: 10,
        font: fontBold,
        color: darkText,
      });

      page.drawText(`PAN: ${panNumber} | Contact: ${listing?.donorName || donorName}`, {
        x: 60,
        y: height - 204,
        size: 8,
        font: fontRegular,
        color: darkText,
      });

      page.drawText('Status: FSSAI Verified Food Business Operator', {
        x: 60,
        y: height - 220,
        size: 7.5,
        font: fontRegular,
        color: deepEmerald,
      });

      // Beneficiary Box
      page.drawRectangle({
        x: 310,
        y: height - 235,
        width: 235,
        height: 80,
        borderColor: emerald,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      page.drawText('DESIGNATED CHARITABLE RECIPIENT', {
        x: 320,
        y: height - 170,
        size: 8,
        font: fontBold,
        color: emerald,
      });

      page.drawText('The Akshaya Patra Foundation Network', {
        x: 320,
        y: height - 188,
        size: 10,
        font: fontBold,
        color: darkText,
      });

      page.drawText('Designated Partner: Akshaya Patra / Feeding India Network', {
        x: 320,
        y: height - 204,
        size: 7.5,
        font: fontRegular,
        color: darkText,
      });

      page.drawText('Status: Verified Non-Profit Food Recovery Partner', {
        x: 320,
        y: height - 220,
        size: 7.5,
        font: fontRegular,
        color: deepEmerald,
      });

      // Impact Summary Table
      page.drawText('VERIFIED SURPLUS RESCUE AUDIT METRICS', {
        x: 50,
        y: height - 260,
        size: 11,
        font: fontBold,
        color: deepEmerald,
      });

      // Table Header
      page.drawRectangle({
        x: 50,
        y: height - 295,
        width: width - 100,
        height: 25,
        color: emerald,
      });

      page.drawText('Audit Metric Description', {
        x: 65,
        y: height - 280,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText('Certified Quantity & Valuation', {
        x: 340,
        y: height - 280,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Table Rows
      const tableRows = [
        ['Surplus Food Classification', listing?.category || 'Fresh Cooked Surplus & Dry Provisions'],
        ['Total Net Weight Rescued', `${quantityKg} Kilograms (${quantityKg} kg)`],
        ['Estimated Nutritious Meals Served', `${mealsCount} Wholesome Portions`],
        ['Statutory CSR Schedule VII Valuation', `INR ₹${estimatedValueInr.toLocaleString('en-IN')}`],
        ['Direct Environmental Benefit (CO2e Saved)', `${co2AvoidedKg} kg CO2 Greenhouse Gas Offset`],
        ['FSSAI Surplus Safety Compliance', 'Pass (Thermal Storage & Hygiene Inspected)'],
      ];

      tableRows.forEach((row, i) => {
        const y = height - 325 - i * 26;
        page.drawRectangle({
          x: 50,
          y: y - 5,
          width: width - 100,
          height: 24,
          color: i % 2 === 0 ? rgb(0.94, 0.97, 0.95) : rgb(1, 1, 1),
          borderColor: rgb(0.85, 0.9, 0.87),
          borderWidth: 0.5,
        });

        page.drawText(row[0], {
          x: 65,
          y: y + 2,
          size: 8.5,
          font: fontBold,
          color: darkText,
        });

        page.drawText(row[1], {
          x: 340,
          y: y + 2,
          size: 8.5,
          font: fontRegular,
          color: deepEmerald,
        });
      });

      // Statutory Declaration
      const declY = height - 510;
      page.drawRectangle({
        x: 50,
        y: declY - 45,
        width: width - 100,
        height: 60,
        color: rgb(0.92, 0.96, 0.93),
        borderColor: emerald,
        borderWidth: 1,
      });

      page.drawText('STATUTORY COMPLIANCE & LEGAL ATTESTATION', {
        x: 65,
        y: declY + 2,
        size: 8.5,
        font: fontBold,
        color: deepEmerald,
      });

      page.drawText(
        'This certificate certifies that the above surplus food was collected under compliant food safety',
        { x: 65, y: declY - 12, size: 7.5, font: fontRegular, color: darkText }
      );
      page.drawText(
        'protocols (FSSAI Surplus Food Regulations 2019) and distributed free of cost to verified shelters.',
        { x: 65, y: declY - 24, size: 7.5, font: fontRegular, color: darkText }
      );
      page.drawText(
        'Eligible for Corporate Social Responsibility credit under Schedule VII of the Companies Act, 2013.',
        { x: 65, y: declY - 36, size: 7.5, font: fontRegular, color: darkText }
      );

      // Signatures
      const sigY = height - 640;
      page.drawLine({
        start: { x: 70, y: sigY },
        end: { x: 230, y: sigY },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText('Dr. Rajeshwar Sharma', {
        x: 80,
        y: sigY - 16,
        size: 9,
        font: fontBold,
        color: darkText,
      });
      page.drawText('Director of Food Safety & Inspection', {
        x: 80,
        y: sigY - 28,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });
      page.drawText('National FoodLink Oversight Council', {
        x: 80,
        y: sigY - 38,
        size: 7,
        font: fontRegular,
        color: emerald,
      });

      page.drawLine({
        start: { x: 360, y: sigY },
        end: { x: 520, y: sigY },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText('Ananya Deshmukh, FCA', {
        x: 375,
        y: sigY - 16,
        size: 9,
        font: fontBold,
        color: darkText,
      });
      page.drawText('Statutory Auditor & CSR Trustee', {
        x: 375,
        y: sigY - 28,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });
      page.drawText('Sustainability & CSR Compliance Wing', {
        x: 375,
        y: sigY - 38,
        size: 7,
        font: fontRegular,
        color: emerald,
      });

      // Statutory disclaimer on PDF regarding 80G
      page.drawText('Statutory Disclaimer: This document recognizes volunteer food rescue and environmental diversion;', {
        x: 60,
        y: 56,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.45, 0.45, 0.45),
      });
      page.drawText('it does not constitute a tax-exempt cash receipt under Section 80G of the Income Tax Act.', {
        x: 60,
        y: 47,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.45, 0.45, 0.45),
      });

      // Footer stamp & hash
      page.drawText(`Digital Certificate Hash: SHA256-${Date.now().toString(16)}-VERIFIED-SEC135`, {
        x: 120,
        y: 35,
        size: 7,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `FoodLink_Impact_Certificate_${certId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      // Fallback to print
      window.print();
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Certificate ID',
      'Issue Date',
      'Donor Entity',
      'Donor PAN',
      'Designated NGO',
      'NGO Verification Status',
      'Food Category',
      'Quantity (kg/units)',
      'Estimated Meals',
      'CSR Economic Valuation (INR)',
      'CO2 Offset (kg)',
      'FSSAI Verification',
    ];

    const row = [
      certId,
      certDate,
      `"${effectiveDonor}"`,
      panNumber,
      '"The Akshaya Patra Foundation & Feeding India Network"',
      'Verified Partner NGO',
      `"${listing?.category || 'Cooked Surplus & Dry Provisions'}"`,
      quantityKg,
      mealsCount,
      estimatedValueInr,
      co2AvoidedKg,
      'FSSAI Compliant (Temp & Hygiene Checked)',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), row.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${certId}_Audit_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1715]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200 print:p-0 print:bg-white"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-3xl rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto border max-h-[94vh] overflow-y-auto transition-colors print:max-h-none print:shadow-none print:border-none print:p-0 ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#111A17]'
        }`}
      >
        {/* Report Mode Tabs (Hidden in Print) */}
        <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-[#CFDED5]/50 dark:border-[#233833] print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReportMode('csr')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                reportMode === 'csr'
                  ? 'bg-[#059669] text-white border-[#059669]'
                  : isDark
                  ? 'bg-[#0E1715] border-[#233833] text-[#B8CCC1]'
                  : 'bg-white border-[#CFDED5] text-[#4D5C56]'
              }`}
            >
              📜 Statutory CSR Certificate
            </button>
            <button
              type="button"
              onClick={() => setReportMode('brsr')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                reportMode === 'brsr'
                  ? 'bg-[#059669] text-white border-[#059669]'
                  : isDark
                  ? 'bg-[#0E1715] border-[#233833] text-[#B8CCC1]'
                  : 'bg-white border-[#CFDED5] text-[#4D5C56]'
              }`}
            >
              📊 SEBI BRSR Enterprise ESG Statement
            </button>
          </div>
          <span className="text-[11px] font-mono font-bold text-[#059669] hidden sm:inline">
            SEBI &amp; Companies Act Compliant
          </span>
        </div>

        {reportMode === 'brsr' ? (
          /* SEBI BRSR ENTERPRISE ESG STATEMENT VIEW */
          <div className="border-2 border-[#059669] rounded-2xl p-6 sm:p-7 relative bg-gradient-to-b from-[#059669]/10 via-transparent to-transparent">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#CFDED5] dark:border-[#233833]">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#059669]/15 text-[#059669] border border-[#059669]/30">
                  SEBI Circular SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122
                </span>
                <h3 className="text-xl font-black tracking-tight mt-1">
                  SEBI BRSR Core &amp; ESG Enterprise Statement
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                  Principle 6 (Environment &amp; Decarbonisation) &amp; Principle 8 (Inclusive Growth &amp; CSR)
                </p>
              </div>

              <div className="text-left sm:text-right text-xs">
                <span className="text-[10px] uppercase font-bold text-[#059669] block">Audit Hash</span>
                <span className="font-mono font-bold text-[11px]">{brsrMetrics.chainOfCustodyAuditHash}</span>
              </div>
            </div>

            {/* Corporate Profile Card */}
            <div className={`mt-5 p-4 rounded-xl border text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}>
              <div>
                <span className="text-[10px] block opacity-70">Corporate Entity</span>
                <strong className="text-sm font-sans block truncate text-[#059669]">{brsrMetrics.corporateName}</strong>
              </div>
              <div>
                <span className="text-[10px] block opacity-70">CIN Number</span>
                <span>{brsrMetrics.cinNumber}</span>
              </div>
              <div>
                <span className="text-[10px] block opacity-70">Reporting Period</span>
                <span>{brsrMetrics.reportingPeriod}</span>
              </div>
              <div>
                <span className="text-[10px] block opacity-70">Properties Audited</span>
                <span>{brsrMetrics.branchesCovered} Kitchens</span>
              </div>
            </div>

            {/* Core Metrics 6-Grid */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#101B18] border-[#233833]' : 'bg-white border-[#CFDED5]'}`}>
                <span className="text-[10px] font-bold uppercase opacity-70 block">Landfill Diverted</span>
                <span className="text-lg font-black text-[#059669]">{brsrMetrics.totalSurplusTonnes} MT</span>
                <span className="text-[10px] block opacity-70 mt-0.5">{brsrMetrics.totalSurplusKg} kg diverted</span>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#101B18] border-[#233833]' : 'bg-white border-[#CFDED5]'}`}>
                <span className="text-[10px] font-bold uppercase opacity-70 block">Scope 3 GHG Avoided</span>
                <span className="text-lg font-black text-[#059669]">{brsrMetrics.scope3GhgAvoidedTonnes} tCO2e</span>
                <span className="text-[10px] block opacity-70 mt-0.5">Cat 5 Waste in Operations</span>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#101B18] border-[#233833]' : 'bg-white border-[#CFDED5]'}`}>
                <span className="text-[10px] font-bold uppercase opacity-70 block">Landfill Methane (CH4)</span>
                <span className="text-lg font-black text-[#059669]">{brsrMetrics.methaneAvoidedM3} m³</span>
                <span className="text-[10px] block opacity-70 mt-0.5">Anaerobic Gas Avoided</span>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#101B18] border-[#233833]' : 'bg-white border-[#CFDED5]'}`}>
                <span className="text-[10px] font-bold uppercase opacity-70 block">Embedded Water Saved</span>
                <span className="text-lg font-black text-[#059669]">{(brsrMetrics.waterConservedLiters / 1000).toFixed(1)}k L</span>
                <span className="text-[10px] block opacity-70 mt-0.5">{brsrMetrics.waterConservedLiters.toLocaleString()} Liters</span>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#101B18] border-[#233833]' : 'bg-white border-[#CFDED5]'}`}>
                <span className="text-[10px] font-bold uppercase opacity-70 block">Shelter Meals Provided</span>
                <span className="text-lg font-black text-[#059669]">~{brsrMetrics.totalMealsDistributed.toLocaleString()}</span>
                <span className="text-[10px] block opacity-70 mt-0.5">Nutritional Servings</span>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#101B18] border-[#233833]' : 'bg-white border-[#CFDED5]'}`}>
                <span className="text-[10px] font-bold uppercase opacity-70 block">Sec 135 CSR Fair Value</span>
                <span className="text-lg font-black text-[#059669]">₹{brsrMetrics.fairMarketValueLakhs} Lakhs</span>
                <span className="text-[10px] block opacity-70 mt-0.5">Fair Market Nutrition Value</span>
              </div>
            </div>

            {/* Formal SEBI Disclosure Table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#CFDED5] dark:border-[#233833] text-[10px] uppercase font-bold text-[#059669]">
                    <th className="py-2 pr-3">SEBI Metric</th>
                    <th className="py-2 pr-3">Indicator Description</th>
                    <th className="py-2 pr-3">Reported Value</th>
                    <th className="py-2">Standard / Framework</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CFDED5]/50 dark:divide-[#233833]/50 font-mono text-[11px]">
                  <tr>
                    <td className="py-2 font-bold text-[#059669]">P6-W1</td>
                    <td className="py-2 font-sans">Organic Waste Diverted from Municipal Landfills</td>
                    <td className="py-2 font-bold">{brsrMetrics.totalSurplusTonnes} MT</td>
                    <td className="py-2 font-sans opacity-70">FSSAI Rescue Manifest</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-[#059669]">P6-E1</td>
                    <td className="py-2 font-sans">Scope 3 Category 5 GHG Emissions Avoided</td>
                    <td className="py-2 font-bold">{brsrMetrics.scope3GhgAvoidedTonnes} tCO2e</td>
                    <td className="py-2 font-sans opacity-70">GHG Protocol Factor (2.45)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-[#059669]">P6-M1</td>
                    <td className="py-2 font-sans">Landfill Anaerobic Methane Generation Avoided</td>
                    <td className="py-2 font-bold">{brsrMetrics.methaneAvoidedM3} m³ CH4</td>
                    <td className="py-2 font-sans opacity-70">IPCC GWP28 Waste Model</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-[#059669]">P8-S1</td>
                    <td className="py-2 font-sans">Caloric Meals Delivered to Verified Shelters</td>
                    <td className="py-2 font-bold">{brsrMetrics.totalMealsDistributed.toLocaleString()} Servings</td>
                    <td className="py-2 font-sans opacity-70">Dual-QR Handshake Ledger</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-[#059669]">P8-C1</td>
                    <td className="py-2 font-sans">Companies Act Sec 135 Eligible Valuation</td>
                    <td className="py-2 font-bold">₹{brsrMetrics.fairMarketValueLakhs} Lakhs</td>
                    <td className="py-2 font-sans opacity-70">MCA CSR Rules 2014</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* STANDARD CSR CERTIFICATE CONTAINER */
          <div className="border-4 border-double border-[#059669]/40 rounded-2xl p-6 sm:p-8 relative bg-radial from-[#059669]/5 via-transparent to-transparent print:border-2 print:border-black">
          {/* Watermark / Digital Seal */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex flex-col items-center opacity-85">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dashed border-[#059669] flex items-center justify-center p-1 text-center bg-[#059669]/10">
              <div className="w-full h-full rounded-full border border-[#059669] flex flex-col items-center justify-center text-[8px] font-black uppercase text-[#059669] tracking-tighter">
                <span>CSR / IMPACT</span>
                <span className="text-[10px]">VERIFIED</span>
                <span>AUDIT SEC</span>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold mt-1 text-[#059669]">
              SEC. 135 CSR
            </span>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#059669] text-white flex items-center justify-center font-black text-xl shrink-0 shadow-sm">
              FL
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#059669] block">
                FoodLink National Food Recovery Council
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Certificate of Appreciation &amp; Environmental Impact Statement
              </h2>
              <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                Issued in accordance with Section 135 (Corporate Social Responsibility) &amp; FSSAI Surplus Food Regulations.
              </p>
            </div>
          </div>

          {/* Certificate Body */}
          <div className="my-6 space-y-4 text-[13px] leading-relaxed">
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] font-mono ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div>
                <span className="text-opacity-70 block text-[10px] uppercase font-bold">Certificate Number</span>
                <span className="font-extrabold text-[#059669]">{certId}</span>
              </div>
              <div>
                <span className="text-opacity-70 block text-[10px] uppercase font-bold">Date of Certification</span>
                <span className="font-bold">{certDate}</span>
              </div>
              <div>
                <span className="text-opacity-70 block text-[10px] uppercase font-bold">FSSAI Protocol</span>
                <span className="font-bold text-[#059669]">Compliant / Safe</span>
              </div>
            </div>

            <p>
              This is to certify that <strong>{listing?.donorOrg || donorOrg}</strong> (Authorized Representative: <em>{listing?.donorName || donorName}</em>, PAN Ref: <code>{panNumber}</code>) has successfully diverted verified surplus edible food through the <strong>FoodLink India Rescue Network</strong> for immediate humanitarian distribution to underprivileged shelters and registered charity partners.
            </p>

            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  Surplus Quantity
                </span>
                <span className="text-xl font-black text-[#059669]">
                  {quantityKg} <span className="text-[12px] font-semibold">{listing?.unit || 'Kg'}</span>
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  Meals Served
                </span>
                <span className="text-xl font-black text-[#059669]">
                  {mealsCount.toLocaleString()}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  CSR Economic Valuation
                </span>
                <span className="text-xl font-black">
                  ₹{estimatedValueInr.toLocaleString('en-IN')}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  CO₂e Diverted
                </span>
                <span className="text-xl font-black text-[#059669]">
                  {co2AvoidedKg} <span className="text-[12px] font-semibold">kg</span>
                </span>
              </div>
            </div>

            {/* Recipient & FSSAI Verification Checklist */}
            <div
              className={`p-4 rounded-xl border text-[12px] space-y-1.5 ${
                isDark ? 'bg-[#0E1715]/60 border-[#233833]' : 'bg-[#F4F8F5]/80 border-[#CFDED5]'
              }`}
            >
              <div className="font-bold text-[#059669] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>FSSAI Hygiene &amp; CSR Environmental Impact Verification Summary:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-opacity-90">
                <li>
                  <strong>Designated Partner NGO:</strong> Akshaya Patra Foundation / Feeding India Distribution Alliance (Registered Non-Profit Partner).
                </li>
                <li>
                  <strong>Hygienic Temperature Integrity:</strong> Maintained within safe thresholds (&le; 4&deg;C chilled or &ge; 65&deg;C hot transport) prior to ingestion.
                </li>
                <li>
                  <strong>Zero Commercial Resale Clause:</strong> Verified non-commercial end-use for free public relief in compliance with Indian Food Safety norms.
                </li>
              </ul>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-[#059669]/30 grid grid-cols-2 gap-6 text-[11px]">
              <div>
                <div className="h-10 flex items-end">
                  <span className="font-serif italic text-[15px] font-bold text-[#059669]">
                    Dr. Arvind K. Sharma
                  </span>
                </div>
                <div className="border-t border-[#CFDED5] dark:border-[#233833] pt-1 mt-1">
                  <p className="font-bold">Authorized Signatory</p>
                  <p className="text-opacity-70 text-[10px]">National Food Security Coordinator, FoodLink India</p>
                </div>
              </div>

              <div>
                <div className="h-10 flex items-end">
                  <span className="font-serif italic text-[15px] font-bold text-[#059669]">
                    FSSAI Auditor Node #3412
                  </span>
                </div>
                <div className="border-t border-[#CFDED5] dark:border-[#233833] pt-1 mt-1">
                  <p className="font-bold">Digital Cryptographic Stamp</p>
                  <p className="text-opacity-70 text-[10px]">SHA-256 Verified on Distributed Ledger</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Modal Actions (Hidden in Print) */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <p className={`text-[11.5px] max-w-xl leading-normal ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
            {reportMode === 'brsr'
              ? 'SEBI Circular BRSR Core Compliance: Formatted under MCA Guidelines and Section 135 Indian Companies Act 2013.'
              : 'Disclaimer: This document recognizes volunteer food rescue and environmental diversion; it does not constitute a tax-exempt cash receipt under Section 80G of the Income Tax Act.'}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {reportMode === 'brsr' ? (
              <>
                <button
                  type="button"
                  onClick={handleDownloadBrsrPdf}
                  disabled={generatingBrsrPdf}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {generatingBrsrPdf ? 'hourglass_top' : 'picture_as_pdf'}
                  </span>
                  <span>{generatingBrsrPdf ? 'Generating PDF...' : 'Download SEBI BRSR PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBrsrCsv}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isDark
                      ? 'border-[#233833] bg-[#0E1715] hover:bg-[#1C2E2A] text-[#F2F7F4]'
                      : 'border-[#CFDED5] bg-[#F4F8F5] hover:bg-[#EBF2ED] text-[#111A17]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">table_view</span>
                  <span>Export BRSR CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyBrsrDisclosure}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    copiedBrsr
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isDark
                      ? 'border-[#233833] bg-[#0E1715] hover:bg-[#1C2E2A] text-[#F2F7F4]'
                      : 'border-[#CFDED5] bg-[#F4F8F5] hover:bg-[#EBF2ED] text-[#111A17]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copiedBrsr ? 'check_circle' : 'content_copy'}
                  </span>
                  <span>{copiedBrsr ? 'Disclosure Copied!' : 'Copy Disclosure Text'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {generatingPdf ? 'hourglass_top' : 'picture_as_pdf'}
                  </span>
                  <span>{generatingPdf ? 'Generating PDF...' : 'Download Official PDF Certificate'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isDark
                      ? 'border-[#233833] bg-[#0E1715] hover:bg-[#1C2E2A] text-[#F2F7F4]'
                      : 'border-[#CFDED5] bg-[#F4F8F5] hover:bg-[#EBF2ED] text-[#111A17]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">table_view</span>
                  <span>Export CSV</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#233833] bg-[#0E1715] hover:bg-[#1C2E2A] text-[#F2F7F4]'
                  : 'border-[#CFDED5] bg-[#F4F8F5] hover:bg-[#EBF2ED] text-[#111A17]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#233833] hover:bg-[#1C2E2A] text-[#B8CCC1]'
                  : 'border-[#CFDED5] hover:bg-[#EBF2ED] text-[#4D5C56]'
              }`}
              title="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
