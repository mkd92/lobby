import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useOwner } from './context/OwnerContext';
import Layout from './components/Layout';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

// Lazy load components with explicit export for prefetching
const Lobby       = lazy(() => import('./components/Lobby'));
const Auth        = lazy(() => import('./components/Auth'));
const Payments    = lazy(() => import('./components/Payments'));
const PaymentDetail = lazy(() => import('./components/PaymentDetail'));
const Settings    = lazy(() => import('./components/Settings'));
const Customers   = lazy(() => import('./components/Customers'));
const AddCustomer = lazy(() => import('./components/AddCustomer'));
const CustomerDetail = lazy(() => import('./components/CustomerDetail'));
const AddHostel   = lazy(() => import('./components/AddHostel'));
const HostelDetail = lazy(() => import('./components/HostelDetail'));
const RoomDetail  = lazy(() => import('./components/RoomDetail'));
const AddLease    = lazy(() => import('./components/AddLease'));
const LeaseDetail = lazy(() => import('./components/LeaseDetail'));
const AddProperty = lazy(() => import('./components/AddProperty'));
const PropertyDetail = lazy(() => import('./components/PropertyDetail'));
const AddPropertyLease = lazy(() => import('./components/AddPropertyLease'));
const PropertyLeaseDetail = lazy(() => import('./components/PropertyLeaseDetail'));
const Portfolio   = lazy(() => import('./components/Portfolio'));
const Agreements  = lazy(() => import('./components/Agreements'));
const Reports     = lazy(() => import('./components/Reports'));
const Team        = lazy(() => import('./components/Team'));

// Prefetch Map
export const prefetchMap = {
  lobby:       () => import('./components/Lobby'),
  payments:    () => import('./components/Payments'),
  paymentDetail: () => import('./components/PaymentDetail'),
  settings:    () => import('./components/Settings'),
  customers:   () => import('./components/Customers'),
  addCustomer: () => import('./components/AddCustomer'),
  customerDetail: () => import('./components/CustomerDetail'),
  hostels:     () => import('./components/Hostels'),
  addHostel:   () => import('./components/AddHostel'),
  hostelDetail: () => import('./components/HostelDetail'),
  roomDetail:  () => import('./components/RoomDetail'),
  leases:      () => import('./components/Leases'),
  addLease:    () => import('./components/AddLease'),
  leaseDetail: () => import('./components/LeaseDetail'),
  properties:  () => import('./components/Properties'),
  addProperty: () => import('./components/AddProperty'),
  propertyDetail: () => import('./components/PropertyDetail'),
  propertyLeases: () => import('./components/PropertyLeases'),
  addPropertyLease: () => import('./components/AddPropertyLease'),
  propertyLeaseDetail: () => import('./components/PropertyLeaseDetail'),
  portfolio:   () => import('./components/Portfolio'),
  agreements:  () => import('./components/Agreements'),
  reports:     () => import('./components/Reports'),
  team:        () => import('./components/Team'),
};

function App() {
  const { user, ownerLoading, userRole } = useOwner();

  if (ownerLoading) {
    return <LoadingScreen message="Initializing session" />;
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  const isViewer = userRole === 'viewer';

  return (
    <div className="App">
      <Layout>
        <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <div className="page-fade-in">
            <Routes>
              {isViewer ? (
                // Viewers: payments page only
                <>
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/payments/:id" element={<PaymentDetail />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/payments" replace />} />
                </>
              ) : (
                // Owners & managers: full access
                <>
                  <Route path="/" element={<Lobby />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/new" element={<AddCustomer />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/hostels" element={<Navigate to="/portfolio" replace />} />
                  <Route path="/hostels/new" element={<AddHostel />} />
                  <Route path="/hostels/:id" element={<HostelDetail />} />
                  <Route path="/rooms/:id" element={<RoomDetail />} />
                  <Route path="/properties" element={<Navigate to="/portfolio" replace />} />
                  <Route path="/properties/new" element={<AddProperty />} />
                  <Route path="/properties/:id" element={<PropertyDetail />} />
                  <Route path="/agreements" element={<Agreements />} />
                  <Route path="/leases" element={<Navigate to="/agreements" replace />} />
                  <Route path="/leases/new" element={<AddLease />} />
                  <Route path="/leases/:id" element={<LeaseDetail />} />
                  <Route path="/property-leases" element={<Navigate to="/agreements" replace />} />
                  <Route path="/property-leases/new" element={<AddPropertyLease />} />
                  <Route path="/property-leases/:id" element={<PropertyLeaseDetail />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/payments/:id" element={<PaymentDetail />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}
            </Routes>
          </div>
        </Suspense>
        </ErrorBoundary>
      </Layout>
    </div>
  );
}

export default App;
