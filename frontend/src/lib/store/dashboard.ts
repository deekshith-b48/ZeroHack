/**
 * Dashboard store using Zustand
 * Manages dashboard data and real-time updates
 */

import { create } from 'zustand';
import { apiClient, DashboardStats, ThreatHeatmapData } from '../api/client';

export interface DashboardState {
  // State
  stats: DashboardStats | null;
  threatHeatmapData: ThreatHeatmapData[];
  recentActivity: any[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Actions
  fetchStats: () => Promise<void>;
  fetchThreatHeatmap: (days?: number) => Promise<void>;
  fetchRecentActivity: (limit?: number) => Promise<void>;
  refreshAll: () => Promise<void>;
  clearError: () => void;
  updateStats: (stats: DashboardStats) => void;
  addActivity: (activity: any) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  stats: null,
  threatHeatmapData: [],
  recentActivity: [],
  isLoading: false,
  error: null,
  lastUpdated: null,

  // Actions
  fetchStats: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.getDashboardStats();
      
      if (response.data) {
        set({
          stats: response.data,
          isLoading: false,
          lastUpdated: new Date().toISOString()
        });
      } else if (response.error) {
        set({
          error: response.error,
          isLoading: false
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats',
        isLoading: false
      });
    }
  },

  fetchThreatHeatmap: async (days: number = 7) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.getThreatHeatmapData(days);
      
      if (response.data) {
        set({
          threatHeatmapData: response.data,
          isLoading: false
        });
      } else if (response.error) {
        set({
          error: response.error,
          isLoading: false
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch threat heatmap data',
        isLoading: false
      });
    }
  },

  fetchRecentActivity: async (limit: number = 20) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.getRecentActivity(limit);
      
      if (response.data) {
        set({
          recentActivity: response.data,
          isLoading: false
        });
      } else if (response.error) {
        set({
          error: response.error,
          isLoading: false
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch recent activity',
        isLoading: false
      });
    }
  },

  refreshAll: async () => {
    const { fetchStats, fetchThreatHeatmap, fetchRecentActivity } = get();
    await Promise.all([
      fetchStats(),
      fetchThreatHeatmap(),
      fetchRecentActivity()
    ]);
  },

  clearError: () => {
    set({ error: null });
  },

  updateStats: (stats: DashboardStats) => {
    set({
      stats,
      lastUpdated: new Date().toISOString()
    });
  },

  addActivity: (activity: any) => {
    set(state => ({
      recentActivity: [activity, ...state.recentActivity].slice(0, 20)
    }));
  }
}));
