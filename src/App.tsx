import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useOwner } from './context/OwnerContext';
import Layout from './components/Layout';
import { LoadingScreen } from './components/layout/LoadingScreen';
import './App.css';

// Lazy load components with explicit export for prefetching
const Lobby = lazy(() => import('./components/Lobby'));
const Auth = lazy(() => import('./components/Auth'));
const Properties = lazy(() => import('./components/Properties'));
const AddProperty = lazy(() => import('./components/AddProperty'));
const PropertyDetail = lazy(() => import('./components/PropertyDetail'));
const UnitDetail = lazy(() => import('./components/UnitDetail'));
const Payments = lazy(() => import('./components/Payments'));
const PaymentDetail = lazy(() => import('./components/PaymentDetail'));
const Settings = lazy(() => import('./components/Settings'));
const Customers = lazy(() => import('./components/Customers'));
const AddCustomer = lazy(() => import('./components/AddCustomer'));
const CustomerDetail = lazy(() => import('./components/CustomerDetail'));
const Hostels = lazy(() => import('./components/Hostels'));
const AddHostel = lazy(() => import('./components/AddHostel'));
const HostelDetail = lazy(() => import('./components/HostelDetail'));
const RoomDetail = lazy(() => import('./components/RoomDetail'));
const Leases = lazy(() => import('./components/Leases'));
const AddLease = lazy(() => import('./components/AddLease'));
const LeaseDetail = lazy(() => import('./components/LeaseDetail'));

// Prefetch Map
export const prefetchMap = {
  lobby: () => import('./components/Lobby'),
  properties: () => import('./components/Properties'),
  addProperty: () => import('./components/AddProperty'),
  propertyDetail: () => import('./components/PropertyDetail'),
  unitDetail: () => import('./components/UnitDetail'),
  payments: () => import('./components/Payments'),
  paymentDetail: () => import('./components/PaymentDetail'),
  settings: () => import('./components/Settings'),
  customers: () => import('./components/Customers'),
  addCustomer: () => import('./components/AddCustomer'),
  customerDetail: () => import('./components/CustomerDetail'),
  hostels: () => import('./components/Hostels'),
  addHostel: () => import('./components/AddHostel'),
  hostelDetail: () => import('./components/HostelDetail'),
  roomDetail: () => import('./components/RoomDetail'),
  leases: () => import('./components/Leases'),
  addLease: () => import('./components/AddLease'),
  leaseDetail: () => import('./components/LeaseDetail'),
};

function App() {
  const { user, ownerLoading } = useOwner();

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

  return (
    <div className="App">
      <Layout>
        <Suspense fallback={<LoadingScreen />}>
          <div className="page-fade-in">
            <Routes>
              <Route path="/" element={<Lobby />} />
              <Route path="/properties" element={<Properties />} />
              <Route path="/properties/new" element={<AddProperty />} />
              <Route path="/properties/:id" element={<PropertyDetail />} />
              <Route path="/units/:id" element={<UnitDetail />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/new" element={<AddCustomer />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/hostels" element={<Hostels />} />
              <Route path="/hostels/new" element={<AddHostel />} />
              <Route path="/hostels/:id" element={<HostelDetail />} />
              <Route path="/rooms/:id" element={<RoomDetail />} />
              <Route path="/leases" element={<Leases />} />
              <Route path="/leases/new" element={<AddLease />} />
              <Route path="/leases/:id" element={<LeaseDetail />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/payments/:id" element={<PaymentDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Suspense>
      </Layout>
    </div>
  );
}

export default App;
