/**
 * Partner API Service
 * Handles authentication and API calls for partner dashboard
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://pocketcredit.in');

export interface PartnerLoginResponse {
  status: boolean;
  code: number;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
}

export interface PartnerStats {
  total_leads: number;
  fresh_leads: number;
  registered_users: number;
  active_users: number;
  loan_applications: number;
  disbursed_loans: number;
  payout_eligible_leads: number;
  total_payout_amount: number;
}

export interface PartnerLead {
  id: number;
  first_name: string;
  last_name: string;
  mobile_number: string;
  pan_number: string;
  dedupe_status: string;
  dedupe_code: number;
  utm_link: string;
  lead_shared_at: string;
  user_registered_at: string | null;
  loan_application_id: number | null;
  loan_status: string | null;
  disbursed_at: string | null;
  disbursal_amount: number | null;
  payout_eligible: number;
  payout_amount: number | null;
  payout_grade: string | null;
  payout_status: string | null;
  user_id: number | null;
  email: string | null;
  application_number: string | null;
  days_to_disbursal: number | null;
}

class PartnerApiService {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseURL = `${API_BASE_URL}/api/v1/partner`;
    // Load token from localStorage
    this.accessToken = localStorage.getItem('partner_access_token');
  }

  private getAuthHeader(): string {
    return this.accessToken ? `Bearer ${this.accessToken}` : '';
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    useBasicAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authentication
    if (useBasicAuth && data?.client_id && data?.client_secret) {
      const credentials = btoa(`${data.client_id}:${data.client_secret}`);
      headers['Authorization'] = `Basic ${credentials}`;
      // Remove credentials from body
      const { client_id, client_secret, ...bodyData } = data;
      data = bodyData;
    } else if (this.accessToken) {
      headers['Authorization'] = this.getAuthHeader();
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        // Clear tokens on auth failure
        this.accessToken = null;
        localStorage.removeItem('partner_access_token');
        localStorage.removeItem('partner_refresh_token');
        throw new Error(result.message || 'Authentication failed. Please login again.');
      }
      throw new Error(result.message || `Request failed: ${response.statusText}`);
    }

    return result as T;
  }

  /**
   * Login with client_id and client_secret
   */
  async login(clientId: string, clientSecret: string): Promise<PartnerLoginResponse> {
    const response = await this.request<PartnerLoginResponse>(
      'POST',
      '/login',
      { client_id: clientId, client_secret: clientSecret },
      true
    );

    if (response.status && response.data?.access_token) {
      this.accessToken = response.data.access_token;
      localStorage.setItem('partner_access_token', this.accessToken);
      localStorage.setItem('partner_refresh_token', response.data.refresh_token);
    }

    return response;
  }

  /**
   * Refresh access token
   */
  async refreshToken(clientId: string, clientSecret: string): Promise<PartnerLoginResponse> {
    const refreshToken = localStorage.getItem('partner_refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const url = `${this.baseURL}/refresh-token`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'refresh_token': refreshToken,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Token refresh failed');
    }

    if (result.status && result.data?.access_token) {
      this.accessToken = result.data.access_token;
      localStorage.setItem('partner_access_token', this.accessToken);
    }

    return result;
  }

  /**
   * Get partner statistics
   */
  async getStats(): Promise<{ status: boolean; code: number; message: string; data: PartnerStats }> {
    return this.request('GET', '/dashboard/stats');
  }

  /**
   * Get all leads
   */
  async getLeads(params?: {
    page?: number;
    limit?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    status: boolean;
    code: number;
    message: string;
    data: {
      leads: PartnerLead[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const queryString = queryParams.toString();
    return this.request('GET', `/dashboard/leads${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get lead details
   */
  async getLeadDetails(leadId: number): Promise<{
    status: boolean;
    code: number;
    message: string;
    data: PartnerLead;
  }> {
    return this.request('GET', `/dashboard/lead/${leadId}`);
  }

  /**
   * Logout
   */
  logout(): void {
    this.accessToken = null;
    localStorage.removeItem('partner_access_token');
    localStorage.removeItem('partner_refresh_token');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

export const partnerApiService = new PartnerApiService();
