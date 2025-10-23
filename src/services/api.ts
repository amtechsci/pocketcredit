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
  employment_type?: string;
  graduation_status?: string;
  loan_limit?: number;
  income_range?: string;
  pan_number?: string;
  pincode?: string;
  phone_verified: boolean;
  email_verified?: boolean;
  kyc_completed?: boolean;
  profile_completion_step: number;
  profile_completed: boolean;
  status: string;
  created_at: string;
  last_login_at?: string;
  latlong?: string;
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
  private baseURL: string;

  constructor() {
    // Dynamic API URL based on environment and current host
    if (process.env.NODE_ENV === 'production') {
      this.baseURL = '/api';
    } else {
      // In development, use the same host as the frontend but port 3002
      const hostname = window.location.hostname;
      this.baseURL = `http://${hostname}:3002/api`;
    }
    
    console.log('🌐 API Base URL:', this.baseURL);
    
    this.api = axios.create({
      baseURL: this.baseURL,
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
    pan_number?: string;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<ApiResponse<{ 
    user: User; 
    next_step: string; 
    step_completed: string;
    hold_permanent?: boolean;
    hold_until?: string;
    hold_reason?: string;
  }>> {
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

  // NOTE: Old createLoanApplication method removed - use applyForLoan() instead
  // which calls /loan-applications/apply

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

  // User References (using consolidated references table)
  async saveUserReferences(data: {
    references: Array<{
      name: string;
      phone: string;
      relation: string;
    }>;
    alternate_mobile: string;
    company_name: string;
    company_email: string;
  }): Promise<ApiResponse<{
    references_count: number;
    user_id: number;
    alternate_data: {
      alternate_mobile: string;
      company_name: string;
      company_email: string;
    };
  }>> {
    return this.request('POST', '/references', data);
  }

  async getUserReferences(): Promise<ApiResponse<{
    references: Array<{
      id: number;
      user_id: number;
      name: string;
      phone: string;
      relation: string;
      status: string;
      admin_id: number | null;
      created_at: string;
      updated_at: string;
    }>;
    alternate_data: {
      alternate_mobile: string | null;
      company_name: string | null;
      company_email: string | null;
    } | null;
  }>> {
    return this.request('GET', '/references');
  }

  async updateUserReference(id: number, referenceData: {
    name: string;
    phone: string;
    relation: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('PUT', `/references/${id}`, referenceData);
  }

  async deleteUserReference(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.request('DELETE', `/references/${id}`);
  }

  // Legacy loan references (kept for backward compatibility)
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

  // Employment Quick Check (Step 1)
  async saveEmploymentQuickCheck(data: {
    employment_type: string;
    monthly_salary?: number;
    payment_mode?: string;
    designation?: string;
  }): Promise<ApiResponse<{
    eligible: boolean;
    message?: string;
    hold_until?: string;
    issues?: string[];
  }>> {
    return this.request('POST', '/employment-quick-check', data);
  }

  // Student Profile Update (Step 3)
  async updateStudentProfile(data: {
    date_of_birth: string;
    college_name: string;
    graduation_status: string;
  }): Promise<ApiResponse<{
    user: User;
    next_step: string;
    profile_completed: boolean;
    hold_permanent?: boolean;
    hold_until?: string;
    hold_reason?: string;
    age_restriction?: boolean;
  }>> {
    return this.request('PUT', '/user/profile/student', data);
  }

  // Update Graduation Status (Upsell feature)
  async updateGraduationStatus(data: {
    graduation_status: 'graduated' | 'not_graduated';
    graduation_date?: string;
  }): Promise<ApiResponse<{
    user: User;
    loan_limit: number;
    old_loan_limit: number;
    upgraded: boolean;
  }>> {
    return this.request('PUT', '/user/graduation-status', data);
  }

  // Student Document Upload APIs
  async uploadStudentDocument(formData: FormData): Promise<ApiResponse<{
    message: string;
    document: {
      id: number;
      document_type: string;
      s3_key: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      status: string;
    };
  }>> {
    const token = localStorage.getItem('pocket_user_token');
    const response = await fetch(`${this.baseURL}/student-documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Upload failed');
    }

    return response.json();
  }

  async getStudentDocuments(): Promise<ApiResponse<{
    documents: Array<{
      id: number;
      document_type: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      status: string;
      upload_date: string;
    }>;
  }>> {
    return this.request('GET', '/student-documents');
  }

  async deleteStudentDocument(documentId: number): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.request('DELETE', `/student-documents/${documentId}`);
  }

  async getStudentDocumentUrl(documentId: number): Promise<ApiResponse<{
    url: string;
    expires_in: number;
  }>> {
    return this.request('GET', `/student-documents/${documentId}/url`);
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
  // ==================== Loan Plans APIs ====================

  /**
   * Get available loan plans for the current user
   */
  async getAvailableLoanPlans(): Promise<ApiResponse<any[]>> {
    return this.request('GET', '/loan-plans/available');
  }

  /**
   * Calculate loan repayment details for a specific plan
   */
  async calculateLoanPlan(loanAmount: number, planId: number): Promise<ApiResponse<any>> {
    return this.request('POST', '/loan-plans/calculate', {
      loan_amount: loanAmount,
      plan_id: planId
    });
  }

  // ==================== Digitap API ====================

  /**
   * Fetch user prefill data from Digitap API (credit score, personal details)
   */
  async fetchDigitapPrefill(): Promise<ApiResponse<{
    name?: string;
    dob?: string;
    pan?: string;
    gender?: string;
    email?: string;
    address?: any;
    credit_score?: number;
    age?: number;
  }>> {
    return this.request('POST', '/digitap/prefill');
  }

  async saveDigitapPrefill(data: {
    name: string;
    dob: string;
    pan: string;
    gender: string;
    email: string;
    address: any;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('POST', '/digitap/save-prefill', data);
  }

  /**
   * Email OTP Verification Methods
   */
  async sendEmailOtp(email: string, type: 'personal' | 'official'): Promise<ApiResponse<{ message: string }>> {
    return this.request('POST', '/email-otp/send', { email, type });
  }

  async verifyEmailOtp(email: string, otp: string, type: 'personal' | 'official'): Promise<ApiResponse<{ message: string }>> {
    return this.request('POST', '/email-otp/verify', { email, otp, type });
  }

  /**
   * Additional Details Update
   */
  async updateAdditionalDetails(data: {
    personal_email: string;
    marital_status: string;
    salary_date: string;
    official_email: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('PUT', '/user/additional-details', data);
  }

  /**
   * Digilocker KYC - Generate KYC URL
   */
  async generateDigilockerKYCUrl(data: {
    mobile_number: string;
    application_id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
  }): Promise<ApiResponse<{ kycUrl: string; transactionId: string; shortUrl: string }>> {
    return this.request('POST', '/digilocker/generate-kyc-url', data);
  }

  /**
   * Digilocker - Get Details (profile)
   */
  async digilockerGetDetails(transactionId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/digilocker/get-details/${transactionId}`);
  }

  /**
   * Digilocker - List Docs
   */
  async digilockerListDocs(transactionId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/digilocker/list-docs/${transactionId}`);
  }

  /**
   * Submit Employment Details
   */
  async submitEmploymentDetails(data: {
    company_name: string;
    industry: string;
    department: string;
    designation: string;
    application_id: number;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('POST', '/employment/details', data);
  }

  /**
   * Account Aggregator - Initiate AA flow
   */
  async initiateAccountAggregator(data: {
    mobile_number: string;
    bank_name: string;
    application_id: number;
  }): Promise<ApiResponse<{ aaUrl: string; transactionId: string }>> {
    return this.request('POST', '/aa/initiate', data);
  }

  /**
   * Account Aggregator - Upload bank statement PDF
   */
  async uploadBankStatementPDF(formData: FormData): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('pocket_user_token');
    const response = await fetch(`${this.baseURL}/aa/upload-statement`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData
    });
    return response.json();
  }

  /**
   * Account Aggregator - Get AA status
   */
  async getAccountAggregatorStatus(applicationId: number): Promise<ApiResponse<any>> {
    return this.request('GET', `/aa/status/${applicationId}`);
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;