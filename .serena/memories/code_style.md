# Code Style & Conventions

- **Language:** TypeScript (strict-ish, tsconfig.app.json + tsconfig.node.json)
- **Components:** React functional components with hooks; `.tsx` extension
- **Naming:** PascalCase for components/files, camelCase for variables/functions
- **Styling:** Per-component CSS files in `src/styles/` (e.g. `Lobby.css`, `Payments.css`); design tokens in `src/styles/design-tokens.css`
- **No CSS framework** (no Tailwind; some utility class names like `h-screen flex` appear but these are custom)
- **Imports:** Named imports from libraries; default exports for components
- **No docstrings/comments** unless logic is non-obvious
- **State management:** React useState/useEffect; context via `src/context/ThemeContext.tsx`
- **DB access:** Via `src/supabaseClient.ts` singleton
