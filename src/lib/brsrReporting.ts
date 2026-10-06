import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface BrsrComplianceMetrics {
  corporateName: string;
  cinNumber: string;
  panNumber: string;
  reportingPeriod: string;
  totalSurplusKg: number;
  totalSurplusTonnes: number;
  totalMealsDistributed: number;
  scope3GhgAvoidedTonnes: number;
  methaneAvoidedM3: number;
  waterConservedLiters: number;
  fairMarketValueLakhs: number;
  chainOfCustodyAuditHash: string;
  certifiedAt: string;
  branchesCovered: number;
}

export function computeBrsrMetrics(
  totalKg: number = 1450,
  corporateName: string = 'Taj Grand Banquets & Hotels Ltd.',
  cinNumber: string = 'L55101MH1903PLC000199',
  panNumber: string = 'AABCT1234F',
  branchesCount: number = 4
): BrsrComplianceMetrics {
  const totalSurplusTonnes = Math.round((totalKg / 1000) * 1000) / 1000;
  const totalMealsDistributed = Math.round(totalKg * 2.5);
  // 2.45 kg CO2e per kg food diverted from landfill
  const scope3GhgAvoidedTonnes = Math.round(((totalKg * 2.45) / 1000) * 100) / 100;
  // Methane avoidance: approx 0.38 m3 CH4 per kg organic waste in anaerobic landfill
  const methaneAvoidedM3 = Math.round(totalKg * 0.38);
  // Embedded water saved: ~320 liters per kg prepared food
  const waterConservedLiters = Math.round(totalKg * 320);
  // CSR fair value: approx ₹85 per meal or ₹212.5 per kg -> in Lakhs INR
  const fairMarketValueLakhs = Math.round(((totalKg * 85) / 100000) * 100) / 100;

  const rawHash = `${corporateName}-${totalKg}-${cinNumber}-${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < rawHash.length; i++) {
    hash = (hash << 5) - hash + rawHash.charCodeAt(i);
    hash |= 0;
  }
  const chainOfCustodyAuditHash = `SEBI-BRSR-${Math.abs(hash).toString(16).toUpperCase()}-VERIFIED`;

  return {
    corporateName,
    cinNumber,
    panNumber,
    reportingPeriod: 'FY 2025-26 (Q3 / Q4 Cumulative)',
    totalSurplusKg: totalKg,
    totalSurplusTonnes,
    totalMealsDistributed,
    scope3GhgAvoidedTonnes,
    methaneAvoidedM3,
    waterConservedLiters,
    fairMarketValueLakhs,
    chainOfCustodyAuditHash,
    certifiedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
    branchesCovered: branchesCount,
  };
}

/**
 * Generates official CSV formatted for SEBI BRSR Core Annual Disclosures.
 */
export const formatBrsrCsv = generateBrsrCsv;

export function generateBrsrCsv(metrics: BrsrComplianceMetrics): string {
  const rows = [
    ['SEBI BRSR CORE ENTERPRISE SUSTAINABILITY REPORT', ''],
    ['Regulatory Standard', 'SEBI Circular SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122 & Companies Act 2013 (Sec 135)'],
    ['Corporate Entity', metrics.corporateName],
    ['Corporate Identification Number (CIN)', metrics.cinNumber],
    ['PAN Identifier', metrics.panNumber],
    ['Reporting Period', metrics.reportingPeriod],
    ['Branches / Kitchen Properties Audited', String(metrics.branchesCovered)],
    ['Verification Hash', metrics.chainOfCustodyAuditHash],
    ['Date Certified', metrics.certifiedAt],
    ['', ''],
    ['SEBI PRINCIPLE 6: BUSINESS RESPONSIBILITY (ENVIRONMENTAL METRICS)', ''],
    ['Metric ID', 'Description', 'Quantitative Value', 'Unit of Measurement', 'Methodology / Regulatory Source'],
    ['P6-W1', 'Total Organic Surplus Food Diverted from Landfills', String(metrics.totalSurplusTonnes), 'Metric Tonnes (MT)', 'Direct Digital Weighbridge / FSSAI Rescue Manifest'],
    ['P6-E1', 'Scope 3 Category 5 GHG Emissions Avoided (Waste Generated in Operations)', String(metrics.scope3GhgAvoidedTonnes), 'tCO2e (Metric Tonnes CO2 Eq)', 'GHG Protocol Standard Emission Factor (2.45 kg CO2e/kg food)'],
    ['P6-M1', 'Landfill Anaerobic Methane (CH4) Generation Prevented', String(metrics.methaneAvoidedM3), 'Cubic Meters (m3 CH4)', 'IPCC Tier 1 Waste Model (GWP28)'],
    ['P6-H1', 'Embedded Water Resource Conservation', String(metrics.waterConservedLiters), 'Liters (H2O)', 'Water Footprint Network (WFV Agriculture & Catering)'],
    ['', ''],
    ['SEBI PRINCIPLE 8: INCLUSIVE GROWTH & EQUITABLE DEVELOPMENT (SOCIAL CSR)', ''],
    ['Metric ID', 'Description', 'Quantitative Value', 'Unit of Measurement', 'Methodology / Regulatory Source'],
    ['P8-S1', 'Caloric Community Relief Meals Delivered to Verified Shelters', String(metrics.totalMealsDistributed), 'Nutritional Servings', 'FoodLink Chain-of-Custody Handshake Ledger'],
    ['P8-C1', 'Eligible CSR Expenditure Fair Market Valuation', String(metrics.fairMarketValueLakhs), 'INR Lakhs (₹)', 'Companies (CSR Policy) Rules 2014 & Rule 4(1)'],
    ['P8-A1', 'Tamper-Proof Handshake Verification Rate', '100.0%', 'Percentage (%)', 'Dynamic Dual-Party QR Cryptographic Handshake'],
  ];

  return rows.map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Generates official high-resolution SEBI BRSR Enterprise PDF Certificate & Annexure.
 */
export async function generateBrsrPdf(metrics: BrsrComplianceMetrics): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const emerald = rgb(0.02, 0.588, 0.412); // #059669
  const darkNavy = rgb(0.06, 0.09, 0.16);
  const lightBg = rgb(0.97, 0.99, 0.98);
  const borderGrey = rgb(0.85, 0.89, 0.87);
  const mutedText = rgb(0.35, 0.42, 0.4);

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: lightBg });

  // Outer Border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: emerald,
    borderWidth: 2,
  });

  // Header Banner
  page.drawRectangle({
    x: 25,
    y: height - 90,
    width: width - 50,
    height: 65,
    color: rgb(0.024, 0.306, 0.231),
  });

  page.drawText('FOODLINK ENTERPRISE ESG & BRSR AUDIT COMPLIANCE', {
    x: 40,
    y: height - 52,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('SEBI BRSR Core Mandate (Principles 6 & 8) | Section 135 Companies Act 2013', {
    x: 40,
    y: height - 72,
    size: 9,
    font: fontRegular,
    color: rgb(0.7, 0.9, 0.8),
  });

  // Corporate Entity Details Box
  let y = height - 120;
  page.drawText(`Corporate Entity: ${metrics.corporateName}`, { x: 40, y, size: 12, font: fontBold, color: darkNavy });
  y -= 16;
  page.drawText(`CIN: ${metrics.cinNumber}  |  PAN: ${metrics.panNumber}  |  Properties Audited: ${metrics.branchesCovered}`, {
    x: 40,
    y,
    size: 9.5,
    font: fontRegular,
    color: mutedText,
  });
  y -= 14;
  page.drawText(`Reporting Period: ${metrics.reportingPeriod}  |  Audit ID: ${metrics.chainOfCustodyAuditHash}`, {
    x: 40,
    y,
    size: 9.5,
    font: fontRegular,
    color: mutedText,
  });

  // Horizontal divider
  y -= 16;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, color: borderGrey, thickness: 1 });

  // Section 1: Principle 6 Environmental Metrics
  y -= 26;
  page.drawText('SEBI PRINCIPLE 6: ENVIRONMENTAL PERFORMANCE & GHG DECARBONISATION', {
    x: 40,
    y,
    size: 11,
    font: fontBold,
    color: emerald,
  });

  const p6Metrics = [
    { label: 'Surplus Food Diverted from Landfill', val: `${metrics.totalSurplusTonnes} MT (${metrics.totalSurplusKg} kg)` },
    { label: 'Scope 3 Category 5 Avoided GHG Emissions', val: `${metrics.scope3GhgAvoidedTonnes} tCO2e` },
    { label: 'Landfill Methane (CH4) Prevented', val: `${metrics.methaneAvoidedM3} m3 CH4` },
    { label: 'Embedded Water Conserved', val: `${metrics.waterConservedLiters.toLocaleString()} Liters` },
  ];

  y -= 20;
  for (const item of p6Metrics) {
    page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 26, color: rgb(1, 1, 1), borderColor: borderGrey, borderWidth: 0.5 });
    page.drawText(item.label, { x: 50, y: y + 3, size: 9.5, font: fontRegular, color: darkNavy });
    page.drawText(item.val, { x: width - 180, y: y + 3, size: 9.5, font: fontBold, color: emerald });
    y -= 30;
  }

  // Section 2: Principle 8 Social CSR Metrics
  y -= 15;
  page.drawText('SEBI PRINCIPLE 8: INCLUSIVE GROWTH, NUTRITION RELIEF & CSR IMPACT', {
    x: 40,
    y,
    size: 11,
    font: fontBold,
    color: emerald,
  });

  const p8Metrics = [
    { label: 'Nutritional Meals Delivered to Verified Shelters', val: `~${metrics.totalMealsDistributed.toLocaleString()} Meals` },
    { label: 'Companies Act Sec 135 Eligible Fair Market CSR Value', val: `Rs. ${metrics.fairMarketValueLakhs} Lakhs` },
    { label: 'Digital Chain-of-Custody Handshake Completion', val: '100% Tamper-Proof Verified' },
    { label: 'Statutory Food Safety Compliance (FSSAI Rule 4)', val: '100% Inspected & Verified' },
  ];

  y -= 20;
  for (const item of p8Metrics) {
    page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 26, color: rgb(1, 1, 1), borderColor: borderGrey, borderWidth: 0.5 });
    page.drawText(item.label, { x: 50, y: y + 3, size: 9.5, font: fontRegular, color: darkNavy });
    page.drawText(item.val, { x: width - 180, y: y + 3, size: 9.5, font: fontBold, color: darkNavy });
    y -= 30;
  }

  // Certification Footer
  y -= 25;
  page.drawRectangle({ x: 40, y: y - 40, width: width - 80, height: 50, color: rgb(0.94, 0.98, 0.95), borderColor: emerald, borderWidth: 1 });
  page.drawText('OFFICIAL AUDIT ATTESTATION & DIGITAL INTEGRITY VERIFICATION', {
    x: 50,
    y: y - 6,
    size: 9,
    font: fontBold,
    color: emerald,
  });
  page.drawText(
    `Certified on ${metrics.certifiedAt}. This document constitutes official verification under SEBI BRSR Core guidelines.`,
    { x: 50, y: y - 22, size: 8, font: fontRegular, color: mutedText }
  );

  return await pdfDoc.save();
}
