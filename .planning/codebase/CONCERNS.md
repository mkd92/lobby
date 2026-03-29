# Codebase Concerns

**Analysis Date:** 2025-05-14

## Tech Debt

**Dual Backend (Firebase vs Supabase):**
- Issue: The project has a `supabase/` folder, `supabaseClient.ts`, and Supabase SQL snippets, but all active React components (`Properties.tsx`, `Lobby.tsx`, `Auth.tsx`, etc.) are using Firebase for authentication and database.
- Files: `src/supabaseClient.ts`, `src/firebaseClient.ts`, `src/components/Properties.tsx`, `src/components/Lobby.tsx`
- Impact: Inconsistency in data management, potential for data split between platforms, increased maintenance burden.
- Fix approach: Choose one backend (likely Firebase, as it's more integrated now, or Supabase if migration is intended) and remove the other.

**Hardcoded Firebase Credentials:**
- Issue: Firebase configuration is hardcoded directly in the client file.
- Files: `src/firebaseClient.ts`
- Impact: Security risk (although public-facing keys, they shouldn't be in the repo) and difficulty managing environments.
- Fix approach: Move credentials to `.env` files and use `import.meta.env.VITE_FIREBASE_...`

**Large Component Complexity:**
- Issue: Components like `Properties.tsx` and `Lobby.tsx` handle data fetching, state, modal management, and complex rendering in a single file.
- Files: `src/components/Properties.tsx`, `src/components/Lobby.tsx`
- Impact: Difficult to test, maintain, and reuse.
- Fix approach: Extract business logic into custom hooks; extract sub-components (e.g., `PropertyCard`, `EditPropertyModal`).

## Known Bugs

**Manual Currency Formatting:**
- Issue: Dashboard currency symbols and formatting are hardcoded as a dictionary.
- Files: `src/components/Lobby.tsx`
- Impact: Limited support for locale-specific formatting (e.g., decimal separator, symbol placement).
- Fix approach: Use `Intl.NumberFormat` for currency formatting.

## Security Considerations

**Vulnerability to Hardcoded Keys:**
- Risk: Potential for unauthorized use of Firebase project if keys are leaked and not properly restricted in Firebase Console.
- Files: `src/firebaseClient.ts`
- Current mitigation: None detected in code.
- Recommendations: Restrict API keys in Firebase console and move to `.env`.

## Performance Bottlenecks

**Large Stylesheets:**
- Problem: Styles are organized into many separate files but all are imported or co-located.
- Files: `src/styles/*.css`
- Cause: No CSS-in-JS or CSS Modules usage. Global namespace collision risk.
- Improvement path: Migrate to CSS Modules or a utility-first framework like Tailwind to reduce bundle size and styling complexity.

**Lack of Code Splitting:**
- Problem: All components seem to be imported directly in `App.tsx` (implied by file structure).
- Files: `src/App.tsx`
- Cause: Standard imports used.
- Improvement path: Use `React.lazy` and `Suspense` for route-level code splitting.

## Fragile Areas

**Direct DOM Access in Styling:**
- Files: `src/index.css`, `src/styles/design-tokens.css`
- Why fragile: Heavy reliance on global CSS variables and global selector resets (`aside, header, main, section, nav { border: none !important; }`).
- Safe modification: Encapsulate component-specific styles.
- Test coverage: Zero.

## Missing Critical Features

**Automated Testing:**
- Problem: Complete lack of unit, integration, or E2E tests.
- Blocks: Confidence in refactoring or adding new features without regression.

**PWA Assets:**
- Problem: Icons for PWA are limited to `icon.svg` and `favicon.svg`.
- Blocks: Proper install experience on different devices (e.g., iOS requires specific sizes).

## Test Coverage Gaps

**Entire Codebase:**
- What's not tested: All business logic, UI components, and data fetching.
- Files: `src/components/*`, `src/context/*`
- Risk: High. Undetected regressions.
- Priority: High.

---

*Concerns audit: 2025-05-14*
