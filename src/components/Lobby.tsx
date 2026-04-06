import React from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { useOwner } from "../context/OwnerContext";
import { useDashboard } from "../hooks/useDashboard";
import { LoadingScreen } from "./layout/LoadingScreen";
import StaffDashboard from "./StaffDashboard";
import "../styles/Lobby.css";

const Lobby: React.FC = () => {
  const { isStaff } = useOwner();
  const { data, isLoading } = useDashboard();

  // Staff get a focused operational view instead of the owner analytics dashboard
  if (isStaff) return <StaffDashboard />;

  if (isLoading && !data) {
    return <LoadingScreen message="Accessing Secure Vault" />;
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
      {/* Editorial Header */}
      <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="view-eyebrow">Portfolio Intelligence</p>
          <h1 className="text-on-surface font-headline font-bold text-4xl md:text-6xl tracking-tight leading-tight">
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
              <span
                className="material-symbols-outlined mr-2"
                style={{ verticalAlign: "middle", fontSize: "1.25rem" }}
              >
                add
              </span>
              New Hostel
            </Link>
          </div>
        )}
      </header>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {/* Occupancy Card */}
        <div className="glass-panel p-10 rounded-[32px] relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="flex justify-between items-start mb-8">
            <span className="material-symbols-outlined text-primary-container p-4 bg-primary-container/10 rounded-2xl">
              door_front
            </span>
            <span className="badge-modern bg-primary-container/20 text-primary-container font-bold">
              +2.4%
            </span>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mb-2">
            Portfolio Occupancy
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-primary font-display font-extrabold text-5xl">
              {occupancyRate}
            </span>
            <span className="text-on-surface-variant font-display font-bold text-2xl">
              %
            </span>
          </div>
        </div>

        {/* Contracted Revenue */}
        <div className="glass-panel p-10 rounded-[32px] relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="flex justify-between items-start mb-8">
            <span className="material-symbols-outlined text-secondary p-4 bg-secondary/10 rounded-2xl">
              contract
            </span>
            <span className="badge-modern bg-secondary/20 text-secondary font-bold">
              Target
            </span>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mb-2">
            Contracted Yield
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-primary font-display font-extrabold text-5xl">
              {stats.activeLeaseRent}
            </span>
            <span className="text-on-surface-variant font-display font-bold text-xl">
              /mo
            </span>
          </div>
        </div>

        {/* Bed Inventory */}
        <div className="glass-panel p-10 rounded-[32px] relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="flex justify-between items-start mb-8">
            <span className="material-symbols-outlined text-primary p-4 bg-primary/10 rounded-2xl">
              hotel
            </span>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-widest mb-2">
            Bed Inventory
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-primary font-display font-extrabold text-5xl">
              {stats.totalBeds}
            </span>
            <span className="text-on-surface-variant font-display font-bold text-xl ml-2">
              Beds
            </span>
          </div>
          {stats.vacantBeds > 0 && (
            <p className="text-on-surface-variant text-xs font-bold opacity-40 mt-2">
              {stats.vacantBeds} vacant
            </p>
          )}
        </div>
      </div>

      {/* Primary Data Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 mb-16">
        {/* Revenue Trajectory Chart */}
        <div className="lg:col-span-3 glass-panel p-10 rounded-[40px]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
            <h2 className="text-on-surface font-display font-bold text-2xl">
              Revenue Trajectory
            </h2>
            <div className="flex gap-4 md:gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">
                  Realized
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-outline-variant"></span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">
                  Target
                </span>
              </div>
            </div>
          </div>

          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChart}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--outline-variant)",
                    borderRadius: "16px",
                    backdropFilter: "blur(12px)",
                    boxShadow: "var(--shadow-elevated)",
                    color: "var(--on-surface)",
                  }}
                  itemStyle={{ color: "var(--primary)", fontWeight: 800 }}
                  labelStyle={{ color: "var(--on-surface-variant)", fontWeight: 700, marginBottom: '4px' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary KPIs */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <Link
            to="/payments"
            className="modern-card group"
            style={{
              textDecoration: "none",
            }}
          >
            <p className="view-eyebrow text-[0.6rem] mb-2 opacity-60">
              Arrears Management
            </p>
            <h4 className="text-on-surface font-bold mb-1">
              Outstanding Balance
            </h4>
            <div className="flex items-baseline gap-3">
              <span className="text-primary font-display font-black text-4xl">
                {stats.overdueAmount}
              </span>
              <span
                className="badge-modern bg-error/10 text-error font-bold"
                style={{ fontSize: "0.55rem" }}
              >
                Attention Req.
              </span>
            </div>
          </Link>

          <Link
            to="/leases"
            className="modern-card group"
            style={{
              textDecoration: "none",
            }}
          >
            <p className="view-eyebrow text-[0.6rem] mb-2 opacity-60">
              Contract Cycle
            </p>
            <h4 className="text-on-surface font-bold mb-1">
              Expiring Leases
            </h4>
            <div className="flex items-baseline gap-3">
              <span className="text-primary font-display font-black text-4xl">
                {stats.leaseExpirations}
              </span>
              <span className="text-on-surface-variant text-sm font-bold">
                next 30 days
              </span>
            </div>
          </Link>

          <div className="mt-auto glass-panel p-8 rounded-[32px] bg-secondary/5 border border-outline-variant">
            <h3 className="text-secondary text-xs font-bold uppercase tracking-widest mb-4">
              Portfolio Valuation
            </h3>
            <span className="text-on-surface font-display font-extrabold text-3xl mb-1">
              {stats.annualRevenue}
            </span>
            <p className="text-on-surface-variant text-[10px] font-bold opacity-60">
              Trailing 12 Months Realized
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
