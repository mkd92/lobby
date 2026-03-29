# Codebase Structure

**Analysis Date:** 2025-05-14

## Directory Layout

```
lobby/
├── public/             # Static assets (favicons, manifest)
├── src/
│   ├── assets/         # Images and SVG assets
│   ├── components/     # React UI components
│   ├── context/        # React Context providers
│   ├── hooks/          # Custom shared hooks
│   ├── styles/         # CSS files and design tokens
│   ├── App.tsx         # Main App component (routing)
│   ├── main.tsx        # Application entry point
│   ├── firebaseClient.ts # Firebase initialization
│   └── supabaseClient.ts # Supabase initialization
├── supabase/           # SQL snippets and Supabase config
├── package.json        # Dependencies and scripts
└── vite.config.ts      # Vite configuration
```

## Directory Purposes

**src/components/:**
- Purpose: Contains all page and shared UI components.
- Key files: `Lobby.tsx`, `Properties.tsx`, `Auth.tsx`.

**src/context/:**
- Purpose: Global state management.
- Key files: `OwnerContext.tsx` (auth and ownership state), `ThemeContext.tsx`.

**src/styles/:**
- Purpose: Centralized styling.
- Key files: `design-tokens.css` (variables), `Lobby.css`.

**supabase/:**
- Purpose: Backend schema definition (reference/legacy).

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM mount.
- `src/App.tsx`: Route definitions.

**Configuration:**
- `vite.config.ts`: Build and PWA config.
- `tsconfig.json`: TS settings.

**Core Logic:**
- `src/context/OwnerContext.tsx`: Manages auth state and owner identity.

**Testing:**
- Not applicable (no tests).

## Naming Conventions

**Files:**
- Components/Styles: PascalCase
- Others: camelCase

## Where to Add New Code

**New Feature:**
- Primary code: Create new component in `src/components/`.
- Styling: Create matching CSS file in `src/styles/`.
- Routes: Add to `src/App.tsx`.

**New Component/Module:**
- Shared UI: `src/components/common/` (suggested addition).

**Utilities:**
- Shared helpers: Create `src/utils/` (suggested addition).

## Special Directories

**node_modules/:**
- Purpose: External dependencies.
- Generated: Yes.
- Committed: No.

---

*Structure analysis: 2025-05-14*
