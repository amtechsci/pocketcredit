// API Service for Pocket Credit Platform
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types for API responses
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  success?: boolean;
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
  spoken_language?: string;
  work_experience_range?: string;
  employment_type?: string;
  graduation_status?: string;
  loan_limit?: number;
  income_range?: string;
  pan_number?: string;
  pincode?: string;
  phone_verified: boolean;
  email_verified?: boolean;
  personal_email?: string;
  personal_email_verified?: boolean;
  official_email?: string;
  official_email_verified?: boolean;
  residence_type?: 'owned' | 'rented' | null;
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
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
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
          // Also set lowercase version for compatibility
          config.headers.authorization = `Bearer ${token}`;
        } else {
          console.warn('⚠️ No JWT token found in localStorage for request:', config.url);
        }
        // If data is FormData, remove Content-Type header so axios can set it with boundary
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
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
    // Log request details for debugging
    if (endpoint.includes('references')) {
      console.log(`🌐 API Request: ${method} ${endpoint}`, data);
    }
    
    try {
      const response = await this.api.request({
        method,
        url: endpoint,
        data,
      });

      if (endpoint.includes('references')) {
        console.log(`✅ API Response: ${method} ${endpoint}`, response.data);
      }

      return response.data;
    } catch (error: any) {
      if (endpoint.includes('references')) {
        console.error(`❌ API Error: ${method} ${endpoint}`, {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: error.config
        });
      }
      
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
    // Get stored UTM parameters
    const utmParams = this.getStoredUTMParams();

    // Include UTM parameters in request if present
    const requestBody: any = { mobile, otp };
    if (utmParams.utm_source) {
      requestBody.utm_source = utmParams.utm_source;
      requestBody.utm_medium = utmParams.utm_medium || 'partner_api';
      requestBody.utm_campaign = utmParams.utm_campaign;
    }

    const response = await this.request<LoginResponse & { token?: string }>('POST', '/auth/verify-otp', requestBody);

    // Store JWT token if provided
    if (response.status === 'success' && response.data?.token) {
      localStorage.setItem('pocket_user_token', response.data.token);
    }

    return response;
  }

  /**
   * Get stored UTM parameters from localStorage
   */
  private getStoredUTMParams(): { utm_source?: string; utm_medium?: string; utm_campaign?: string } {
    try {
      const stored = localStorage.getItem('pocketcredit_utm_params');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading stored UTM parameters:', error);
    }
    return {};
  }

  async getUserProfile(): Promise<ApiResponse<{ user: User }>> {
    return this.request<{ user: User }>('GET', '/auth/profile');
  }

  async getUserApplications() {
    return this.request('GET', '/users/applications', {});
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

  // createLoanApplication - for new loan application flow
  async createLoanApplication(loanData: any): Promise<ApiResponse<any>> {
    // Get stored UTM parameters
    const utmParams = this.getStoredUTMParams();

    // Include UTM parameters in request if present
    const requestData: any = { ...loanData };
    if (utmParams.utm_source) {
      requestData.utm_source = utmParams.utm_source;
    }

    return this.request('POST', '/loan-applications/apply', requestData);
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

  /**
   * Save bank details for user (without application_id)
   */
  async getEnachStatus(): Promise<ApiResponse<{
    registered: boolean;
    data?: any;
  }>> {
    return this.request('GET', '/bank-details/enach-status');
  }

  async registerEnach(bankDetailId: number): Promise<ApiResponse<{
    enach_id: number;
    bank_detail_id: number;
    application_id: number;
  }>> {
    return this.request('POST', '/bank-details/register-enach', { bank_detail_id: bankDetailId });
  }

  async saveUserBankDetails(data: {
    account_number: string;
    ifsc_code: string;
    bank_name?: string;
  }): Promise<ApiResponse<{
    id: number;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    account_holder_name: string;
  }>> {
    return this.request('POST', '/bank-details/user', data);
  }

  async updateBankDetails(id: number, data: {
    account_number?: string;
    is_primary?: boolean;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('PUT', `/bank-details/${id}`, data);
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
    company_name?: string;
    company_email?: string;
  }): Promise<ApiResponse<{
    references_count: number;
    user_id: number;
    alternate_data: {
      alternate_mobile: string;
      company_name?: string;
      company_email?: string;
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

  // Loan Application Document Upload APIs
  async uploadLoanDocument(
    formData: FormData,
    loanApplicationId: number,
    documentName: string,
    documentType: string
  ): Promise<ApiResponse<{
    message: string;
    document: {
      id: number;
      document_name: string;
      document_type: string;
      s3_key: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      status: string;
    };
  }>> {
    const token = localStorage.getItem('pocket_user_token');

    // Append required fields to FormData
    formData.append('loan_application_id', loanApplicationId.toString());
    formData.append('document_name', documentName);
    formData.append('document_type', documentType);

    const response = await fetch(`${this.baseURL}/loan-documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      if (responseText.trim().startsWith('<')) {
        console.error('Server returned HTML error:', responseText);

        // Extract error details for toaster display (mobile debugging)
        let errorDetail = 'Unknown HTML Error';
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);

        if (titleMatch && titleMatch[1]) {
          errorDetail = titleMatch[1].trim();
        } else {
          // Strip HTML tags and shorten to show some context
          errorDetail = responseText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').substring(0, 100).trim();
        }

        throw new Error(`Server Error (${response.status}): ${errorDetail}`);
      }
      throw new Error(`Invalid server response (Status ${response.status})`);
    }

    if (!response.ok) {
      throw new Error(responseData.message || 'Upload failed');
    }

    return responseData;
  }

  async getLoanDocuments(loanApplicationId: number): Promise<ApiResponse<{
    documents: Array<{
      id: number;
      document_name: string;
      document_type: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      upload_status: string;
      uploaded_at: string;
      verified_at?: string;
      verification_notes?: string;
    }>;
  }>> {
    return this.request('GET', `/loan-documents/${loanApplicationId}`);
  }

  async getLoanDocumentUrl(documentId: number): Promise<ApiResponse<{
    url: string;
    expires_in: number;
  }>> {
    return this.request('GET', `/loan-documents/${documentId}/url`);
  }

  async deleteLoanDocument(documentId: number): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.request('DELETE', `/loan-documents/${documentId}`);
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
    // Get stored UTM parameters
    const utmParams = this.getStoredUTMParams();

    // Include UTM parameters in request if present
    const requestData: any = { ...loanData };
    if (utmParams.utm_source) {
      requestData.utm_source = utmParams.utm_source;
    }

    return this.request('POST', '/loan-applications/apply', requestData);
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

  // Credit Analytics APIs
  async checkCreditEligibility(applicationId?: number): Promise<ApiResponse<{
    eligible?: boolean; // Legacy field name
    is_eligible?: boolean; // Actual field name from backend
    credit_score?: number;
    rejection_reasons?: string[];
    reasons?: string[]; // Actual field name from backend
    hold_reason?: string; // Hold reason from backend
    hold_until?: string;
    on_hold?: boolean;
    bre_evaluation?: {
      passed: boolean;
      reasons: string[];
      results: any;
    };
  }>> {
    const data = applicationId ? { application_id: applicationId } : {};
    return this.request('POST', '/credit-analytics/check', data);
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
      interest_rate: number; // Calculated from interest_percent_per_day * 365 * 100 on backend
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
   * Get user's selected loan plan (or default plan)
   */
  async getSelectedLoanPlan(): Promise<ApiResponse<{
    plan: any;
    is_user_selected: boolean;
    is_system_default: boolean;
  }>> {
    return this.request('GET', '/user/selected-loan-plan');
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
   * Validate PAN and fetch details from Digitap API
   */
  async validatePAN(pan: string): Promise<ApiResponse<{
    saved: boolean;
    profile_completed: boolean;
    pan_data?: {
      name: string;
      first_name: string;
      last_name: string;
      dob: string;
      gender: string;
      address: any;
    };
  }>> {
    return this.request('POST', '/digitap/validate-pan', { pan });
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
   * Get available addresses from Experian and Digilocker
   */
  async getAvailableAddresses(): Promise<ApiResponse<{
    digilocker_address?: any;
    experian_addresses?: any[];
  }>> {
    return this.request('GET', '/user/available-addresses');
  }

  /**
   * Save residence address and type
   */
  async saveAdditionalInformation(data: {
    marital_status: string;
    spoken_language: string;
    work_experience: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', '/user/additional-information', data);
  }

  async saveResidenceAddress(data: {
    residence_type: 'owned' | 'rented';
    source: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
    full_address?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('POST', '/user/residence-address', data);
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
    application_id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
  }): Promise<ApiResponse<{ kycUrl: string; transactionId: string; shortUrl: string }>> {
    return this.request('POST', '/digilocker/generate-kyc-url', data);
  }

  /**
   * Get KYC Status for an application
   */
  async getKYCStatus(applicationId: number | string): Promise<ApiResponse<{
    kyc_status: string;
    kyc_method: string | null;
    verified_at: string | null;
    verification_data?: any; // Can be object or string, contains rekyc_required flag
  }>> {
    return this.request('GET', `/digilocker/kyc-status/${applicationId}`);
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
   * Digilocker - Check if PAN document exists
   */
  async checkPanDocument(applicationId: string): Promise<ApiResponse<{
    hasPanDocument: boolean;
    transactionId: string | null;
  }>> {
    return this.request('GET', `/digilocker/check-pan-document/${applicationId}`);
  }

  /**
   * Submit Employment Details
   */
  async submitEmploymentDetails(data: {
    company_name: string;
    monthly_net_income: number;
    income_confirmed: boolean;
    education: string;
    salary_date: number;
    industry: string;
    department: string;
    designation: string;
    // application_id is no longer required - employment details is now user-specific
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('POST', '/employment-details/details', data);
  }

  /**
   * Check Employment Details Status (user-specific, no longer requires applicationId)
   */
  async getEmploymentDetailsStatus(): Promise<ApiResponse<{
    completed: boolean;
    hasEmploymentDetails: boolean;
    hasUserEmploymentDetails: boolean;
    employmentData: any;
  }>> {
    return this.request('GET', '/employment-details/status');
  }

  /**
   * Search Companies (autocomplete)
   */
  async searchCompanies(query: string, limit: number = 15): Promise<ApiResponse<Array<{
    id: number;
    company_name: string;
    industry: string | null;
    is_verified: boolean;
  }>>> {
    return this.request('GET', `/companies/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  /**
   * Add new company (user-submitted)
   */
  async addCompany(data: {
    company_name: string;
    industry?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', '/companies/add', data);
  }

  /**
   * Perform Credit Check (Experian via Digitap)
   */
  async performCreditCheck(): Promise<ApiResponse<{
    is_eligible: boolean;
    credit_score: number | null;
    reasons: string[];
    request_id: string;
  }>> {
    return this.request('POST', '/credit-analytics/check');
  }

  /**
   * Get Credit Check Status
   */
  async getCreditCheckStatus(): Promise<ApiResponse<{
    completed: boolean;
    credit_score: number | null;
    is_eligible: boolean | null;
    checked_at: string | null;
  }>> {
    return this.request('GET', '/credit-analytics/status');
  }

  /**
   * Get Credit Analytics Data (full report)
   */
  async getCreditAnalyticsData(): Promise<ApiResponse<any>> {
    return this.request('GET', '/credit-analytics/data');
  }

  /**
   * Get Credit Analytics Contacts (mobile numbers and emails)
   */
  async getCreditAnalyticsContacts(): Promise<ApiResponse<{
    mobile_numbers: Array<{ value: string; is_primary: boolean }>;
    emails: Array<{ value: string; is_primary: boolean }>;
    source: string;
  }>> {
    return this.request('GET', '/credit-analytics/contacts');
  }

  /**
   * Auto-save credit analytics mobile numbers as references
   */
  async saveCreditAnalyticsReferences(mobileNumbers: string[]): Promise<ApiResponse<{
    saved_count: number;
    saved_references: Array<{
      id: number;
      name: string;
      phone: string;
      relation: string;
    }>;
  }>> {
    return this.request('POST', '/references/credit-analytics', { mobile_numbers: mobileNumbers });
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
   * Upload bank statement (user-only, manual upload)
   */
  async uploadBankStatement(formData: FormData): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('pocket_user_token');
    const response = await fetch(`${this.baseURL}/bank-statement/upload-bank-statement`, {
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

  /**
   * User Bank Statement - Initiate (one-time per user)
   */
  async initiateUserBankStatement(data: {
    mobile_number?: string;
    bank_name?: string;
    destination?: 'netbanking' | 'accountaggregator' | 'statementupload';
  }): Promise<ApiResponse<{
    digitapUrl: string;
    clientRefNum: string;
    requestId?: number;
    expiryTime?: string;
  }>> {
    return this.request('POST', '/bank-statement/initiate-bank-statement', data);
  }

  /**
   * User Bank Statement - Upload PDF (one-time per user)
   */
  async uploadUserBankStatementPDF(formData: FormData): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('pocket_user_token');
    const response = await fetch(`${this.baseURL}/bank-statement/upload-bank-statement`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData
    });
    return response.json();
  }

  /**
   * User Bank Statement - Get Status
   */
  async getUserBankStatementStatus(): Promise<ApiResponse<{
    hasStatement: boolean;
    status: string | null;
    clientRefNum?: string;
    requestId?: number;
    fileName?: string;
    hasReport: boolean;
    digitapUrl?: string;
    expiresAt?: string;
    transactionData?: any[];
    createdAt?: string;
    updatedAt?: string;
  }>> {
    return this.request('GET', '/bank-statement/bank-statement-status');
  }

  /**
   * User Bank Statement - Fetch Report
   */
  async fetchUserBankReport(): Promise<ApiResponse<{
    status: string;
    report?: any;
    message?: string;
    cached?: boolean;
  }>> {
    return this.request('POST', '/bank-statement/fetch-bank-report');
  }

  /**
   * User Bank Statement - Delete Pending Upload
   */
  async deletePendingBankStatement(): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.request('POST', '/bank-statement/delete-pending-bank-statement');
  }

  /**
   * Post-Disbursal Flow - Get Progress
   */
  async getPostDisbursalProgress(applicationId: number): Promise<ApiResponse<{
    enach_done: boolean;
    selfie_captured: boolean;
    selfie_verified: boolean;
    references_completed: boolean;
    kfs_viewed: boolean;
    agreement_signed: boolean;
    current_step: number;
  }>> {
    return this.request('GET', `/post-disbursal/progress/${applicationId}`);
  }

  /**
   * Post-Disbursal Flow - Update Progress
   */
  async updatePostDisbursalProgress(
    applicationId: number,
    progress: {
      enach_done?: boolean;
      selfie_captured?: boolean;
      selfie_verified?: boolean;
      references_completed?: boolean;
      kfs_viewed?: boolean;
      agreement_signed?: boolean;
      current_step?: number;
    }
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request('PUT', `/post-disbursal/progress/${applicationId}`, progress);
  }

  /**
   * Post-Disbursal Flow - Upload Selfie
   */
  async uploadSelfieForVerification(
    applicationId: number,
    file: File
  ): Promise<ApiResponse<{
    selfie_url: string;
    message: string;
    verification?: {
      verified?: boolean;
      match?: boolean;
      confidence?: number;
      skipped?: boolean;
      reason?: string;
      error?: string;
      details?: any;
    };
  }>> {
    const formData = new FormData();
    formData.append('selfie', file);
    formData.append('applicationId', applicationId.toString());

    // Use axios directly - the interceptor will remove Content-Type for FormData
    try {
      const response = await this.api.post('/post-disbursal/upload-selfie', formData);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error(error.message || 'Failed to upload selfie');
    }
  }

  /**
   * Post-Disbursal Flow - Complete All Steps
   */
  async completePostDisbursalFlow(applicationId: number): Promise<ApiResponse<{
    message: string;
    status: string;
  }>> {
    return this.request('POST', `/post-disbursal/complete/${applicationId}`);
  }

  /**
   * Get KFS (Key Facts Statement) for user's loan
   */
  /**
   * Initiate ClickWrap e-signature for loan agreement
   */
  async initiateClickWrap(applicationId: number, htmlContent: string): Promise<ApiResponse<{
    entTransactionId: string;
    docTransactionId: string;
    previewUrl: string;
  }>> {
    return this.request('POST', '/clickwrap/initiate', {
      applicationId,
      htmlContent
    });
  }

  /**
   * Get signed document URL
   */
  async getSignedDocument(applicationId: number): Promise<ApiResponse<{
    previewUrl: string;
    signed: boolean;
  }>> {
    return this.request('POST', '/clickwrap/get-signed-doc', {
      applicationId
    });
  }

  async getKFS(loanId: number, useActualDays: boolean = false): Promise<ApiResponse<any>> {
    const queryParam = useActualDays ? '?useActualDays=true' : '';
    return this.request('GET', `/kfs/user/${loanId}${queryParam}`);
  }

  /**
   * Get NOC (No Dues Certificate) data for a cleared loan
   */
  async getNOC(loanId: number): Promise<ApiResponse<any>> {
    return this.request('GET', `/kfs/user/${loanId}/noc`);
  }

  /**
   * Download NOC PDF for a cleared loan
   * If PDF exists in S3, downloads it directly. Otherwise generates it.
   * htmlContent is optional - backend will generate it if not provided
   */
  async downloadNOCPDF(loanId: number, htmlContent?: string): Promise<Blob> {
    try {
      const response = await this.api.post(
        `/kfs/user/${loanId}/noc/generate-pdf`,
        htmlContent ? { htmlContent } : {},
        {
          responseType: 'blob',
          timeout: 60000 // 60 seconds timeout for PDF generation
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error downloading NOC PDF:', error);
      
      // Try to extract error message from blob response if possible
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || 'Failed to download NOC PDF');
        } catch (parseError) {
          throw new Error('Failed to download NOC PDF');
        }
      }
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to download NOC PDF';
      throw new Error(errorMessage);
    }
  }

  /**
   * Generate KFS PDF, upload to S3, save URL, and send email
   */
  async generateAndSaveKFS(loanId: number, htmlContent: string): Promise<ApiResponse<{
    s3Key: string;
    filename: string;
    pdfSize: number;
    emailSent: boolean;
  }>> {
    return this.request('POST', `/kfs/${loanId}/generate-and-save`, {
      htmlContent
    });
  }

  /**
   * Get loan calculation (same API used by admin and user)
   * @param loanId - Loan application ID
   * @param options - Optional calculation options
   */
  async getLoanCalculation(loanId: number, options?: {
    customDays?: number;
    calculationDate?: string;
  }): Promise<ApiResponse<any>> {
    const params: any = {};
    if (options?.customDays !== undefined) {
      params.customDays = options.customDays;
    }
    if (options?.calculationDate) {
      params.calculationDate = options.calculationDate;
    }
    const queryString = new URLSearchParams(params).toString();
    const url = `/loan-calculations/${loanId}${queryString ? `?${queryString}` : ''}`;
    return this.request('GET', url);
  }

  /**
   * eNACH Subscription APIs
   */

  /**
   * Create eNACH subscription for loan application
   */
  async createEnachSubscription(applicationId: number, authMode?: string): Promise<ApiResponse<{
    subscription_id: string;
    authorization_url: string;
    subscription_status: string;
  }>> {
    return this.request('POST', '/enach/create-subscription', {
      applicationId,
      authMode: authMode || 'net_banking'
    });
  }

  /**
   * Get subscription status
   */
  async getEnachSubscriptionStatus(subscriptionId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/enach/subscription-status/${subscriptionId}`);
  }

  /**
   * Get subscription for loan application
   */
  async getEnachSubscription(applicationId: number): Promise<ApiResponse<any>> {
    return this.request('GET', `/enach/subscription/${applicationId}`);
  }

  /**
   * Payment Gateway APIs (One-time repayments)
   */

  /**
   * Create payment order for loan repayment
   * @param loanId - Loan application ID
   * @param amount - Payment amount
   * @param paymentType - Payment type: 'pre-close', 'emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th' (optional)
   */
  async createPaymentOrder(loanId: number, amount: number, paymentType?: string): Promise<ApiResponse<{
    orderId: string;
    paymentSessionId: string;
    checkoutUrl: string;
  }>> {
    // Always include paymentType in the request body
    // Use null instead of undefined so it's included in JSON serialization
    const requestBody = {
      loanId,
      amount,
      paymentType: paymentType || null  // Use null instead of undefined so it's sent in JSON
    };
    console.log('[API] createPaymentOrder called with:', { loanId, amount, paymentType, requestBody });
    return this.request('POST', '/payment/create-order', requestBody);
  }

  /**
   * Get all pending payment orders for the user
   */
  async getPendingPayments(): Promise<ApiResponse<{
    orders: Array<{
      id: number;
      order_id: string;
      loan_id: number;
      extension_id: number | null;
      amount: string;
      payment_type: string;
      status: string;
      payment_session_id: string | null;
      created_at: string;
      updated_at: string;
      application_number: string | null;
      loan_amount: string | null;
      loan_status: string | null;
      cashfreeStatus: any;
    }>;
    count: number;
  }>> {
    return this.request('GET', '/payment/pending');
  }

  /**
   * Get payment order status
   */
  async getPaymentOrderStatus(orderId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/payment/order-status/${orderId}`);
  }

  /**
   * Loan Extension APIs
   */

  /**
   * Check extension eligibility
   */
  async checkExtensionEligibility(loanId: number): Promise<ApiResponse<any>> {
    return this.request('GET', `/loan-extensions/eligibility/${loanId}`);
  }

  /**
   * Request loan extension
   */
  async requestLoanExtension(loanApplicationId: number, reason?: string): Promise<ApiResponse<any>> {
    return this.request('POST', '/loan-extensions/request', {
      loan_application_id: loanApplicationId,
      reason: reason || 'Requesting loan tenure extension'
    });
  }

  /**
   * Get extension letter data for a loan (user accessible)
   */
  async getExtensionLetter(loanId: number): Promise<ApiResponse<any>> {
    return this.request('GET', `/kfs/user/${loanId}/extension-letter`);
  }

  /**
   * Send extension letter to email
   * @deprecated Email is now sent automatically on payment success
   */
  async sendExtensionLetterEmail(loanId: number, htmlContent: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/kfs/user/${loanId}/extension-letter/send-email`, { htmlContent });
  }

  /**
   * Accept extension agreement (changes status from 'pending' to 'pending_payment')
   */
  async acceptExtensionAgreement(extensionId: number): Promise<ApiResponse<any>> {
    return this.request('POST', `/loan-extensions/${extensionId}/accept-agreement`);
  }

  /**
   * Create payment order for extension fee
   */
  async createExtensionPayment(extensionId: number): Promise<ApiResponse<{
    orderId: string;
    paymentSessionId: string;
    checkoutUrl: string;
    extension_id: number;
    amount: number;
  }>> {
    return this.request('POST', `/loan-extensions/${extensionId}/payment`);
  }

  /**
   * Check payment status for pending_payment extension and complete if paid
   */
  async checkExtensionPayment(extensionId: number): Promise<ApiResponse<{
    status: 'completed' | 'pending' | 'failed' | 'processing' | 'already_processed' | 'unknown';
    message: string;
    payment_status: string;
    extension_approved?: boolean;
    extension_status?: string;
    order_id?: string;
    cashfree_status?: string;
  }>> {
    return this.request('POST', `/loan-extensions/${extensionId}/check-payment`);
  }

  /**
   * Get extension history for a loan
   */
  async getExtensionHistory(loanId: number): Promise<ApiResponse<any>> {
    return this.request('GET', `/loan-extensions/history/${loanId}`);
  }

  /**
   * Credit Limit Management
   */
  async getPendingCreditLimit(): Promise<ApiResponse<any>> {
    return this.request('GET', '/credit-limit/pending');
  }

  async getNextCreditLimit(): Promise<ApiResponse<any>> {
    return this.request('GET', '/credit-limit/next');
  }

  async acceptCreditLimit(pendingLimitId: number): Promise<ApiResponse<any>> {
    return this.request('POST', '/credit-limit/accept', { pendingLimitId });
  }

  async rejectCreditLimit(pendingLimitId: number): Promise<ApiResponse<any>> {
    return this.request('POST', '/credit-limit/reject', { pendingLimitId });
  }

  /**
   * UAN Basic V3 API Method (synchronous API)
   */
  async getUANBasic(data: { mobile: string }): Promise<ApiResponse<any>> {
    return this.request('POST', '/digitap/uan/basic', data);
  }

  /**
   * Get stored UAN data for the user
   */
  async getStoredUANData(): Promise<ApiResponse<any>> {
    return this.request('GET', '/digitap/uan/stored');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;