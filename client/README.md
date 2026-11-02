# QuickEMS — Client

React 19 + Vite 8 + Tailwind CSS 4 single-page application for **QuickEMS**, the Employee Management System.

For the full project overview, architecture, API reference, and setup guide, see the [root README](../README.md).

## Run locally

```bash
cp .env.example .env   # VITE_BASE_URL=http://localhost:4000
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

| Route | Portal |
| --- | --- |
| `/login/admin` | Admin sign-in |
| `/login/employee` | Employee sign-in |
| `/dashboard` | Role-aware dashboard |
| `/employees` | Admin only — employee management |
| `/attendance` | Employee only — check-in / check-out and history |
| `/leave` | Leave applications and approvals |
| `/payslips` | Payslips and print view |
| `/settings` | Profile and password |

## Scripts

```bash
npm run dev      # Start the Vite dev server
npm run build    # Production build to dist/
npm run preview  # Preview the production build
npm run lint     # Run ESLint
```
