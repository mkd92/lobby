import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/Lobby.css';

const currencySymbols: { [key: string]: string } = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$'
};

const DataPulse: React.FC = () => (
  <span className="data-pulse"></span>
);

const MetricCard: React.FC<{ label: string; value: string; trend?: string }> = ({ label, value, trend }) => (
  <div className="metric-card">
    <div className="label-small uppercase tracking-widest opacity-50 mb-2">{label}</div>
    <div className="display-medium font-black tracking-tight">{value}</div>
    {trend && <div className="metric-trend">{trend}</div>}
  </div>
);

const Lobby: React.FC = () => {
  const [stats, setStats] = useState({
    occupancyRate: '0%',
    monthlyRevenue: '$0',
    activeMaintenance: '0',
    pendingLeases: '0'
  });
  const [loading, setLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch owner's currency
        const { data: ownerData } = await supabase
          .from('owners')
          .select('currency')
          .eq('id', user.id)
          .single();
        
        const symbol = currencySymbols[ownerData?.currency || 'USD'] || '$';
        setCurrencySymbol(symbol);

        // 1. Get all properties to calculate occupancy
        const { data: units } = await supabase
          .from('units')
          .select('id, status')
          .innerJoin('properties', 'property_id', 'id')
          .eq('properties.owner_id', user.id);

        const totalUnits = units?.length || 0;
        const occupiedUnits = units?.filter(u => u.status === 'Occupied').length || 0;
        const occupancy = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

        // 2. Get monthly revenue from payments this month
        const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        const { data: payments } = await supabase
          .from('payments')
          .select('amount')
          .eq('month_for', currentMonth);
        
        const revenue = payments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

        // 3. Get active maintenance
        const { count: maintenanceCount } = await supabase
          .from('maintenance_requests')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'Resolved');

        setStats({
          occupancyRate: `${occupancy}%`,
          monthlyRevenue: `${symbol}${(revenue / 1000).toFixed(1)}k`,
          activeMaintenance: String(maintenanceCount || 0),
          pendingLeases: '0' // Placeholder for now
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  return (
    <>
      <header className="main-header">
        <div className="header-top flex justify-between items-center mb-12">
          <div>
            <h1 className="font-display">Portfolio Overview</h1>
            <p className="text-on-surface-variant flex items-center">
              <DataPulse /> {loading ? 'Updating metrics...' : 'Live Data Analytics'}
            </p>
          </div>
          <Link to="/properties/new" className="primary-button glass" style={{ textDecoration: 'none' }}>
            + New Property
          </Link>
        </div>
      </header>
      
      <section className="metrics-grid">
        <MetricCard label="Occupancy Rate" value={stats.occupancyRate} trend="+0.4% this month" />
        <MetricCard label="Monthly Revenue" value={stats.monthlyRevenue} trend="Current Month" />
        <MetricCard label="Active Maintenance" value={stats.activeMaintenance} />
        <MetricCard label="Pending Leases" value={stats.pendingLeases} />
      </section>

      <section className="featured-property mt-16">
        <div className="label-small uppercase tracking-widest opacity-50 mb-4">Quick Actions</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/properties" className="property-banner glass p-8 rounded-3xl relative overflow-hidden block" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined mb-4" style={{ fontSize: '2.5rem' }}>domain</span>
            <h3 className="font-bold">Manage Properties</h3>
            <p className="opacity-70">View and update units</p>
          </Link>
          <Link to="/payments" className="property-banner glass p-8 rounded-3xl relative overflow-hidden block" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined mb-4" style={{ fontSize: '2.5rem' }}>payments</span>
            <h3 className="font-bold">Rent Collection</h3>
            <p className="opacity-70">Track payments & arrears</p>
          </Link>
          <div className="property-banner glass p-8 rounded-3xl relative overflow-hidden">
            <span className="material-symbols-outlined mb-4" style={{ fontSize: '2.5rem' }}>engineering</span>
            <h3 className="font-bold">Maintenance</h3>
            <p className="opacity-70">Track repair requests</p>
          </div>
        </div>
      </section>
    </>
  );
};

export default Lobby;
