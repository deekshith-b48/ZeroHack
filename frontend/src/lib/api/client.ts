/**
 * ZeroHack API Client
 * Centralized API client for backend communication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  totp_code?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Incident {
  id: string;
  description: string;
  source_ip?: string;
  attack_type: string;
  severity: string;
  status: string;
  confidence_score: number;
  blockchain_tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_incidents: number;
  active_incidents: number;
  high_severity_incidents: number;
  threats_detected_today: number;
  ai_models_active: number;
  blockchain_transactions: number;
  system_health: string;
  files_scanned: number;
  quarantined_items: number;
  is_learning_mode: boolean;
  automatic_containment: boolean;
  blockchain_logging: boolean;
  // Real system metrics
  cpu_usage: number;
  memory_usage: number;
  memory_available: number;
  disk_usage: number;
  disk_free: number;
  processes_monitored: number;
  network_bytes_sent: number;
  network_bytes_recv: number;
  timestamp: string;
  // AI metrics
  model_accuracy: number;
  false_positive_rate: number;
  gpu_utilization: number;
  inference_time: number;
  onnx_runtime: string;
  gpu_acceleration: string;
  batch_size: number;
  codebert_processing: number;
  scapy_extraction: number;
  opencv_steganalysis: number;
  shap_explainability: number;
}

export interface ThreatHeatmapData {
  latitude: number;
  longitude: number;
  threat_count: number;
  severity: string;
  timestamp: string;
}

export interface AnalysisRequest {
  text?: string;
  image_data?: string;
  traffic_data?: any[];
  analysis_type?: string;
}

export interface AnalysisResponse {
  threat_detected: boolean;
  threat_type: string;
  confidence: number;
  severity: string;
  explanation: string;
  model_details: Record<string, any>;
  processing_time: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  public saveToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  private clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry request with new token
          headers.Authorization = `Bearer ${this.token}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          return await this.handleResponse<T>(retryResponse);
        } else {
          this.clearToken();
          throw new Error('Authentication failed');
        }
      }

      return await this.handleResponse<T>(response);
    } catch (error) {
      console.error('API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { data };
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveToken(data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data) {
      this.saveToken(response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/api/auth/logout', {
      method: 'POST',
    });
    this.clearToken();
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.request('/api/auth/me');
  }

  // Incident methods
  async getIncidents(params?: {
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Incident[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/api/incidents?${queryString}` : '/api/incidents';
    
    return this.request<Incident[]>(endpoint);
  }

  async getIncident(id: string): Promise<ApiResponse<Incident>> {
    return this.request<Incident>(`/api/incidents/${id}`);
  }

  async createIncident(incident: {
    description: string;
    source_ip?: string;
    attack_type?: string;
    evidence_files?: string[];
  }): Promise<ApiResponse<Incident>> {
    return this.request<Incident>('/api/incidents', {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  }

  // Dashboard methods
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.request<DashboardStats>('/api/dashboard/stats');
  }

  async getThreatHeatmapData(days: number = 7): Promise<ApiResponse<ThreatHeatmapData[]>> {
    return this.request<ThreatHeatmapData[]>(`/api/dashboard/threat-heatmap?days=${days}`);
  }

  async getRecentActivity(limit: number = 20): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/api/dashboard/recent-activity?limit=${limit}`);
  }

  // AI Analysis methods
  async analyzeText(text: string, analysisType: string = 'comprehensive'): Promise<ApiResponse<AnalysisResponse>> {
    return this.request<AnalysisResponse>('/api/ai/analyze/text', {
      method: 'POST',
      body: JSON.stringify({ text, analysis_type: analysisType }),
    });
  }

  async analyzeImage(imageData: string, analysisType: string = 'steganography'): Promise<ApiResponse<AnalysisResponse>> {
    return this.request<AnalysisResponse>('/api/ai/analyze/image', {
      method: 'POST',
      body: JSON.stringify({ image_data: imageData, analysis_type: analysisType }),
    });
  }

  async analyzeNetworkTraffic(trafficData: any[], sessionId?: string): Promise<ApiResponse<AnalysisResponse>> {
    return this.request<AnalysisResponse>('/api/ai/analyze/network', {
      method: 'POST',
      body: JSON.stringify({ traffic_data: trafficData, session_id: sessionId }),
    });
  }

  async getAIPipelineStatus(): Promise<ApiResponse<any>> {
    return this.request('/api/dashboard/ai-pipeline-status');
  }

  // Blockchain methods
  async getBlockchainStatus(): Promise<ApiResponse<any>> {
    return this.request('/api/blockchain/status');
  }

  async getEvidenceChain(incidentId: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/api/blockchain/evidence/${incidentId}`);
  }

  // Notification methods
  async getNotifications(params?: {
    limit?: number;
    unread_only?: boolean;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/api/notifications?${queryString}` : '/api/notifications';
    
    return this.request<any[]>(endpoint);
  }

  async markNotificationRead(notificationId: string): Promise<ApiResponse> {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  // Real-time system data
  async getRealTimeMetrics(): Promise<ApiResponse<any>> {
    return this.request('/api/system/real-time');
  }

  async getProcesses(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/api/processes');
  }

  async getNetworkPackets(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/api/network/packets');
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request('/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
