import { useDashboard } from './useDashboard';
import { useProperties } from './useProperties';

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
  
  const { 
    properties, 
    isLoading: isPropertiesLoading, 
    saveProperty, 
    removeProperty,
    checkOccupiedUnits
  } = useProperties();

  // 2. Derive Intelligence
  const stats = dashboardData?.stats;
  const revenueChart = dashboardData?.revenueChart;
  
  // Example derived KPI: Properties with High Vacancy (mock logic based on available data)
  const totalAssets = properties.length;

  // 3. Centralized State & Mutations Facade
  const isLoading = isDashboardLoading || isPropertiesLoading;

  const refreshAll = () => {
    refetchDashboard();
    // other invalidations can be triggered here
  };

  return {
    // Derived KPIs
    stats,
    revenueChart,
    totalAssets,
    
    // Core Entities
    properties,
    
    // Standard Mutation Callbacks
    mutations: {
      saveProperty,
      removeProperty,
      checkOccupiedUnits,
    },
    
    // Meta state
    isLoading,
    refreshAll,
  };
};
