import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function createProjectDocumentationPdf() {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595.28; // A4 size
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  const primaryColor = rgb(0.85, 0.47, 0.02); // #D97706
  const secondaryColor = rgb(0.06, 0.43, 0.34); // #0F6E56
  const darkColor = rgb(0.05, 0.09, 0.08); // #0E1715
  const bodyColor = rgb(0.2, 0.25, 0.23);
  const mutedColor = rgb(0.48, 0.58, 0.53);
  const lineColor = rgb(0.81, 0.87, 0.84);

  function checkPageBreak(requiredHeight: number) {
    if (currentY - requiredHeight < margin + 30) {
      // Add page number at bottom of current page
      drawFooter();
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
    }
  }

  function drawFooter() {
    currentPage.drawText('FoodLink India - Comprehensive Technical Architecture & Project Dossier', {
      x: margin,
      y: margin - 15,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    });
    const pageCountStr = `Page ${pdfDoc.getPageCount()}`;
    const w = fontRegular.widthOfTextAtSize(pageCountStr, 8);
    currentPage.drawText(pageCountStr, {
      x: pageWidth - margin - w,
      y: margin - 15,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    });
  }

  function addHeader(title: string, subtitle?: string) {
    checkPageBreak(50);
    currentPage.drawText(title, {
      x: margin,
      y: currentY,
      size: 16,
      font: fontBold,
      color: primaryColor,
    });
    currentY -= 20;

    if (subtitle) {
      currentPage.drawText(subtitle, {
        x: margin,
        y: currentY,
        size: 9.5,
        font: fontItalic,
        color: mutedColor,
      });
      currentY -= 15;
    }

    currentPage.drawLine({
      start: { x: margin, y: currentY },
      end: { x: pageWidth - margin, y: currentY },
      thickness: 1,
      color: lineColor,
    });
    currentY -= 15;
  }

  function addSubheader(title: string) {
    checkPageBreak(30);
    currentPage.drawText(title, {
      x: margin,
      y: currentY,
      size: 12,
      font: fontBold,
      color: secondaryColor,
    });
    currentY -= 16;
  }

  function addParagraph(text: string, boldPrefix?: string) {
    checkPageBreak(30);
    const fontSize = 9.5;
    const lineHeight = 14;

    // Word wrap logic
    const fullText = (boldPrefix ? boldPrefix + ' ' : '') + text;
    const words = fullText.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const testWidth = fontRegular.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > contentWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineHeight);
      const line = lines[i];

      if (i === 0 && boldPrefix) {
        const prefixWidth = fontBold.widthOfTextAtSize(boldPrefix, fontSize);
        currentPage.drawText(boldPrefix, {
          x: margin,
          y: currentY,
          size: fontSize,
          font: fontBold,
          color: darkColor,
        });

        const remainder = line.substring(boldPrefix.length).trim();
        if (remainder) {
          currentPage.drawText(remainder, {
            x: margin + prefixWidth + 4,
            y: currentY,
            size: fontSize,
            font: fontRegular,
            color: bodyColor,
          });
        }
      } else {
        currentPage.drawText(line, {
          x: margin,
          y: currentY,
          size: fontSize,
          font: fontRegular,
          color: bodyColor,
        });
      }
      currentY -= lineHeight;
    }
    currentY -= 4; // Paragraph gap
  }

  function addBullet(bulletText: string, boldLead?: string) {
    checkPageBreak(25);
    const fontSize = 9;
    const lineHeight = 13.5;
    const bulletIndent = 14;
    const textWidth = contentWidth - bulletIndent;

    const fullText = (boldLead ? boldLead + ' ' : '') + bulletText;
    const words = fullText.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const testWidth = fontRegular.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > textWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Draw bullet symbol
    currentPage.drawText('•', {
      x: margin + 3,
      y: currentY,
      size: fontSize + 1,
      font: fontBold,
      color: primaryColor,
    });

    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineHeight);
      const line = lines[i];
      if (i === 0 && boldLead) {
        const prefixWidth = fontBold.widthOfTextAtSize(boldLead, fontSize);
        currentPage.drawText(boldLead, {
          x: margin + bulletIndent,
          y: currentY,
          size: fontSize,
          font: fontBold,
          color: darkColor,
        });
        const remainder = line.substring(boldLead.length).trim();
        if (remainder) {
          currentPage.drawText(remainder, {
            x: margin + bulletIndent + prefixWidth + 4,
            y: currentY,
            size: fontSize,
            font: fontRegular,
            color: bodyColor,
          });
        }
      } else {
        currentPage.drawText(line, {
          x: margin + bulletIndent,
          y: currentY,
          size: fontSize,
          font: fontRegular,
          color: bodyColor,
        });
      }
      currentY -= lineHeight;
    }
    currentY -= 3;
  }

  // ==================== COVER / TITLE BLOCK ====================
  currentPage.drawRectangle({
    x: margin,
    y: currentY - 60,
    width: contentWidth,
    height: 70,
    color: rgb(0.97, 0.95, 0.91),
    borderColor: primaryColor,
    borderWidth: 1.5,
  });

  currentPage.drawText('FoodLink India - Technical Architecture Dossier', {
    x: margin + 16,
    y: currentY - 26,
    size: 16,
    font: fontBold,
    color: darkColor,
  });

  currentPage.drawText('Comprehensive Project Specification, System Design & Chronological Change Log', {
    x: margin + 16,
    y: currentY - 44,
    size: 10,
    font: fontRegular,
    color: primaryColor,
  });

  currentY -= 85;

  // Metadata block
  addParagraph('System Version: 2.4.0 (Production Release) | Runtime: React 18 SPA + Vite + Firebase Cloud');
  addParagraph('Target Region: Pan-India (Mumbai, Bengaluru, Delhi NCR, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad)');
  addParagraph('Audience: Software Engineers, Architects, and LLM Coding Agents requiring full contextual grounding.');

  // ==================== SECTION 1: EXECUTIVE SUMMARY ====================
  addHeader('1. Executive Summary & Problem Space', 'Transforming commercial surplus food into safe, auditable community relief.');
  addParagraph(
    'FoodLink India is an enterprise-grade food rescue and direct logistics platform engineered to solve the acute paradox of urban food wastage in India. Commercial kitchens, banquet halls, corporate cafeterias, and wedding caterers routinely discard hundreds of kilograms of freshly cooked, high-nutrition food while local community shelters, orphanages, and night shelters face chronic food insecurity.'
  );
  addParagraph(
    'The platform bridges this gap in real time through an ultra-low latency dispatch pipeline governed by FSSAI food safety guardrails, automated temperature monitoring, Gemini AI photo freshness analysis, and cryptographically verified OTP handshakes between donor, volunteer courier, and recipient shelters.'
  );

  // ==================== SECTION 2: ARCHITECTURE & TECH STACK ====================
  addHeader('2. Technical Architecture & Component Hierarchy', 'End-to-end modern stack designed for speed, resilience, and offline-readiness.');
  addBullet('Frontend Framework:', 'React 18 SPA built with TypeScript & Vite, utilizing functional components and custom reactive hooks.');
  addBullet('Styling Architecture:', 'Tailwind CSS v4 with custom responsive design tokens, zero external layout frameworks, and full CSS variables integration.');
  addBullet('Database & Auth:', 'Firebase Firestore for real-time document synchronization and Firebase Authentication with email/password and demo guest credentials.');
  addBullet('Artificial Intelligence:', 'Google Gemini API (@google/genai SDK, gemini-2.5-flash) multimodal vision inspection evaluating food packaging and hygiene.');
  addBullet('Geofencing & Distance Engine:', 'Custom mathematical Haversine formula implementation computing precise spherical distances between donors and shelters.');
  addBullet('Security & Privacy Rail:', 'Zero-exposure privacy shield ensuring personal phone numbers and precise street coordinates are never indexed publicly.');

  // ==================== SECTION 3: KEY ROLES & ACCESS CONTROL ====================
  addHeader('3. Role-Based Access Control (RBAC)', 'Four distinct operational personas with contextual permissions.');
  addBullet('Food Donor (Kitchens/Events):', 'Creates surplus listings with food classifications, weights, mandatory FSSAI numbers, and pickup cutoff times. Accesses 80G tax receipt generation.');
  addBullet('Recipient Shelter / NGO:', 'Browses map and card feeds centered on their metro geofence. Reserves batches, generates 6-digit verification handoff OTPs, and confirms intake temperature.');
  addBullet('Volunteer Courier (Runner):', 'Enables volunteer courier mode to claim transport runs, simulate turn-by-turn routing, log insulated transit containers, and verify handshakes.');
  addBullet('Public & Auditors:', 'Accesses the immutable Community Audit Ledger, verified transaction reports, and public rescuer leaderboard with CSV export capabilities.');

  // ==================== SECTION 4: DEEP DIVE INTO APPLICATION MODULES ====================
  addHeader('4. Core Application Modules & Codebase Breakdown', 'Detailed examination of individual module responsibilities.');

  addSubheader('4.1 Donor Portal (src/DonorDashboard.tsx)');
  addParagraph(
    'Provides food donors with a 4-step wizard to post surplus inventory. Donors select dietary tags (Pure Veg, Non-Veg, Bakery, Raw Produce), declare packaging status, set pickup deadlines, and attach photos. Gemini AI scans the uploaded image in under 2 seconds to issue a verdict ("Looks safe" or "Flagged for review") based on hygiene and packaging criteria.'
  );

  addSubheader('4.2 Recipient Portal & Surplus Radar (src/RecipientDashboard.tsx)');
  addParagraph(
    'A high-density live feed offering dual view options (responsive cards and interactive GPS radar map). Shelters filter by proximity (<5km, <10km), dietary classification, and urgency. Clicking "Claim Batch" allocates the listing exclusively to the shelter, locking it against duplicate claims and spawning a unique 6-digit OTP.'
  );

  addSubheader('4.3 Volunteer Logistics Mode (src/VolunteerLogistics.tsx)');
  addParagraph(
    'Empowers independent volunteers and delivery riders to bridge the physical transportation gap. Features real-time routing milestones (Assigned -> En Route to Donor -> Pickup Verified -> Delivered to Shelter) with vehicle capacity matching (Bicycle, Two-Wheeler, Auto, Van).'
  );

  addSubheader('4.4 Public Transparency Ledger & Leaderboard (src/RescueLedgerLeaderboard.tsx)');
  addParagraph(
    'A real-time public recognition and audit center. Consists of: (1) The Top Food Rescuers & Donors Leaderboard ranking contributors by kilograms and portions rescued; (2) The Latest Food Rescue Transactions & Dispatch Report offering an immutable record of every rescue operation with instant search, status filtering, and CSV audit downloads.'
  );

  addSubheader('4.5 Regulatory & Compliance Engine (src/CsrReportModal.tsx & src/VerificationModule.tsx)');
  addParagraph(
    'Under Section 80G of the Indian Income Tax Act and Section 135 of the Companies Act 2013, Indian corporations must account for charitable donations and ESG impact. This module computes carbon emissions diverted (2.45 kg CO2e saved per kg of food rescued) and generates printable tax compliance statements.'
  );

  addSubheader('4.6 Theming & Accessibility Layer (src/ThemeContext.tsx & src/ThemePaletteModal.tsx)');
  addParagraph(
    'Built with accessibility-first standards. Features a top root font scaler (A- / A+) dynamically adjusting typography scale without breaking layouts, plus a multi-palette engine (Current Forest, Ocean Teal, Navy Marigold, Crimson Terracotta) and smooth dark/light mode toggles.'
  );

  // ==================== SECTION 5: COMPLETE CHRONOLOGICAL CHANGE LOG ====================
  addHeader('5. Chronological Development & Iteration History', 'Step-by-step account of prompts, refinements, and bug fixes.');

  addBullet('Prompt 1 (Initial Build):', 'Established base platform, Firebase Firestore integration, authentication, donor posting, recipient claims, and volunteer courier modes.');
  addBullet('Prompt 2 (Safety & Inspection):', 'Integrated Gemini Multimodal Vision API to inspect food photos and verify safe holding temperatures (>60°C). Added 80G CSR statement modals.');
  addBullet('Prompt 3 (Fabrication Scrub):', 'User identified fabricated names (Leela Palace, Shanti Shelter, Grand Pavilion) in a mock ticker. Every instance was completely purged from the codebase and replaced with 100% real Firestore-driven state and authentic empty states.');
  addBullet('Prompt 4 (Desktop Header Simplification):', 'Resolved severe horizontal crowding on desktop viewports by moving secondary controls (Region selector, 80G button, color scheme modal) into a clean utilities row in the footer.');
  addBullet('Prompt 5 (Leaderboard & Transaction Ledger):', 'User requested a dedicated Leaderboard and Latest Transaction Report named by function. Implemented RescueLedgerLeaderboard.tsx with live aggregations, search, status filtering, CSV export, and prominent theme switcher.');
  addBullet('Prompt 6 (Mobile Top Header Layout):', 'User provided a screenshot showing "Get Started" clipping off-screen on mobile devices. Removed the redundant top theme toggle on mobile screens and adjusted container padding, creating a flawless 320px+ mobile header.');
  addBullet('Prompt 7 (Mobile Bottom Navigation Polish):', 'User requested moving the dark/light toggle away from next to the Verify button and replacing it with the Leaderboard/Ledger. Substituted the toggle with a direct "Ledger" shortcut button that smoothly scrolls to the Transparency Hub.');

  // ==================== SECTION 6: FIRESTORE SCHEMA REFERENCE ====================
  addHeader('6. Firestore Database Schema Reference', 'Exact document structure for external systems and models.');
  addParagraph('Collection: listings/{listingId}', 'Document Definition:');
  addBullet('id (string):', 'Unique document identifier.');
  addBullet('donorId & donorOrg (string):', 'Creator UID and registered commercial enterprise name.');
  addBullet('title & category (string):', 'Descriptive batch name and dietary class (Pure Veg, Non-Veg, etc.).');
  addBullet('quantity & unit (number, string):', 'Numerical volume and unit (kg, portions, boxes).');
  addBullet('location (string):', 'City or macro-neighborhood (e.g., "Andheri East, Mumbai").');
  addBullet('status (enum):', "'available' | 'claimed' | 'completed' | 'cancelled' | 'expired' | 'rejected'");
  addBullet('claimedBy & claimedByName (string):', 'UID and title of the recipient shelter organization.');
  addBullet('volunteerCourierId (string):', 'UID of the registered courier handling logistics.');
  addBullet('safetyVerdict (string):', "'Looks safe' | 'Flagged for review' generated by Gemini AI.");
  addBullet('safeUntilMillis (number):', 'Unix epoch timestamp determining auto-expiry cutoff.');
  addBullet('fssaiNumber (string):', '14-digit Food Safety and Standards Authority of India license code.');

  // Final footer on last page
  drawFooter();

  const pdfBytes = await pdfDoc.save();
  const outputDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'FoodLink_India_Project_Documentation.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log('PDF successfully generated at:', outputPath);
}

createProjectDocumentationPdf().catch(console.error);
