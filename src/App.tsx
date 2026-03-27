import { Routes, Route, Navigate } from 'react-router-dom';
import { useOwner } from './context/OwnerContext';
import Lobby from './components/Lobby';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Properties from './components/Properties';
import AddProperty from './components/AddProperty';
import PropertyDetail from './components/PropertyDetail';
import Payments from './components/Payments';
import Settings from './components/Settings';
import Customers from './components/Customers';
import AddCustomer from './components/AddCustomer';
import Hostels from './components/Hostels';
import AddHostel from './components/AddHostel';
import HostelDetail from './components/HostelDetail';
import Leases from './components/Leases';
import './App.css';

function App() {
  const { user, ownerLoading } = useOwner();

  if (ownerLoading) {
    return <div className="h-screen flex items-center justify-center bg-surface">Loading...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="App">
      <Layout>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/new" element={<AddProperty />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/new" element={<AddCustomer />} />
          <Route path="/hostels" element={<Hostels />} />
          <Route path="/hostels/new" element={<AddHostel />} />
          <Route path="/hostels/:id" element={<HostelDetail />} />
          <Route path="/leases" element={<Leases />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </div>
  );
}

export default App;
