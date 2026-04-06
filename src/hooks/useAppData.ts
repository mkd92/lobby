import { useDashboard } from './useDashboard';

/**
 * useAppData - Centralized Hook Architecture (MOMA Pattern)
 * 
 * Orchestrates data fetching, caches entities, and derives complex KPIs
 * on-the-fly for the application views.
 */
export const useAppData = () => {
  // 1. Orchestrate Core Data Subscriptions/Queries
  const { 
    data: dashboardData, 
    isLoading: isDashboardLoading, 
    refetch: refetchDashboard 
  } = useDashboard();
  
  // 2. Derive Intelligence
  const stats = dashboardData?.stats;
  const revenueChart = dashboardData?.revenueChart;
  
  // 3. Centralized State & Mutations Facade
  const isLoading = isDashboardLoading;

  const refreshAll = () => {
    refetchDashboard();
  };

  return {
    // Derived KPIs
    stats,
    revenueChart,
    
    // Meta state
    isLoading,
    refreshAll,
  };
};
