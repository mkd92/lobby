import React from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useOwner } from "../context/OwnerContext";
import { useDashboard } from "../hooks/useDashboard";
import { LoadingScreen } from "./layout/LoadingScreen";
import StaffDashboard from "./StaffDashboard";
import "../styles/Lobby.css";

const Lobby: React.FC = () => {
  const { userRole } = useOwner();
  const isStaff = userRole !== 'owner';
  const { data, isLoading } = useDashboard();

  if (isStaff) return <StaffDashboard />;

  if (isLoading && !data) {
    return <LoadingScreen message="Accessing Executive Dashboard" />;
  }

  const stats = data?.stats ?? {
    monthlyRevenue: "0",
    activeLeaseRent: "0",
    overdueAmount: "0",
    leaseExpirations: "0",
    annualRevenue: "0",
    totalBeds: 0,
    vacantBeds: 0,
  };
  const revenueChart = data?.revenueChart ?? [];

  const occupancyRate =
    stats.totalBeds > 0
      ? Math.round(((stats.totalBeds - stats.vacantBeds) / stats.totalBeds) * 1000) / 10
      : 0;

  return (
    <div className="view-container page-fade-in">
      {/* Executive Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="view-eyebrow">Executive Intelligence</p>
          <h1 className="view-title text-4xl md:text-6xl">
            Performance Overview
          </h1>
        </div>
        {!isStaff && (
          <div className="flex gap-4">
            <Link
              to="/hostels/new"
              className="primary-button"
              style={{ textDecoration: "none" }}
            >
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>add</span>
              New Facility
            </Link>
          </div>
        )}
      </header>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {/* Occupancy Card */}
        <div className="modern-card relative overflow-hidden group">
          <div className="flex justify-between items-start mb-10">
            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--outline-variant)' }}>
              <span className="material-symbols-outlined text-on-surface opacity-60">door_front</span>
            </div>
            <span className="badge-modern badge-success">Live</span>
          </div>
          <h3 className="view-eyebrow text-[0.6rem] mb-2">Portfolio Occupancy</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-on-surface font-display font-black text-5xl">
              {occupancyRate}
            </span>
            <span className="text-on-surface-variant font-display font-bold text-2xl">%</span>
          </div>
        </div>

        {/* Contracted Revenue */}
        <div className="modern-card relative overflow-hidden group">
          <div className="flex justify-between items-start mb-10">
            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--outline-variant)' }}>
              <span className="material-symbols-outlined text-on-surface opacity-60">contract</span>
            </div>
            <span className="badge-modern" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--on-surface-variant)' }}>Target</span>
          </div>
          <h3 className="view-eyebrow text-[0.6rem] mb-2">Contracted Yield</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-on-surface font-display font-black text-5xl">
              {stats.activeLeaseRent}
            </span>
            <span className="text-on-surface-variant font-display font-bold text-xl">/mo</span>
          </div>
        </div>

        {/* Bed Inventory */}
        <div className="modern-card relative overflow-hidden group">
          <div className="flex justify-between items-start mb-10">
            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--outline-variant)' }}>
              <span className="material-symbols-outlined text-on-surface opacity-60">hotel</span>
            </div>
          </div>
          <h3 className="view-eyebrow text-[0.6rem] mb-2">Asset Inventory</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-on-surface font-display font-black text-5xl">
              {stats.totalBeds}
            </span>
            <span className="text-on-surface-variant font-display font-bold text-xl ml-2">Units</span>
          </div>
          {stats.vacantBeds > 0 && (
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.75rem' }}>
              {stats.vacantBeds} units available for lease
            </p>
          )}
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-16">
        {/* Revenue Trajectory Chart */}
        <div className="lg:col-span-3 modern-card" style={{ padding: '2.5rem' }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
            <h2 className="text-on-surface font-display font-bold text-xl tracking-tight">
              Realized Revenue Trajectory
            </h2>
            <div className="flex gap-6 items-center">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--on-surface)' }}></span>
                <span className="view-eyebrow text-[0.55rem] mb-0">Realized</span>
              </div>
            </div>
          </div>

          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--on-surface)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--on-surface)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--on-surface-variant)', fontSize: 10, fontWeight: 700 }}
                  dy={15}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--outline-variant)', strokeWidth: 1 }}
                  contentStyle={{
                    backgroundColor: "var(--surface-container-highest)",
                    border: "1px solid var(--outline-variant)",
                    borderRadius: "1rem",
                    boxShadow: "var(--shadow-elevated)",
                    color: "var(--on-surface)",
                    padding: '1rem',
                  }}
                  itemStyle={{ color: "var(--on-surface)", fontWeight: 800, fontSize: '1rem' }}
                  labelStyle={{ color: "var(--on-surface-variant)", fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--on-surface)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actionable Insights */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <Link to="/payments" className="modern-card group" style={{ textDecoration: "none" }}>
            <p className="view-eyebrow text-[0.6rem] mb-2 opacity-60">Arrears Management</p>
            <h4 className="text-on-surface font-bold mb-1">Outstanding Balance</h4>
            <div className="flex items-baseline gap-3">
              <span className="text-on-surface font-display font-black text-4xl">
                {stats.overdueAmount}
              </span>
              <span className="badge-modern badge-error">Action Required</span>
            </div>
          </Link>

          <Link to="/leases" className="modern-card group" style={{ textDecoration: "none" }}>
            <p className="view-eyebrow text-[0.6rem] mb-2 opacity-60">Retention Cycle</p>
            <h4 className="text-on-surface font-bold mb-1">Upcoming Expirations</h4>
            <div className="flex items-baseline gap-3">
              <span className="text-on-surface font-display font-black text-4xl">
                {stats.leaseExpirations}
              </span>
              <span className="text-on-surface-variant text-sm font-bold">next 30 days</span>
            </div>
          </Link>

          <div className="mt-auto modern-card" style={{ background: 'linear-gradient(145deg, var(--surface-container-low), var(--surface-container-high))' }}>
            <h3 className="view-eyebrow text-[0.6rem] mb-4">Portfolio Valuation</h3>
            <span className="text-on-surface font-display font-black text-3xl mb-1">
              {stats.annualRevenue}
            </span>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>
              Trailing 12 Months Realized
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
