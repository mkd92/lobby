# MOMA Architecture & Design

## 1. Technical Stack
MOMA is a modern, high-performance financial management application built with:
- **Frontend Engine**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) for a lightning-fast developer experience and efficient production builds.
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) using the latest `@theme` block for centralized design tokens.
- **Backend-as-a-Service**: [Supabase](https://supabase.com/) providing PostgreSQL, Realtime database updates, and Authentication.
- **Visualizations**: [Recharts](https://recharts.org/) for high-performance, responsive financial analytics.
- **Routing**: [React Router Dom 7](https://reactrouter.com/) for deep-linking and state-aware navigation.

## 2. Design Philosophy: The "Vault" Aesthetic
MOMA follows a unique **monochromatic, high-contrast** design language optimized for financial clarity and "executive" feel.

### Core Principles:
- **Semantic Coloring**: Colors are never hardcoded as hex values. Instead, they use semantic CSS variables (e.g., `var(--surface)`, `var(--on-surface)`, `var(--primary)`) defined in `src/index.css`.
- **Dual-Theme Integrity**: Every component is designed to work perfectly in both **Light** and **Dark** modes. Theme switching is controlled by a `data-theme` attribute on the root element.
- **Typography**: 
  - **Manrope**: Used for headlines and financial figures to provide a "premium/geometric" look.
  - **Inter**: Used for body text and granular metadata for maximum readability.
- **Density**: The UI balances "airy" dashboards with dense, functional "matrix" views (like the simplified filter panel) to cater to both casual and power users.

## 3. Component Architecture
The application uses a **Modular Shell** pattern to maintain a consistent UI across all views.

### Layout System (`src/components/layout/`):
- **PageShell**: The structural wrapper for all views. It manages the responsive layout:
  - **Sidebar (Desktop)**: A left-rail navigation with a collapsible state for maximized workspace.
  - **TopHeader (Global)**: A fixed header for branding, theme switching, and user profile.
  - **BottomNav (Mobile)**: Optimized bottom navigation for one-handed reachability.
- **Views (`src/views/`)**: Each major feature (Dashboard, Ledger, Analytics, Budgets) is a self-contained "View" component that receives its data and actions via props.

## 4. State & Data Flow
MOMA employs a **Centralized Hook** architecture to manage complex financial data and derived analytics.

### The Engine: `useAppData` (`src/hooks/useAppData.js`):
This custom hook is the "brain" of the application. It:
1. **Orchestrates Data**: Fetches and subscribes to Supabase tables (transactions, categories, accounts, etc.).
2. **Derives Intelligence**: Calculates complex KPIs on-the-fly, such as:
   - Burn rates and savings rates.
   - Categorical breakdowns and time-series data for charts.
   - Portfolio change percentages.
3. **Manages Filters**: Maintains the global filter state for the "Vault Stream" (Ledger) and Analytics views.
4. **Mutates State**: Provides standardized callback functions (e.g., `handleDeleteTransaction`, `handleBulkAssignCategory`) for all data modifications.

### Performance & Persistence:
- **Smart Caching (`src/cache.js`)**: Core data entities are cached in `localStorage` with versioning. This allows the UI to render instantly on reload while Supabase revalidates the data in the background.
- **Real-time Synchronization**: Supabase subscriptions ensure that any change made on one device is reflected across all active sessions instantly.

## 5. Deployment & Infrastructure
- **Hosting**: Deployed on **Netlify** for automated CI/CD and globally distributed edge delivery.
- **Security**: Database access is protected via **Supabase Row Level Security (RLS)**, ensuring users can only access their own financial records.
- **Environment Management**: Secrets and API keys are strictly managed via environment variables (`.env`) and never committed to source control.
