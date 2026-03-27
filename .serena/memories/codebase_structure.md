# Codebase Structure

```
src/
  App.tsx               # Root component, auth guard, routes
  main.tsx              # Entry point
  supabaseClient.ts     # Supabase client singleton
  globals.d.ts          # Global type declarations
  App.css / index.css   # Global styles
  components/           # Page-level and shared components
    Lobby.tsx           # Dashboard/home
    Layout.tsx          # Shell with nav
    Auth.tsx            # Login
    Properties.tsx / AddProperty.tsx / PropertyDetail.tsx
    Hostels.tsx / AddHostel.tsx / HostelDetail.tsx
    Customers.tsx / AddCustomer.tsx
    Leases.tsx
    Payments.tsx
    Settings.tsx
  styles/               # Per-component CSS + design tokens
  context/
    ThemeContext.tsx
  hooks/
    useDialog.tsx
  assets/               # Static images
supabase/               # Supabase migrations/config
public/                 # Static public assets (PWA manifest etc.)
```

**Routing:** All routes defined in `App.tsx`; auth-guarded (redirects to `/login` if no session).
