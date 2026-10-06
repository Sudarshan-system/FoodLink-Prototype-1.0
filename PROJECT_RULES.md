# FoodLink project rules
- Product: FoodLink connects donors (restaurants, caterers, wedding hosts) with verified organizations (NGOs, orphanages, old age homes, shelters) in India. Roles: Donor, Organization, Admin. Courier is optional and undecided.
- Stack: use what is already in this project (React, Vite, Firebase Auth, Firestore, Storage, Google Maps). Do not add new libraries unless I ask.
- Theme: light mode by default, green. Background #FAFBF8, text #1E2A22, green #2E7D4F (hover #1F5C39), soft green #EAF3EC, borders #D9E2DA, amber #D9822B only for urgent labels. Dark mode (toggle in navbar) uses #111A14. No gradients, glow, glassmorphism, or orange/teal/navy.
- Fonts: two Google Fonts only (serif headings, clean sans body). Never Inter or Poppins.
- Layout: one shared page container (max width 1600px, responsive side padding), fully responsive at 360, 768, 1024, and 1440px with no horizontal scroll and tap targets of at least 44px.
- Copy: plain natural English. No em dashes, no buzzwords, no fake statistics, fake claims (legal, tax), fake phone numbers, or fake testimonials.
- Safety: never change Firebase security rules, auth logic, or backend logic unless I ask. Never put secrets in frontend code. Never read, print, or copy the contents of .env.
- Workflow: do one task at a time. Before editing, list the files you will change. Do not add features I did not ask for. Keep changes small.
