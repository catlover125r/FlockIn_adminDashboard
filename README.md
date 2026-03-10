# FlockIn Admin Dashboard

An admin dashboard for the **FlockIn** platform — manages students, events, and volunteer/club hours.

## Features

- **Students** — View, manage, and edit student records; inspect individual signups
- **Events** — Create and edit events with a modal form
- **Hours tracking** — Monitor hours logged per student
- **Role-based auth** — Firebase Authentication gates access to the dashboard
- **Confirm dialogs** — Destructive actions require confirmation

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS v3
- **Backend:** Firebase (Auth + Firestore via client SDK and Admin SDK)

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Authentication and Firestore enabled

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/catlover125r/FlockIn_adminDashboard.git
   cd FlockIn_adminDashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   FIREBASE_ADMIN_SERVICE_ACCOUNT=
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and sign in with a Firebase admin account.

## Project Structure

```
app/
├── (dashboard)/
│   ├── events/
│   ├── hours/
│   ├── students/
│   └── page.tsx
├── api/
│   ├── events/
│   └── notify/
└── login/
components/
├── AuthProvider.tsx
├── Sidebar.tsx
├── EventModal.tsx
├── StudentModal.tsx
└── ConfirmDialog.tsx
```
