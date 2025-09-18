'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useOptimizedFetch } from '../hooks/useOptimizedFetch';

interface DashboardStats {
  processes_monitored: number;
  threats_detected_today: number;
  files_scanned: number;
  total_incidents: number;
  high_severity_incidents: number;
  ai_model_accuracy: number;
  false_positive_rate: number;
  gpu_utilization: number;
  inference_time: number;
  last_updated: string;
}

interface OptimizedDashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number;
  refreshStats: () => void;
  clearCache: () => void;
}

export const useOptimizedDashboardStore = create<OptimizedDashboardState>()(
  subscribeWithSelector((set, get) => ({
    stats: null,
    isLoading: false,
    error: null,
    lastFetchTime: 0,

    refreshStats: () => {
      const now = Date.now();
      const { lastFetchTime } = get();
      
      // Throttle requests to prevent excessive API calls
      if (now - lastFetchTime < 5000) { // 5 second throttle
        return;
      }

      set({ isLoading: true, error: null, lastFetchTime: now });

      // Simulate API call with caching
      const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008'}/api/dashboard/stats`;
      
      fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        set({ 
          stats: data, 
          isLoading: false, 
          error: null 
        });
      })
      .catch(error => {
        // Fallback to mock data if API fails
        const mockStats: DashboardStats = {
          processes_monitored: 45,
          threats_detected_today: 3,
          files_scanned: 1250,
          total_incidents: 12,
          high_severity_incidents: 2,
          ai_model_accuracy: 98.7,
          false_positive_rate: 0.08,
          gpu_utilization: 62,
          inference_time: 32,
          last_updated: new Date().toISOString()
        };
        
        set({ 
          stats: mockStats, 
          isLoading: false, 
          error: error.message 
        });
      });
    },

    clearCache: () => {
      set({ stats: null, lastFetchTime: 0 });
    }
  }))
);

// Auto-refresh every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    useOptimizedDashboardStore.getState().refreshStats();
  }, 30000);
}
