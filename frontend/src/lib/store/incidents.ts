/**
 * Incidents store using Zustand
 * Manages incident data and real-time updates
 */

import { create } from 'zustand';
import { apiClient, Incident } from '../api/client';

export interface IncidentFilters {
  status?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}

export interface IncidentsState {
  // State
  incidents: Incident[];
  selectedIncident: Incident | null;
  filters: IncidentFilters;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;

  // Actions
  fetchIncidents: (filters?: IncidentFilters) => Promise<void>;
  fetchIncident: (id: string) => Promise<void>;
  createIncident: (incident: Partial<Incident>) => Promise<void>;
  updateIncident: (id: string, updates: Partial<Incident>) => Promise<void>;
  setFilters: (filters: IncidentFilters) => void;
  clearError: () => void;
  addIncident: (incident: Incident) => void;
  updateIncidentInList: (id: string, updates: Partial<Incident>) => void;
  removeIncident: (id: string) => void;
}

export const useIncidentsStore = create<IncidentsState>((set, get) => ({
  // Initial state
  incidents: [],
  selectedIncident: null,
  filters: {
    limit: 50,
    offset: 0
  },
  isLoading: false,
  error: null,
  totalCount: 0,
  hasMore: true,

  // Actions
  fetchIncidents: async (filters?: IncidentFilters) => {
    const currentFilters = filters || get().filters;
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.getIncidents(currentFilters);
      
      if (response.data) {
        set({
          incidents: response.data,
          isLoading: false,
          totalCount: response.data.length,
          hasMore: response.data.length === (currentFilters.limit || 50)
        });
      } else if (response.error) {
        set({
          error: response.error,
          isLoading: false
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch incidents',
        isLoading: false
      });
    }
  },

  fetchIncident: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.getIncident(id);
      
      if (response.data) {
        set({
          selectedIncident: response.data,
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
        error: error instanceof Error ? error.message : 'Failed to fetch incident',
        isLoading: false
      });
    }
  },

  createIncident: async (incidentData: Partial<Incident>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.createIncident({
        description: incidentData.description || '',
        source_ip: incidentData.source_ip,
        attack_type: incidentData.attack_type,
        evidence_files: []
      });

      if (response.data) {
        // Add to incidents list
        set(state => ({
          incidents: [response.data!, ...state.incidents],
          isLoading: false,
          totalCount: state.totalCount + 1
        }));
      } else if (response.error) {
        set({
          error: response.error,
          isLoading: false
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create incident',
        isLoading: false
      });
    }
  },

  updateIncident: async (id: string, updates: Partial<Incident>) => {
    set({ isLoading: true, error: null });

    try {
      // Optimistic update
      set(state => ({
        incidents: state.incidents.map(incident =>
          incident.id === id ? { ...incident, ...updates } : incident
        ),
        selectedIncident: state.selectedIncident?.id === id 
          ? { ...state.selectedIncident, ...updates }
          : state.selectedIncident
      }));

      // TODO: Implement actual API call when backend supports it
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update incident',
        isLoading: false
      });
    }
  },

  setFilters: (filters: IncidentFilters) => {
    set({ filters });
    get().fetchIncidents(filters);
  },

  clearError: () => {
    set({ error: null });
  },

  addIncident: (incident: Incident) => {
    set(state => ({
      incidents: [incident, ...state.incidents],
      totalCount: state.totalCount + 1
    }));
  },

  updateIncidentInList: (id: string, updates: Partial<Incident>) => {
    set(state => ({
      incidents: state.incidents.map(incident =>
        incident.id === id ? { ...incident, ...updates } : incident
      ),
      selectedIncident: state.selectedIncident?.id === id 
        ? { ...state.selectedIncident, ...updates }
        : state.selectedIncident
    }));
  },

  removeIncident: (id: string) => {
    set(state => ({
      incidents: state.incidents.filter(incident => incident.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
      selectedIncident: state.selectedIncident?.id === id ? null : state.selectedIncident
    }));
  }
}));
