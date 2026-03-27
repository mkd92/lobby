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

const MetricCard: React.FC<{ label: string; value: string; trend?: string; sub?: string }> = ({ label, value, trend, sub }) => (
  <div className="metric-card">
    <div className="label-small uppercase tracking-widest opacity-50 mb-2">{label}</div>
    <div className="display-medium font-black tracking-tight">{value}</div>
    {sub && <div className="metric-sub">{sub}</div>}
    {trend && <div className="metric-trend">{trend}</div>}
  </div>
);

const formatCurrency = (amount: number, symbol: string): string => {
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}k`;
  return `${symbol}${amount.toFixed(0)}`;
};

const Lobby: React.FC = () => {
  const [stats, setStats] = useState({
    monthlyRevenue: '—',
    overdueAmount: '—',
    leaseExpirations: '—',
    annualRevenue: '—',
    totalUnits: '—',
    vacantUnits: '—',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Currency preference
        const { data: ownerData } = await supabase
          .from('owners')
          .select('currency')
          .eq('id', user.id)
          .single();
        const symbol = currencySymbols[ownerData?.currency || 'USD'] || '$';

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
        const todayStr = today.toISOString().split('T')[0];
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);
        const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        // 1. Total units and vacant count
        const { data: units } = await supabase
          .from('units')
          .select('id, status, properties!inner(owner_id)')
          .eq('properties.owner_id', user.id);

        const totalUnits = units?.length || 0;
        const vacantUnits = (units as any[])?.filter(u => u.status === 'Vacant').length || 0;

        // 2. All leases for this owner — unit leases
        const { data: unitLeases } = await supabase
          .from('leases')
          .select('id, end_date, status, units!inner(properties!inner(owner_id))')
          .eq('units.properties.owner_id', user.id)
          .not('unit_id', 'is', null);

        // All leases for this owner — bed (hostel) leases
        const { data: bedLeases } = await supabase
          .from('leases')
          .select('id, end_date, status, beds!inner(rooms!inner(hostels!inner(owner_id)))')
          .eq('beds.rooms.hostels.owner_id', user.id)
          .not('bed_id', 'is', null);

        const allLeases = [...(unitLeases || []), ...(bedLeases || [])];
        const leaseIds = allLeases.map((l: any) => l.id);

        // Upcoming lease expirations — active leases ending within 30 days
        const expiringCount = allLeases.filter((l: any) =>
          l.status === 'Active' &&
          l.end_date &&
          l.end_date >= todayStr &&
          l.end_date <= thirtyDaysLaterStr
        ).length;

        // 3. Payments for this owner's leases
        let monthlyRevenue = 0;
        let annualRevenue = 0;
        let overdueAmount = 0;

        if (leaseIds.length > 0) {
          const { data: payments } = await supabase
            .from('payments')
            .select('amount, status, month_for, payment_date')
            .in('lease_id', leaseIds);

          payments?.forEach((p: any) => {
            const amount = Number(p.amount);
            if (p.status === 'Paid' && p.month_for === currentMonth) {
              monthlyRevenue += amount;
            }
            if (p.status === 'Paid' && p.payment_date >= yearStart && p.payment_date <= yearEnd) {
              annualRevenue += amount;
            }
            if (p.status === 'Pending' || p.status === 'Partial') {
              overdueAmount += amount;
            }
          });
        }

        setStats({
          monthlyRevenue: formatCurrency(monthlyRevenue, symbol),
          overdueAmount: formatCurrency(overdueAmount, symbol),
          leaseExpirations: String(expiringCount),
          annualRevenue: formatCurrency(annualRevenue, symbol),
          totalUnits: String(totalUnits),
          vacantUnits: String(vacantUnits),
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
        <MetricCard label="Monthly Revenue" value={stats.monthlyRevenue} trend="Current Month" />
        <MetricCard label="Overdue Amount" value={stats.overdueAmount} trend="Unpaid & Partial" />
        <MetricCard label="Lease Expirations" value={stats.leaseExpirations} trend="Next 30 days" />
        <MetricCard label="Annual Revenue" value={stats.annualRevenue} trend="Year to Date" />
        <MetricCard label="Units" value={stats.totalUnits} sub={`${stats.vacantUnits} vacant`} />
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
          <Link to="/leases" className="property-banner glass p-8 rounded-3xl relative overflow-hidden block" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined mb-4" style={{ fontSize: '2.5rem' }}>description</span>
            <h3 className="font-bold">Leases</h3>
            <p className="opacity-70">Manage active leases</p>
          </Link>
        </div>
      </section>
    </>
  );
};

export default Lobby;
