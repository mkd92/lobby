# Technology Stack

**Analysis Date:** 2025-05-14

## Languages

**Primary:**
- TypeScript 5.9.3 - Used for all logic and components.

**Secondary:**
- SQL - Snippets for Supabase schema setup.
- CSS - Raw CSS for styling with design tokens.

## Runtime

**Environment:**
- Node.js (via Vite)
- Browser-based React 19 application.

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present.

## Frameworks

**Core:**
- React 19.2.4 - Frontend UI framework.
- React Router 7.13.2 - Client-side routing.

**Testing:**
- Not detected. No testing framework in `package.json`.

**Build/Dev:**
- Vite 7.0.0 - Build tool and development server.
- ESLint 9.39.4 - Linting.

## Key Dependencies

**Critical:**
- Firebase 12.11.0 - Primary backend for Auth and Firestore (as seen in implementation).
- @tanstack/react-query 5.95.2 - Data fetching and caching layer.
- @supabase/supabase-js 2.100.0 - Supabase client (configured but unused in core UI).

**Infrastructure:**
- Recharts 3.8.1 - Data visualization for the dashboard.
- vite-plugin-pwa 1.2.0 - PWA support.

## Configuration

**Environment:**
- Configured via `.env` files (implied by `import.meta.env`).
- Key configs required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

**Build:**
- `vite.config.ts` - Main build and plugin configuration.
- `tsconfig.json` / `tsconfig.app.json` - TypeScript configuration.

## Platform Requirements

**Development:**
- Modern web browser.
- Node.js environment for Vite.

**Production:**
- Vercel (indicated by `vercel.json`).

---

*Stack analysis: 2025-05-14*
