# Architecture

**Analysis Date:** 2025-05-14

## Pattern Overview

**Overall:** Component-based Single Page Application (SPA) with external BaaS (Backend-as-a-Service).

**Key Characteristics:**
- React 19 Hooks for logic.
- TanStack React Query for data management.
- External State: Primarily handled by React Query for data and Context for global state (Owner, Theme).
- Responsive Design: Mobile-first layout with separate sidebar (desktop) and bottom nav (mobile).

## Layers

**UI Layer:**
- Purpose: Render views and handle user interaction.
- Location: `src/components/`
- Contains: React Components (TSX), Styles (CSS).

**State/Context Layer:**
- Purpose: Manage shared application state (auth, themes).
- Location: `src/context/`
- Contains: React Context providers and custom hooks.

**Data Access Layer:**
- Purpose: Interface with Firebase and Supabase.
- Location: `src/firebaseClient.ts`, `src/supabaseClient.ts`, and inline in components via React Query.
- Depends on: Firebase SDK, Supabase SDK.

**Logic Layer (Hooks):**
- Purpose: Shared component logic.
- Location: `src/hooks/`
- Contains: Custom hooks (e.g., `useDialog`).

## Data Flow

**Standard Fetching:**
1. Component uses `useQuery` (React Query).
2. `queryFn` calls Firebase Firestore functions.
3. React Query caches results and returns `data`, `isLoading`, etc.
4. UI renders based on state.

**State Management:**
- Global config (Theme, OwnerId) stored in Context.
- Component-specific UI state (Modals, Forms) stored in local `useState`.

## Key Abstractions

**useQuery:**
- Purpose: Abstracting asynchronous data fetching and lifecycle.
- Examples: `src/components/Properties.tsx`, `src/components/Lobby.tsx`.

**useDialog:**
- Purpose: Abstracting modal alerts and confirmations.
- Location: `src/hooks/useDialog.tsx`.

## Entry Points

**Main Entry:**
- Location: `src/main.tsx`
- Triggers: Browser page load.
- Responsibilities: Render `App` component into DOM, provide QueryClient and Router.

## Error Handling

**Strategy:** Inline try/catch with UI feedback.

**Patterns:**
- `showAlert(message)` from `useDialog`.
- React Query's built-in error state.

## Cross-Cutting Concerns

**Logging:** Standard console logs.
**Validation:** Basic HTML5 validation + manual checks in submit handlers.
**Authentication:** Firebase Auth managed via `OwnerContext.tsx`.

---

*Architecture analysis: 2025-05-14*
