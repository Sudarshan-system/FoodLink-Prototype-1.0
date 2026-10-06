# FoodLink 🌿

**Direct Food Rescue & Donation Network**

FoodLink connects restaurants, caterers, and event venues with verified NGOs, orphanages, and community shelters to rescue surplus food before it goes to waste.

---

## Features

- **Donor Dashboard** — list surplus meals with quantity, dietary type, and a safe-eating countdown timer
- **Recipient Dashboard** — browse and claim available listings with real-time map view
- **Volunteer / Courier Logistics** — manage pickup and delivery assignments
- **Leaderboard** — recognise top food donors by impact score
- **Admin Panel** — verify NGO registrations and manage platform integrity
- **FSSAI Compliance** — built around India's food safety guidelines
- **Dark Mode** — full light/dark theme support

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Backend/DB | Firebase (Firestore, Auth, Storage) |
| Fonts | Inter, Outfit (Google Fonts) |

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env` file in the root with your Firebase config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

## Contributing

Pull requests are welcome. For major changes please open an issue first to discuss what you'd like to change.

## License

MIT © Sudarshan
