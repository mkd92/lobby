# Coding Conventions

**Analysis Date:** 2025-05-14

## Naming Patterns

**Files:**
- Components: PascalCase.tsx (e.g., `src/components/Properties.tsx`)
- Styles: PascalCase.css (matching component name) (e.g., `src/styles/Properties.css`)
- Context: PascalCase.tsx (e.g., `src/context/OwnerContext.tsx`)
- Hooks: camelCase starting with `use` (e.g., `src/hooks/useDialog.tsx`)

**Functions:**
- React components: PascalCase (e.g., `const Properties: React.FC = () => { ... }`)
- Event handlers: `handle` prefix (e.g., `handleEditSave`)
- Utility functions: camelCase

**Variables:**
- Local variables: camelCase
- Constants: camelCase or UPPER_CASE for truly global static values (not common in components)
- Environment Variables: UPPER_CASE (e.g., `VITE_SUPABASE_URL`)

**Types:**
- Interfaces: PascalCase (e.g., `interface Property`)
- Type Aliases: PascalCase

## Code Style

**Formatting:**
- Vite + React 19 default formatting (likely Prettier defaults)
- 2-space indentation

**Linting:**
- ESLint (v9) with `typescript-eslint` and `eslint-plugin-react-hooks`
- Configured in `eslint.config.js`

## Import Organization

**Order:**
1. React core imports
2. External libraries (react-router-dom, firebase, @tanstack/react-query)
3. Local hooks/context
4. Local components
5. Style files

**Path Aliases:**
- Not detected. Relative paths are used (e.g., `../firebaseClient`)

## Error Handling

**Patterns:**
- Try-catch blocks in async event handlers
- Error messages displayed via `showAlert` from `useDialog` hook or local `error` state.

## Logging

**Framework:**
- Console only.
- `console.error` and `console.log` used sparingly for debugging.

## Comments

**When to Comment:**
- Comments used to separate logical sections in larger components (e.g., `// All 5 fetches in parallel` in `Lobby.tsx`)

**JSDoc/TSDoc:**
- Not detected in the main components.

## Function Design

**Size:**
- Components tend to be quite large (200-300+ lines) as they include complex JSX, modal logic, and data fetching.

**Parameters:**
- Functional components using `React.FC<{ props }>` pattern.

**Return Values:**
- TSX/JSX for components.
- Promises for async functions (e.g., `queryFn` in React Query).

## Module Design

**Exports:**
- Default exports for components (e.g., `export default Properties;`)
- Named exports for context/hooks/clients (e.g., `export const useOwner = ...`)

**Barrel Files:**
- Not detected. Components imported directly.

---

*Convention analysis: 2025-05-14*
