import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { AreaChart, Area, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useOwner } from '../context/OwnerContext';
import '../styles/Lobby.css';

const currencySymbols: { [key: string]: string } = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$'
};

const DataPulse: React.FC = () => (
  <span className="data-pulse"></span>
);

const formatCurrency = (amount: number, symbol: string): string => {
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}k`;
  return `${symbol}${amount.toFixed(0)}`;
};

const MetricCard: React.FC<{ label: string; value: string; trend?: string; sub?: string; to: string }> = ({ label, value, trend, sub, to }) => (
  <Link to={to} className="metric-card metric-card-link" style={{ textDecoration: 'none' }}>
    <div className="mc-eyebrow">{label}</div>
    <div className="mc-value">{value}</div>
    {sub && <div className="mc-sub">{sub}</div>}
    {trend && <div className="mc-trend">{trend}</div>}
    <span className="metric-card-arrow material-symbols-outlined">arrow_forward</span>
  </Link>
);

const Lobby: React.FC = () => {
  const { ownerId, isStaff, ownerLoading } = useOwner();
  const [stats, setStats] = useState({
    monthlyRevenue: '—',
    overdueAmount: '—',
    leaseExpirations: '—',
    annualRevenue: '—',
    totalUnits: 0,
    vacantUnits: 0,
    totalBeds: 0,
    vacantBeds: 0,
  });
  const [revenueChart, setRevenueChart] = useState<{ month: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ownerLoading) return; // still resolving — wait
    if (!ownerId) { setLoading(false); return; } // resolved but no user

    const fetchDashboardStats = async () => {
      try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
        const todayStr = today.toISOString().split('T')[0];
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);
        const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        const last6: { label: string; short: string }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          last6.push({
            label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
            short: d.toLocaleString('default', { month: 'short' }),
          });
        }

        // All 5 fetches in parallel — currency included
        const [ownerSnap, unitsSnap, bedsSnap, leasesSnap, paymentsSnap] = await Promise.all([
          getDoc(doc(db, 'owners', ownerId)),
          getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId))),
          getDocs(query(collection(db, 'beds'), where('owner_id', '==', ownerId))),
          getDocs(query(collection(db, 'leases'), where('owner_id', '==', ownerId))),
          getDocs(query(collection(db, 'payments'), where('owner_id', '==', ownerId))),
        ]);

        const currency = (ownerSnap.data() as { currency?: string })?.currency || 'USD';
        const symbol = currencySymbols[currency] || '$';

        const units = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as { id: string; status: string }[];
        const beds  = bedsSnap.docs.map(d => ({ id: d.id, ...d.data() }))  as { id: string; status: string }[];

        const totalUnits  = units.length;
        const vacantUnits = units.filter(u => u.status === 'Vacant').length;
        const totalBeds   = beds.length;
        const vacantBeds  = beds.filter(b => b.status === 'Vacant').length;

        const allLeases = leasesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as {
          id: string;
          status: string;
          end_date?: string;
        }[];

        const expiringCount = allLeases.filter(l =>
          l.status === 'Active' && l.end_date &&
          l.end_date >= todayStr && l.end_date <= thirtyDaysLaterStr
        ).length;

        let monthlyRevenue = 0;
        let annualRevenue  = 0;
        let overdueAmount  = 0;
        const revenueByMonth: Record<string, number> = {};
        last6.forEach(m => { revenueByMonth[m.label] = 0; });

        const payments = paymentsSnap.docs.map(d => d.data()) as {
          amount: number;
          status: string;
          month_for: string;
          payment_date: string;
        }[];

        payments.forEach(p => {
          const amount = Number(p.amount);
          if (p.status === 'Paid' && p.month_for === currentMonth) monthlyRevenue += amount;
          if (p.status === 'Paid' && p.payment_date >= yearStart && p.payment_date <= yearEnd) annualRevenue += amount;
          if (p.status === 'Pending' || p.status === 'Partial') overdueAmount += amount;
          if (p.status === 'Paid' && revenueByMonth[p.month_for] !== undefined) {
            revenueByMonth[p.month_for] += amount;
          }
        });

        setRevenueChart(last6.map(m => ({ month: m.short, revenue: revenueByMonth[m.label] || 0 })));
        setStats({
          monthlyRevenue: formatCurrency(monthlyRevenue, symbol),
          overdueAmount:  formatCurrency(overdueAmount, symbol),
          leaseExpirations: String(expiringCount),
          annualRevenue:  formatCurrency(annualRevenue, symbol),
          totalUnits,
          vacantUnits,
          totalBeds,
          vacantBeds,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [ownerId, ownerLoading]);

  const occupiedUnits = stats.totalUnits - stats.vacantUnits;
  const occupiedBeds  = stats.totalBeds  - stats.vacantBeds;

  const unitDonutData = stats.totalUnits > 0
    ? [{ name: 'Occupied', value: occupiedUnits }, { name: 'Vacant', value: stats.vacantUnits }]
    : [{ name: 'No data', value: 1 }];

  const bedDonutData = stats.totalBeds > 0
    ? [{ name: 'Occupied', value: occupiedBeds }, { name: 'Vacant', value: stats.vacantBeds }]
    : [{ name: 'No data', value: 1 }];

  return (
    <>
      <header className="lobby-header">
        <div>
          <p className="lobby-eyebrow">
            <DataPulse />
            {loading ? 'Updating metrics...' : 'Live Data Analytics'}
          </p>
          <h1 className="lobby-display-title">Operations Dashboard</h1>
          {isStaff && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', background: 'var(--surface-container-high)', borderRadius: '999px', padding: '0.2rem 0.7rem', marginTop: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>visibility</span>
              View Only
            </span>
          )}
        </div>
        {!isStaff && (
          <Link to="/properties/new" className="primary-button glass" style={{ textDecoration: 'none' }}>
            + New Property
          </Link>
        )}
      </header>

      <section className="lobby-metrics-grid">
        <Link to="/payments" className="lobby-hero-card" style={{ textDecoration: 'none' }}>
          <div>
            <span className="mc-eyebrow">Monthly Revenue</span>
            <div className="lobby-hero-value">{stats.monthlyRevenue}</div>
            <div className="mc-trend">Current Month</div>
          </div>
          <div className="lobby-sparkline">
            <ResponsiveContainer width="100%" height={72}>
              <AreaChart data={revenueChart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', fontSize: '0.75rem' }}
                  labelStyle={{ color: 'var(--on-surface-variant)' }}
                  itemStyle={{ color: 'var(--primary)' }}
                  formatter={(v: any) => [Number(v).toLocaleString(), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#revenueGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <span className="metric-card-arrow material-symbols-outlined">arrow_forward</span>
        </Link>

        <div className="lobby-sub-grid">
          <MetricCard label="Overdue Amount"    value={stats.overdueAmount}    trend="Unpaid"       to="/payments" />
          <MetricCard label="Lease Expirations" value={stats.leaseExpirations} trend="Next 30 days" to="/leases" />
        </div>
      </section>

      <section className="lobby-detail-strip">
        <MetricCard label="Annual Revenue" value={stats.annualRevenue} trend="Year to Date" to="/payments" />

        <Link to="/properties" className="metric-card metric-card-link lobby-units-card" style={{ textDecoration: 'none' }}>
          <div className="lobby-units-left">
            <div className="mc-eyebrow">Property Units</div>
            <div className="mc-value">{stats.totalUnits}</div>
            <div className="mc-sub">{stats.vacantUnits} vacant</div>
          </div>
          <div className="lobby-donut">
            <PieChart width={88} height={88}>
              <Pie data={unitDonutData} cx={40} cy={40} innerRadius={28} outerRadius={40} dataKey="value" strokeWidth={0}>
                <Cell fill="var(--primary)" opacity={0.9} />
                <Cell fill="var(--outline-variant)" opacity={0.5} />
              </Pie>
            </PieChart>
            <div className="lobby-donut-label">
              <span>{stats.totalUnits > 0 ? Math.round((occupiedUnits / stats.totalUnits) * 100) : 0}%</span>
              <span>occ.</span>
            </div>
          </div>
          <span className="metric-card-arrow material-symbols-outlined">arrow_forward</span>
        </Link>

        <Link to="/hostels" className="metric-card metric-card-link lobby-units-card" style={{ textDecoration: 'none' }}>
          <div className="lobby-units-left">
            <div className="mc-eyebrow">Hostel Beds</div>
            <div className="mc-value">{stats.totalBeds}</div>
            <div className="mc-sub">{stats.vacantBeds} vacant</div>
          </div>
          <div className="lobby-donut">
            <PieChart width={88} height={88}>
              <Pie data={bedDonutData} cx={40} cy={40} innerRadius={28} outerRadius={40} dataKey="value" strokeWidth={0}>
                <Cell fill="var(--primary)" opacity={0.9} />
                <Cell fill="var(--outline-variant)" opacity={0.5} />
              </Pie>
            </PieChart>
            <div className="lobby-donut-label">
              <span>{stats.totalBeds > 0 ? Math.round((occupiedBeds / stats.totalBeds) * 100) : 0}%</span>
              <span>occ.</span>
            </div>
          </div>
          <span className="metric-card-arrow material-symbols-outlined">arrow_forward</span>
        </Link>
      </section>
    </>
  );
};

export default Lobby;
