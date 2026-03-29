# External Integrations

**Analysis Date:** 2025-05-14

## APIs & External Services

**Cloud Services:**
- Firebase - Primary backend (Auth, Firestore).
  - SDK: `firebase` package.
  - Auth: Email/Password, Google Auth (signInWithPopup).
- Supabase - Secondary/Redundant backend.
  - SDK: `@supabase/supabase-js`.
  - Auth: Configured via env vars.

## Data Storage

**Databases:**
- Firebase Firestore (NoSQL).
  - Connection: Initialized in `src/firebaseClient.ts`.
- Supabase (PostgreSQL).
  - Client: `supabaseClient.ts`.
  - Schema snippets: `supabase/snippets/*.sql`.

**File Storage:**
- Firebase Storage (implied by config in `firebaseClient.ts`, but not used in UI yet).

**Caching:**
- TanStack React Query (In-memory caching of API responses).

## Authentication & Identity

**Auth Provider:**
- Firebase Auth.
  - Implementation: Custom UI in `src/components/Auth.tsx`.

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- Console-based logging.

## CI/CD & Deployment

**Hosting:**
- Vercel (`vercel.json` present).

**CI Pipeline:**
- None detected.

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- (Firebase keys are currently hardcoded but should be env vars).

**Secrets location:**
- Not detected. Expected to be in Vercel environment variables.

## Webhooks & Callbacks

**Incoming:**
- None detected.

**Outgoing:**
- None detected.

---

*Integration audit: 2025-05-14*
