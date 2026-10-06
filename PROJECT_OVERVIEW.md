# FoodLink — Project Overview & Folder Guide 🌿

> **What is FoodLink?**  
> FoodLink is a web platform that connects restaurants, caterers, and event venues
> (called **Donors**) with verified NGOs, orphanages, and shelters (called **Recipients**)
> so surplus food is rescued before it goes to waste — built for India, FSSAI-compliant.

---

## 🗂️ Folder Structure at a Glance

```
FoodLink.1.0.0-main/
│
├── 📄 index.html              ← The single HTML page that boots the whole app
├── 📄 package.json            ← Project name, version, scripts, and dependencies
├── 📄 vite.config.ts          ← Build tool configuration (Vite)
├── 📄 tsconfig.json           ← TypeScript compiler settings
├── 📄 server.ts               ← Express server (serves the built app in production)
├── 📄 firestore.rules         ← Firebase database security rules
├── 📄 .env                    ← Your secret API keys (never commit this)
├── 📄 .env.example            ← Template showing which keys are needed
├── 📄 .gitignore              ← Files Git should ignore (e.g. node_modules, .env)
│
├── 📁 src/                    ← ALL the application source code lives here
├── 📁 public/                 ← Static assets (images, PDFs)
├── 📁 scripts/                ← Utility / one-off scripts
├── 📁 dist/                   ← Built output (auto-generated, do not edit)
└── 📁 node_modules/           ← Installed packages (auto-generated, do not edit)
```

---

## 📁 `src/` — Source Code (the heart of the project)

```
src/
├── app/           ← App entry point and root routing
├── components/    ← Reusable UI pop-ups and widgets
├── features/      ← Big role-based feature modules (Donor, Recipient, etc.)
├── lib/           ← Shared utilities and Firebase setup
├── pages/         ← Full-page views (Auth, Settings, Admin, etc.)
├── styles/        ← Global CSS
└── theme/         ← Light / dark theme logic
```

---

### 📁 `src/app/` — Application Root

| File | What it does |
|------|-------------|
| `main.tsx` | The very first file React loads. Mounts the `<App>` component into the HTML page. |
| `App.tsx` | The main router. Reads the logged-in user's role and shows the correct page (Donor dashboard, Recipient dashboard, Admin panel, etc.). This is the biggest file in the project (~90 KB). |

---

### 📁 `src/components/` — Reusable Pop-ups & Widgets

These are self-contained UI pieces used across multiple pages.

| File | What it does |
|------|-------------|
| `CookieModal.tsx` | Cookie consent pop-up shown to first-time visitors. |
| `CookieNotice.tsx` | Small banner reminding users about cookie preferences. |
| `CsrReportModal.tsx` | Modal that shows a Corporate Social Responsibility (CSR) impact report. |
| `SafeCountdownBadge.tsx` | Ticking badge that shows how many hours/minutes remain before a food listing expires (safe-to-eat window). |
| `TermsPolicyModal.tsx` | Pop-up containing the full Terms of Service and Privacy Policy. |
| `ThemePaletteModal.tsx` | Pop-up that lets users pick colour themes. |

---

### 📁 `src/features/` — Role-Based Feature Modules

Each subfolder owns everything related to one user role or major feature.

#### 📁 `auth/` — Authentication
| File | What it does |
|------|-------------|
| `AuthContext.tsx` | Stores the current logged-in user in a React context so every component can access it. |
| `AuthModal.tsx` | The sign-up / log-in modal. Handles email+password, Google sign-in, and role selection. The largest modal file (~120 KB). |

#### 📁 `courier/` — Volunteer Logistics
| File | What it does |
|------|-------------|
| `VolunteerLogistics.tsx` | Dashboard for volunteer couriers: view pickup assignments, update delivery status, and navigate routes. |

#### 📁 `donor/` — Donor Dashboard
| File | What it does |
|------|-------------|
| `DonorDashboard.tsx` | The main screen for restaurants/caterers. Lets them post new food listings, manage existing ones, and view impact stats. |

#### 📁 `leaderboard/` — Impact Leaderboard
| File | What it does |
|------|-------------|
| `Leaderboard.tsx` | Public leaderboard ranking donors by total meals donated. |
| `RescueLedgerLeaderboard.tsx` | Detailed ledger view showing each rescue event, quantities, and timestamps. |

#### 📁 `recipient/` — Recipient Dashboard
| File | What it does |
|------|-------------|
| `RecipientDashboard.tsx` | The main screen for NGOs/shelters. Browse available food listings on a map, claim a listing, and track incoming deliveries. |

#### 📁 `verification/` — NGO Verification
| File | What it does |
|------|-------------|
| `VerificationModule.tsx` | UI for submitting documents (registration certificate, FSSAI number) for admin review. |

---

### 📁 `src/lib/` — Shared Utilities

| File | What it does |
|------|-------------|
| `firebase.ts` | Connects to Firebase using the keys in `.env`. All other files import from here. |
| `cities.ts` | List of Indian cities used in location dropdowns. |
| `sampleFoodImages.ts` | Curated list of stock food images shown when a donor hasn't uploaded a photo. |
| `settingsStorage.ts` | Helpers to read/write user preferences (theme, notifications) to localStorage. |

---

### 📁 `src/pages/` — Full-Page Views

| File | What it does |
|------|-------------|
| `AuthPage.tsx` | The full-screen login / signup landing page. |
| `AdminLoginPage.tsx` | Separate login page for admins (extra security layer). |
| `AdminPanel.tsx` | Internal admin dashboard: verify NGO registrations, suspend accounts, view platform-wide stats. |
| `SettingsPage.tsx` | User settings: profile info, notification preferences, theme, account management. |
| `LegalPage.tsx` | Static page showing Terms of Service and Privacy Policy. |
| `NotFoundPage.tsx` | The 404 "page not found" screen. |

---

### 📁 `src/styles/` — Global CSS

| File | What it does |
|------|-------------|
| `index.css` | Global base styles, CSS variables for the green colour palette, dark mode overrides. |

---

### 📁 `src/theme/` — Theme System

| File | What it does |
|------|-------------|
| `ThemeContext.tsx` | React context that tracks light/dark mode. Wraps the whole app so any component can toggle or read the current theme. |

---

## 📁 `public/` — Static Assets

| File | What it does |
|------|-------------|
| `hero-food-rescue.jpg` | Hero/banner image shown on the home/auth page. |
| `FoodLink_India_Project_Documentation.pdf` | Full project documentation PDF (downloadable by users). |

---

## 📁 `scripts/` — Developer Utilities

| File | What it does |
|------|-------------|
| `generate_project_pdf.ts` | One-off script that builds and exports the project documentation PDF using `pdf-lib`. |

---

## 🔑 Configuration Files

| File | What it does |
|------|-------------|
| `.env` | Your **secret** Firebase & Google Maps API keys. Never share or commit this file. |
| `.env.example` | Safe template version — shows what keys are needed without revealing real values. |
| `firebase-applet-config.json` | Firebase hosting/applet configuration. |
| `firebase-blueprint.json` | Firebase project structure and rules blueprint. |
| `firestore.rules` | Security rules for the Firestore database — who can read/write what. |
| `vite.config.ts` | Build tool settings: port (3000), Tailwind plugin, React plugin. |
| `tsconfig.json` | TypeScript compiler settings (strict mode, module resolution). |
| `metadata.json` | Project metadata (created by build tooling). |

---

## 🛠️ Tech Stack Summary

| What | Technology | Why |
|------|-----------|-----|
| UI Framework | **React 19** + TypeScript | Component-based, typed, maintainable |
| Build Tool | **Vite 8** | Very fast dev server and builds |
| Styling | **Tailwind CSS v4** | Utility classes, no custom CSS files needed |
| Backend / DB | **Firebase** (Firestore + Auth + Storage) | Real-time database, built-in auth, file uploads |
| Maps | **Google Maps API** | Location picking and listing map view |
| AI | **Google Gemini API** (`@google/genai`) | Optional AI suggestions |
| Icons | **Lucide React** | Clean, consistent SVG icon set |
| Animations | **Motion** (Framer Motion) | Smooth transitions |
| Server | **Express** + `tsx` | Serves the built app in production |

---

## 🚀 How to Run the Project

```bash
# 1. Install all dependencies
npm install

# 2. Copy the example env file and fill in your API keys
cp .env.example .env

# 3. Start the development server
npm run dev
# Opens at http://localhost:3000
```

---

## 👤 User Roles

| Role | What they can do |
|------|-----------------|
| **Donor** | Post surplus food listings with quantity and expiry |
| **Recipient** | Browse listings, claim food, track deliveries |
| **Courier** | Accept pickup/delivery assignments (volunteer) |
| **Admin** | Verify NGO accounts, manage platform, view reports |

---

## 📊 Data Flow (Simplified)

```
Donor posts food  →  Firestore DB  →  Recipient sees listing
                         |
                    Courier picks up and delivers
                         |
                    Admin verifies NGO is legitimate
```

---

*This file was auto-generated to help any developer or reviewer understand the project at a glance.*
