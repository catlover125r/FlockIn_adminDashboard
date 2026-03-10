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
