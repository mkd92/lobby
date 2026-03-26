import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      if (session && window.location.pathname === '/login') {
        navigate('/');
      } else if (!session) {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-surface">Loading...</div>;
  }

  if (!session) {
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
