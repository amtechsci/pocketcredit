// API Service for Pocket Credit Platform
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types for API responses
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message: string;
  data?: T;
}

export interface User {
  id: number;
  phone: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  phone_verified: boolean;
  email_verified?: boolean;
  kyc_completed?: boolean;
  profile_completion_step: number;
  profile_completed: boolean;
  status: string;
  created_at: string;
  last_login_at?: string;
}

export interface LoginResponse {
  user: User;
  requires_profile_completion: boolean;
  session_created: boolean;
}

export interface SendOTPResponse {
  mobile: string;
  expiresIn: number;
}

export interface LoanApplication {
  id: number;
  application_number: string;
  loan_amount: number;
  loan_purpose: string;
  tenure_months: number;
  interest_rate?: number;
  emi_amount?: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
  rejection_reason?: string;
  approved_at?: string;
  disbursed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LoanApplicationStats {
  total_applications: number;
  submitted_count: number;
  under_review_count: number;
  approved_count: number;
  rejected_count: number;
  disbursed_count: number;
  total_approved_amount: number;
}

// API Service Class
class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3002/api',
      timeout: 30000, // Increased timeout to 30 seconds
      withCredentials: true, // Important: Send cookies for session management
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add JWT token to requests
    this.api.interceptors.request.use(
      (config: any) => {
        const token = localStorage.getItem('pocket_user_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Request interceptor for logging (reduced for production)
    this.api.interceptors.request.use(
      (config: any) => {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error: any) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`API Response: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      (error: any) => {
        console.error('API Response Error:', error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response?.status === 401) {
          // Session expired or invalid
          console.log('Session expired, redirecting to login');
          // Don't automatically redirect here, let components handle it
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Generic API request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.request({
        method,
        url: endpoint,
        data,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      
      throw new Error(error.message || 'API request failed');
    }
  }

  // Authentication APIs
  async sendOTP(mobile: string): Promise<ApiResponse<SendOTPResponse>> {
    return this.request<SendOTPResponse>('POST', '/auth/send-otp', { mobile });
  }

  async verifyOTP(mobile: string, otp: string): Promise<ApiResponse<LoginResponse & { token?: string }>> {
    const response = await this.request<LoginResponse & { token?: string }>('POST', '/auth/verify-otp', { mobile, otp });
    
    // Store JWT token if provided
    if (response.status === 'success' && response.data?.token) {
      localStorage.setItem('pocket_user_token', response.data.token);
    }
    
    return response;
  }

  async getUserProfile(): Promise<ApiResponse<{ user: User }>> {
    return this.request<{ user: User }>('GET', '/auth/profile');
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('POST', '/auth/logout');
    
    // Clear JWT token from localStorage
    localStorage.removeItem('pocket_user_token');
    
    return response;
  }

  // Profile Management APIs
  async updateBasicProfile(profileData: {
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string;
    gender?: string;
    marital_status?: string;
  }): Promise<ApiResponse<{ user: User; next_step: string; step_completed: string }>> {
    return this.request('PUT', '/user/profile/basic', profileData);
  }

  async updateAdditionalProfile(profileData: {
    // Current Address
    current_address_line1: string;
    current_address_line2?: string;
    current_city: string;
    current_state: string;
    current_pincode: string;
    current_country?: string;
    
    // Permanent Address
    permanent_address_line1: string;
    permanent_address_line2?: string;
    permanent_city: string;
    permanent_state: string;
    permanent_pincode: string;
    permanent_country?: string;
    
    
    // PAN number
    pan_number: string;
  }): Promise<ApiResponse<{ 
    user: User; 
    addresses: {
      current: any;
      permanent: any;
    };
    verification: {
      pan: any;
    };
    profile_completed: boolean; 
    step_completed: string 
  }>> {
    return this.request('PUT', '/user/profile/additional', profileData);
  }

  async updateEmploymentDetails(employmentData: {
    monthly_income: string;
    employment_type: string;
    company_name: string;
    designation: string;
    salary_date: string;
  }): Promise<ApiResponse<{ user: User; next_step: string; step_completed: string }>> {
    return this.request('POST', '/employment-details', employmentData);
  }

  async getEmploymentDetails(): Promise<ApiResponse<{
    monthly_income: number;
    employment_type: string;
    company_name: string;
    designation: string;
    salary_date: number;
  }>> {
    return this.request('GET', '/employment-details');
  }

  async createLoanApplication(applicationData: {
    desired_amount: number;
    purpose: string;
  }): Promise<ApiResponse<{
    application_id: number;
    application_number: string;
    status: string;
  }>> {
    return this.request('POST', '/loans/apply', applicationData);
  }

  async saveBankDetails(bankData: {
    application_id: number;
    account_number: string;
    ifsc_code: string;
  }): Promise<ApiResponse<{
    bank_details_id: number;
    status: string;
  }>> {
    return this.request('POST', '/bank-details', bankData);
  }

  async getBankDetails(applicationId: string): Promise<ApiResponse<{
    id: number;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    account_holder_name: string;
    account_type: string;
    is_primary: boolean;
    is_verified: boolean;
    created_at: string;
  }>> {
    return this.request('GET', `/bank-details/${applicationId}`);
  }

  async getUserBankDetails(userId: number): Promise<ApiResponse<Array<{
    id: number;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    account_holder_name: string;
    account_type: string;
    is_primary: boolean;
    is_verified: boolean;
    created_at: string;
    application_number?: string;
    loan_amount?: number;
    loan_purpose?: string;
  }>>> {
    return this.request('GET', `/bank-details/user/${userId}`);
  }

  async chooseBankDetails(data: {
    application_id: number;
    bank_details_id: number;
  }): Promise<ApiResponse<{
    bank_details_id: number;
    status: string;
  }>> {
    return this.request('POST', '/bank-details/choose', data);
  }

  async getLoanApplication(applicationId: string): Promise<ApiResponse<{
    id: number;
    application_number: string;
    loan_amount: number;
    loan_purpose: string;
    status: string;
    current_step: string;
    created_at: string;
  }>> {
    return this.request('GET', `/loans/${applicationId}`);
  }

  async saveReferenceDetails(referenceData: {
    application_id: number;
    references: Array<{
      name: string;
      phone: string;
      relation: string;
    }>;
  }): Promise<ApiResponse<{
    references_count: number;
    status: string;
  }>> {
    return this.request('POST', '/loan-references', referenceData);
  }

  async getReferenceDetails(applicationId: string): Promise<ApiResponse<Array<{
    id: number;
    user_id: number;
    loan_application_id: number;
    name: string;
    phone: string;
    relation: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>>> {
    return this.request('GET', `/loan-references/${applicationId}`);
  }

  async getPendingLoanApplications(): Promise<ApiResponse<{
    applications: Array<{
      id: number;
      application_number: string;
      loan_amount: number;
      loan_purpose: string;
      status: string;
      current_step: string;
      created_at: string;
    }>;
  }>> {
    return this.request('GET', '/loans/pending');
  }

  async getProfileStatus(): Promise<ApiResponse<{ user: User; profile_status: any }>> {
    return this.request('GET', '/user/profile/status');
  }

  // Loan Application APIs
  async applyForLoan(loanData: {
    loan_amount: number;
    tenure_months: number;
    loan_purpose: string;
    interest_rate?: number;
    emi_amount?: number;
  }): Promise<ApiResponse<{ application: LoanApplication; next_steps: string[] }>> {
    return this.request('POST', '/loan-applications/apply', loanData);
  }

  async getLoanApplications(): Promise<ApiResponse<{ 
    applications: LoanApplication[]; 
    statistics: LoanApplicationStats; 
    total_applications: number; 
  }>> {
    return this.request('GET', '/loan-applications');
  }

  async getLoanApplicationById(applicationId: number): Promise<ApiResponse<{ application: LoanApplication }>> {
    return this.request('GET', `/loan-applications/${applicationId}`);
  }

  async getLoanApplicationStats(): Promise<ApiResponse<{ statistics: LoanApplicationStats }>> {
    return this.request('GET', '/loan-applications/stats/summary');
  }

  // Dashboard APIs
  async getDashboardSummary(): Promise<ApiResponse<{
    user: {
      id: number;
      name: string;
      phone: string;
      email: string;
      member_since: string;
    };
    summary: {
      credit_score: number;
      available_credit: number;
      total_loans: number;
      active_loans: number;
      total_loan_amount: number;
      outstanding_amount: number;
      payment_score: number;
    };
    active_loans: Array<{
      id: number;
      loan_number: string;
      loan_amount: number;
      interest_rate: number;
      tenure_months: number;
      emi_amount: number;
      status: string;
      disbursed_at: string;
      first_emi_date: string;
      loan_purpose: string;
      days_since_disbursement: number;
      completed_months: number;
      outstanding_amount: number;
      completed_tenure: number;
      progress_percentage: number;
    }>;
    upcoming_payments: Array<{
      loan_id: number;
      loan_number: string;
      emi_amount: number;
      next_emi_date: string;
      status: string;
    }>;
    notifications: Array<{
      id: number;
      title: string;
      message: string;
      notification_type: string;
      created_at: string;
    }>;
    alerts: Array<{
      type: string;
      title: string;
      message: string;
      icon: string;
    }>;
  }>> {
    return this.request('GET', '/dashboard');
  }

  async getLoanDetails(loanId: number): Promise<ApiResponse<{
    loan: any;
    payments: Array<{
      id: number;
      amount: number;
      transaction_type: string;
      status: string;
      created_at: string;
      processed_at: string;
    }>;
  }>> {
    return this.request('GET', `/loans/${loanId}`);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return this.request('GET', '/health');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;