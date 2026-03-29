Redesigned the Customers page and added a CustomerDetail page.
Key changes:
- Created `src/components/CustomerDetail.tsx` for viewing and editing customer details.
- Updated `src/App.tsx` with `/customers/:id` route.
- Updated `src/components/Customers.tsx` to navigate to `/customers/:id` on row/card click.
- Unified styling using `Leases.css` and `Properties.css` patterns.
- Renamed "Customers" to "Stakeholders" and "Entities" in the UI to match the high-end redesign.