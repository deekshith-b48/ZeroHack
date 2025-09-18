/**
 * Authentication store using Zustand
 * Manages user authentication state and tokens
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '../api/client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  organization?: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string, totpCode?: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiClient.login({
            email,
            password,
            totp_code: totpCode
          });

          if (response.data) {
            // Get user info
            const userResponse = await apiClient.getCurrentUser();
            if (userResponse.data) {
              set({
                user: userResponse.data,
                isAuthenticated: true,
                isLoading: false,
                error: null
              });
            }
          } else if (response.error) {
            set({
              error: response.error,
              isLoading: false
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false
          });
        }
      },

      logout: () => {
        apiClient.logout();
        set({
          user: null,
          isAuthenticated: false,
          error: null
        });
      },

      refreshToken: async () => {
        try {
          // This would call the refresh endpoint directly
          const refreshToken = localStorage.getItem('refresh_token');
          if (!refreshToken) {
            get().logout();
            return;
          }

          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008'}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            apiClient.saveToken(data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            set({ error: null });
          } else {
            get().logout();
          }
        } catch (error) {
          get().logout();
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setUser: (user: User) => {
        set({
          user,
          isAuthenticated: true,
          error: null
        });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        
        try {
          const response = await apiClient.getCurrentUser();
          if (response.data) {
            set({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null
            });
          }
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
