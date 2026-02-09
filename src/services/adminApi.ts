import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types for admin API responses
export interface AdminLoginResponse {
  admin: {
    id: string;
    name: string;
    email: string;
    role: 'superadmin' | 'manager' | 'officer';
    permissions: string[];
  };
  token: string;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data?: T;
}

export interface DashboardStats {
  totalUsers: number;
  totalLoans: number;
  pendingLoans: number;
  approvedLoans: number;
  activeLoans: number;
  totalDisbursed: number;
  recentActivity: any[];
}

export interface LoanApplication {
  id: string;
  userId: string;
  userName: string;
  userMobile: string;
  userEmail: string;
  amount: number;
  userCreditScore: number;
  type: string;
  status: string;
  createdAt: string;
  loanId?: string;
}

export interface UserDetailData {
  user: {
    id: string;
    name: string;
    email: string;
    mobile: string;
    kycStatus: string;
    creditScore: number;
    memberLevel: string;
    status: string;
    personalInfo: {
      age?: number;
      gender?: string;
      maritalStatus?: string;
      dateOfBirth?: string;
    };
  };
  loans: any[];
  documents: any[];
  notes: any[];
  kycVerification?: any;
  kycDocuments?: any[];
  selfieData?: {
    selfie_url?: string;
    selfie_verified?: boolean;
    selfie_captured?: boolean;
    updated_at?: string;
    faceMatch?: {
      success?: boolean;
      match?: boolean;
      confidence?: number;
      details?: any;
    };
  };
}

class AdminApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: '/api/admin', // Direct admin API calls
      timeout: 60000, // Default 60 seconds, can be overridden per request
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage on initialization
    this.token = localStorage.getItem('adminToken');
    if (this.token) {
      this.setAuthHeader(this.token);
    }

    // Add request interceptor for debugging
    this.api.interceptors.request.use(
      (config) => {
        console.log('Admin API Request:', config.method?.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error('Admin API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for debugging and auth handling
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log('Admin API Response:', response.status, response.config.url);
        
        // Check for session warning headers
        const warningHeader = response.headers['x-session-warning'];
        const timeRemaining = response.headers['x-session-time-remaining'];
        
        if (warningHeader === 'true' && timeRemaining) {
          const secondsRemaining = parseInt(timeRemaining, 10);
          const minutesRemaining = Math.ceil(secondsRemaining / 60);
          
          // Dispatch custom event for frontend to handle warning
          window.dispatchEvent(new CustomEvent('admin-session-warning', {
            detail: { secondsRemaining, minutesRemaining }
          }));
        }
        
        return response;
      },
      (error) => {
        console.error('Admin API Response Error:', error.response?.data || error.message);

        // Handle authentication errors
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data?.message || '';
          const code = error.response.data?.code || '';

          // Check for session expired due to inactivity
          if (code === 'SESSION_EXPIRED' || message.toLowerCase().includes('session expired due to inactivity')) {
            console.log('Session expired due to inactivity, clearing credentials and redirecting to login');
            
            // Clear authentication data
            this.token = null;
            this.clearAuthHeader();
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');

            // Show alert before redirecting
            alert('Your session has expired due to inactivity. Please login again.');
            
            // Redirect to admin login page
            setTimeout(() => {
              window.location.href = '/stpl/login';
            }, 100);
            
            return Promise.reject(error);
          }

          // Check for other auth-related errors
          if (
            status === 401 ||
            status === 403 ||
            message.toLowerCase().includes('invalid') && message.toLowerCase().includes('token') ||
            message.toLowerCase().includes('expired') && message.toLowerCase().includes('token') ||
            message.toLowerCase().includes('access token required') ||
            message.toLowerCase().includes('admin not found') ||
            message.toLowerCase().includes('admin access required')
          ) {
            console.log('Authentication error detected, clearing credentials and redirecting to login');

            // Clear authentication data
            this.token = null;
            this.clearAuthHeader();
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');

            // Redirect to admin login page
            // Use setTimeout to avoid blocking the error handling
            setTimeout(() => {
              window.location.href = '/stpl/login';
            }, 100);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Set authorization header
  private setAuthHeader(token: string) {
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Clear authorization header
  private clearAuthHeader() {
    delete this.api.defaults.headers.common['Authorization'];
  }

  // Handle authentication errors and redirect to login
  private handleAuthError(error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || '';
      const code = error.response.data?.code || '';

      // Don't treat 403 as auth error if it's an external API error (e.g., Digitap)
      // Check if it's a Digitap or external service error
      const isExternalApiError =
        code === 'NotSignedUp' ||
        message.toLowerCase().includes('digitap') ||
        message.toLowerCase().includes('bank data service') ||
        error.response.data?.errorDetails;

      // Check for auth-related errors (but not external API errors)
      if (
        (status === 401 || (status === 403 && !isExternalApiError)) ||
        (message.toLowerCase().includes('invalid') && message.toLowerCase().includes('token')) ||
        (message.toLowerCase().includes('expired') && message.toLowerCase().includes('token')) ||
        message.toLowerCase().includes('access token required') ||
        message.toLowerCase().includes('admin not found') ||
        message.toLowerCase().includes('admin access required')
      ) {
        console.log('Authentication error detected in direct axios call, clearing credentials and redirecting to login');

        // Clear authentication data
        this.token = null;
        this.clearAuthHeader();
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');

        // Redirect to admin login page
        setTimeout(() => {
          window.location.href = '/stpl/login';
        }, 100);
      }
    }
  }

  // Generic API request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: any,
    params?: any,
    timeout?: number
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.request({
        method,
        url: endpoint,
        data,
        params,
        timeout: timeout || this.api.defaults.timeout,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error(error.message || 'Admin API request failed');
    }
  }

  // Authentication APIs
  async login(email: string, password: string): Promise<ApiResponse<AdminLoginResponse>> {
    const response = await this.request<AdminLoginResponse>('POST', '/auth/login', {
      email,
      password
    });

    if (response.status === 'success' && response.data) {
      this.token = response.data.token;
      this.setAuthHeader(this.token);
      localStorage.setItem('adminToken', this.token);
      localStorage.setItem('adminUser', JSON.stringify(response.data.admin));
    }

    return response;
  }

  // Admin Mobile OTP APIs
  async sendOTP(mobile: string): Promise<ApiResponse<{ mobile: string; expiresIn: number }>> {
    return this.request('POST', '/auth/send-otp', { mobile });
  }

  async verifyOTP(mobile: string, otp: string): Promise<ApiResponse<AdminLoginResponse>> {
    const response = await this.request<AdminLoginResponse>('POST', '/auth/verify-otp', {
      mobile,
      otp
    });

    if (response.status === 'success' && response.data) {
      this.token = response.data.token;
      this.setAuthHeader(this.token);
      localStorage.setItem('adminToken', this.token);
      localStorage.setItem('adminUser', JSON.stringify(response.data.admin));
    }

    return response;
  }

  async logout(): Promise<ApiResponse<any>> {
    const response = await this.request('POST', '/auth/logout');

    // Clear local storage and token
    this.token = null;
    this.clearAuthHeader();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');

    return response;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.put('/api/admin/auth/change-password', {
        currentPassword,
        newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data?.message || 'Failed to change password');
      }
      throw error;
    }
  }

  // Dashboard APIs
  async getDashboardStats(period: string = '30d'): Promise<ApiResponse<DashboardStats>> {
    return this.request<DashboardStats>('GET', `/dashboard?period=${period}`);
  }

  async getChartData(period: string = '30d'): Promise<ApiResponse<any>> {
    return this.request('GET', `/dashboard/charts?period=${period}`);
  }

  async getRecentActivity(limit: number = 10): Promise<ApiResponse<any>> {
    return this.request('GET', `/dashboard/recent-activity?limit=${limit}`);
  }

  // User Management APIs
  async getUsers(page: number = 1, limit: number = 20, filters: any = {}): Promise<ApiResponse<any>> {
    return this.request('GET', '/users', undefined, {
      page,
      limit,
      ...filters
    });
  }

  async getUserProfile(userId: string): Promise<ApiResponse<UserDetailData>> {
    return this.request<UserDetailData>('GET', `/user-profile/${userId}`);
  }

  async getEnachSubscriptions(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/enach-subscriptions`);
  }

  async recheckEnachSubscriptionStatus(userId: string, subscriptionId: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/enach-subscriptions/${subscriptionId}/recheck-status`);
  }

  async chargeEnachSubscription(userId: string, subscriptionId: string, amount: number): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/enach-subscriptions/${subscriptionId}/charge`, { amount });
  }

  async getEnachChargeHistory(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/enach-subscriptions/charge-history`);
  }

  async recheckEnachChargeStatus(userId: string, chargeId: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/enach-subscriptions/charge-history/${chargeId}/recheck-status`);
  }

  async refetchKYCData(userId: string): Promise<ApiResponse<any>> {
    // Use longer timeout for refetch operation (90 seconds) as it involves downloading and uploading documents
    try {
      const response = await this.api.request({
        method: 'POST',
        url: `/user-profile/${userId}/refetch-kyc`,
        timeout: 90000, // 90 seconds for document processing
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error(error.message || 'Failed to refetch KYC data');
    }
  }

  // Loan Management APIs
  async getLoans(page: number = 1, limit: number = 20, status?: string, search?: string): Promise<ApiResponse<any>> {
    return this.request('GET', '/loans', undefined, {
      page,
      limit,
      status,
      search
    });
  }

  async approveLoan(loanId: string, data: any = {}): Promise<ApiResponse<any>> {
    return this.request('POST', `/loans/${loanId}/approve`, data);
  }

  async rejectLoan(loanId: string, reason: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/loans/${loanId}/reject`, { reason });
  }

  // Documents Management
  async getUserDocuments(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/documents`);
  }

  async uploadDocument(userId: string, documentData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/documents`, documentData);
  }

  async uploadUserDocument(userId: string, formData: FormData): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`/api/admin/user-profile/${userId}/documents/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'json'
      });
      return response.data;
    } catch (error: any) {
      // Check if response is HTML string (server error page)
      if (error.response && error.response.data && typeof error.response.data === 'string' && error.response.data.trim().startsWith('<')) {
        console.error('Server returned HTML error:', error.response.data);
        throw new Error('Server returned an HTML error instead of JSON. It might be a 404, 500, or file size limit error.');
      }
      this.handleAuthError(error);
      throw error;
    }
  }

  async updateDocumentStatus(userId: string, documentId: string, status: string, rejectionReason?: string): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/documents/${documentId}`, { status, rejectionReason });
  }

  // Bank Details Management
  async getUserBankDetails(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/bank-details`);
  }

  async addBankDetails(userId: string, bankData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/bank-details`, bankData);
  }

  async updateBankDetailsStatus(userId: string, bankId: string, verificationStatus: string, rejectionReason?: string): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/bank-details/${bankId}`, { verificationStatus, rejectionReason });
  }

  async updateBankDetails(userId: string, bankId: string, bankData: any): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/bank-details/${bankId}/edit`, bankData);
  }

  // References Management
  async getUserReferences(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/references`);
  }

  async addReference(userId: string, referenceData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/references`, referenceData);
  }

  async updateReferenceStatus(userId: string, referenceId: string, verificationStatus?: string, feedback?: string, rejectionReason?: string): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/references/${referenceId}`, { verificationStatus, feedback, rejectionReason });
  }

  async updateReference(userId: string, referenceId: string, data: { name?: string; phone?: string; relation?: string }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/references/${referenceId}`, data);
  }

  // Transactions Management
  async getUserTransactions(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/transactions`);
  }

  async addTransaction(userId: string, transactionData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/transactions`, transactionData);
  }

  async updateTransaction(userId: string, transactionId: string, referenceNumber: string): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/transactions/${transactionId}`, { reference_number: referenceNumber });
  }

  // Follow-ups Management
  async getUserFollowUps(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/follow-ups`);
  }

  async addFollowUp(userId: string, followUpData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/follow-ups`, followUpData);
  }

  // Notes Management
  async getUserNotes(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/notes`);
  }

  async addNote(userId: string, noteData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/notes`, noteData);
  }

  // Profile Comments Management (QA and TVR comments)
  async getProfileComments(userId: string, commentType?: 'qa_comments' | 'tvr_comments'): Promise<ApiResponse<any>> {
    const params = commentType ? { commentType } : {};
    return this.request('GET', `/user-profile/${userId}/profile-comments`, undefined, params);
  }

  async addProfileComment(userId: string, commentData: { commentType: 'qa_comments' | 'tvr_comments', commentText: string }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/profile-comments`, commentData);
  }

  async updateProfileComment(userId: string, commentId: string, commentData: { commentText: string }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/profile-comments/${commentId}`, commentData);
  }

  async deleteProfileComment(userId: string, commentId: string): Promise<ApiResponse<any>> {
    return this.request('DELETE', `/user-profile/${userId}/profile-comments/${commentId}`);
  }

  // SMS Management
  async getUserSmsHistory(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/sms-history`);
  }

  async sendSMS(userId: string, smsData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/send-sms`, smsData);
  }

  // Trigger event-based SMS template manually
  async triggerEventSMS(templateKey: string, data: {
    userId: string;
    loanId?: string | number;
    variables?: Record<string, any>;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/sms-templates/${templateKey}/trigger`, data);
  }

  // Login History Management
  async getUserLoginHistory(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/login-history`);
  }

  // Loans Management
  async getUserLoans(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/loans`);
  }

  // Applications Management APIs
  async getApplications(filters: any = {}): Promise<ApiResponse<any>> {
    return this.request('GET', '/applications', undefined, filters);
  }

  async getApplicationDetails(applicationId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/applications/${applicationId}`);
  }

  async updateApplicationStatus(applicationId: string, status: string, reason?: string, assignedManager?: string, recoveryOfficer?: string): Promise<ApiResponse<any>> {
    return this.request('PUT', `/applications/${applicationId}/status`, {
      status,
      reason,
      assignedManager,
      recoveryOfficer
    });
  }

  async assignApplication(applicationId: string, assignedManager: string, recoveryOfficer: string): Promise<ApiResponse<any>> {
    return this.request('PUT', `/applications/${applicationId}/assign`, {
      assignedManager,
      recoveryOfficer
    });
  }

  async getApplicationStats(): Promise<ApiResponse<any>> {
    return this.request('GET', '/applications/stats/overview');
  }

  async exportApplications(filters: any = {}): Promise<ApiResponse<any>> {
    return this.request('GET', '/applications/export/csv', undefined, filters);
  }

  async exportApplicationsExcel(filters: any = {}): Promise<Blob> {
    const token = localStorage.getItem('adminToken');
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params.append(key, filters[key]);
      }
    });

    const response = await fetch(`${this.api.defaults.baseURL}/applications/export/excel?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to export applications');
    }

    return await response.blob();
  }

  // Admin Settings - Member Tiers
  async getMemberTiers(): Promise<ApiResponse<any>> {
    return this.request('GET', '/settings/member-tiers');
  }

  async seedMemberTiers(): Promise<ApiResponse<any>> {
    return this.request('POST', '/settings/member-tiers/seed');
  }

  async createMemberTier(data: { tier_name: string; processing_fee_percent: number; interest_percent_per_day: number; }): Promise<ApiResponse<any>> {
    return this.request('POST', '/settings/member-tiers', data);
  }

  async updateMemberTier(id: number, data: Partial<{ tier_name: string; processing_fee_percent: number; interest_percent_per_day: number; }>): Promise<ApiResponse<any>> {
    return this.request('PUT', `/settings/member-tiers/${id}`, data);
  }

  async deleteMemberTier(id: number): Promise<ApiResponse<any>> {
    return this.request('DELETE', `/settings/member-tiers/${id}`);
  }

  // Admin Settings - Fee Types
  async getFeeTypes(): Promise<ApiResponse<any>> {
    return this.request('GET', '/fee-types');
  }

  async createFeeType(data: {
    fee_name: string;
    fee_percent: number;
    application_method: 'deduct_from_disbursal' | 'add_to_total';
    description?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', '/fee-types', data);
  }

  async updateFeeType(id: number, data: Partial<{
    fee_name: string;
    fee_percent: number;
    application_method: 'deduct_from_disbursal' | 'add_to_total';
    description?: string;
    is_active?: boolean;
  }>): Promise<ApiResponse<any>> {
    return this.request('PUT', `/fee-types/${id}`, data);
  }

  async deleteFeeType(id: number): Promise<ApiResponse<any>> {
    return this.request('DELETE', `/fee-types/${id}`);
  }

  async getMemberTierFees(tierId: number): Promise<ApiResponse<any>> {
    return this.request('GET', `/fee-types/member-tier/${tierId}`);
  }

  async assignFeeToTier(tierId: number, data: {
    fee_type_id: number;
    fee_percent: number;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/fee-types/member-tier/${tierId}`, data);
  }

  async removeFeeFromTier(tierId: number, feeId: number): Promise<ApiResponse<any>> {
    return this.request('DELETE', `/fee-types/member-tier/${tierId}/${feeId}`);
  }

  // Admin Settings - Integrations (sms, email, cloud)
  async getIntegrations(type: 'sms' | 'email' | 'cloud'): Promise<ApiResponse<any>> {
    return this.request('GET', `/settings/integrations/${type}`);
  }

  async createIntegration(type: 'sms' | 'email' | 'cloud', data: { provider: string; status?: 'active' | 'inactive'; config?: Record<string, any>; }): Promise<ApiResponse<any>> {
    return this.request('POST', `/settings/integrations/${type}`, data);
  }

  async updateIntegration(type: 'sms' | 'email' | 'cloud', id: number, data: Partial<{ provider: string; status: 'active' | 'inactive'; config: Record<string, any>; }>): Promise<ApiResponse<any>> {
    return this.request('PUT', `/settings/integrations/${type}/${id}`, data);
  }

  // Reports APIs
  async getReports(type: string, filters: any = {}): Promise<ApiResponse<any>> {
    return this.request('GET', `/reports/${type}`, undefined, filters);
  }

  // User Profile Update APIs
  async updateUserBasicInfo(userId: string, data: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    panNumber?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/basic-info`, data);
  }

  async updateUserSalaryDate(userId: string, salaryDate: string | null): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/salary-date`, { salaryDate });
  }

  // Bank Statement Verification APIs
  async getBankStatement(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/bank-statement/${userId}`);
  }

  async triggerBankStatementVerification(userId: string, formData: FormData | null): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('adminToken');
    const headers: HeadersInit = {
      'Authorization': token ? `Bearer ${token}` : '',
    };

    // If formData is provided, include it (for backward compatibility)
    // Otherwise, send empty body (backend will use existing file)
    const body = formData || undefined;

    const response = await fetch(`/api/admin/bank-statement/${userId}/verify-with-file`, {
      method: 'POST',
      headers,
      body
    });
    return response.json();
  }

  async checkBankStatementStatus(userId: string, statementId?: number): Promise<ApiResponse<any>> {
    if (statementId) {
      return this.request('POST', `/bank-statement/${userId}/check-status/${statementId}`);
    }
    return this.request('POST', `/bank-statement/${userId}/check-status`);
  }

  async fetchBankStatementReport(userId: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/bank-statement/${userId}/fetch-report`);
  }

  async updateBankStatementDecision(userId: string, decision: 'approved' | 'rejected', notes?: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/bank-statement/${userId}/update-decision`, { decision, notes });
  }

  async startBankStatementUpload(userId: string, options?: { institution_id?: number; start_month?: string; end_month?: string }): Promise<ApiResponse<any>> {
    return this.request('POST', `/bank-statement/${userId}/start-upload`, options || {});
  }

  async startBankStatementUploadForStatement(userId: string, statementId: number, options?: { institution_id?: number; start_month?: string; end_month?: string }): Promise<ApiResponse<any>> {
    return this.request('POST', `/bank-statement/${userId}/start-upload/${statementId}`, options || {});
  }

  async addNewBankStatement(userId: string, options?: { institution_id?: number; start_month?: string; end_month?: string; bank_name?: string }): Promise<ApiResponse<any>> {
    return this.request('POST', `/bank-statement/${userId}/add-new`, options || {});
  }

  async addNewBankStatementFromUser(userId: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/bank-statement/${userId}/add-new-from-user`);
  }

  async completeBankStatementUpload(userId: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/bank-statement/${userId}/complete-upload`);
  }

  async downloadBankStatementReport(userId: string, statementId: number, format: 'json' | 'xlsx' = 'json'): Promise<Blob> {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`/api/admin/bank-statement/${userId}/download-report/${statementId}?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to download report');
    }

    return response.blob();
  }

  async uploadFileForStatement(userId: string, statementId: number, file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`/api/admin/bank-statement/${userId}/upload-file/${statementId}`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload file');
    }

    return response.json();
  }

  async updateUserContactInfo(userId: string, data: {
    email?: string;
    phone?: string;
    alternatePhone?: string;
    personalEmail?: string;
    officialEmail?: string;
    companyEmail?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/contact-info`, data);
  }

  async updateUserAddressInfo(userId: string, data: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/address-info`, data);
  }

  async addUserAddress(userId: string, data: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
    address_type?: 'current' | 'permanent' | 'office';
    is_primary?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/addresses`, data);
  }

  async updateUserAddress(userId: string, addressId: number, data: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
    address_type?: 'current' | 'permanent' | 'office';
    is_primary?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/addresses/${addressId}`, data);
  }

  async updateUserLoanPlan(userId: string, planId: number): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/loan-plan`, { plan_id: planId });
  }

  async updateUserLoanLimit(userId: string, loanLimit: number): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/loan-limit`, { loanLimit });
  }

  async updateUserEmploymentInfo(userId: string, data: {
    company?: string;
    companyName?: string;
    designation?: string;
    industry?: string;
    department?: string;
    monthlyIncome?: number | null;
    income?: number | null;
    workExperience?: number | null;
  }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/employment-info`, data);
  }

  async triggerReKYC(userId: string): Promise<ApiResponse<{ userId: string; rekyc_required: boolean }>> {
    return this.request('POST', `/user-profile/${userId}/trigger-rekyc`, {});
  }

  async resetSelfieVerification(userId: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/reset-selfie-verification`, {});
  }

  // Activity Logs Methods
  async getRecentActivities(limit = 10, filters: any = {}): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...filters
    });
    return this.request('GET', `/activities/recent?${params}`);
  }

  async getActivityStats(period = '24h'): Promise<ApiResponse<any>> {
    return this.request('GET', `/activities/stats?period=${period}`);
  }

  async getActivityTypes(): Promise<ApiResponse<any>> {
    return this.request('GET', '/activities/types');
  }
  // User Configuration
  async getUserConfig(): Promise<ApiResponse<{
    default_credit_score: { id: number; value: string; description: string; updated_at: string };
    credit_limit_multiplier: { id: number; value: string; description: string; updated_at: string };
    min_credit_score: { id: number; value: string; description: string; updated_at: string };
    max_credit_score: { id: number; value: string; description: string; updated_at: string };
    credit_score_update_frequency: { id: number; value: string; description: string; updated_at: string };
  }>> {
    return this.request('GET', '/settings/user-config');
  }

  async updateUserConfig(configs: {
    default_credit_score?: { value: string; description?: string };
    credit_limit_multiplier?: { value: string; description?: string };
    min_credit_score?: { value: string; description?: string };
    max_credit_score?: { value: string; description?: string };
    credit_score_update_frequency?: { value: string; description?: string };
  }): Promise<ApiResponse<Array<{
    key: string;
    value: string;
    description: string;
  }>>> {
    return this.request('PUT', '/settings/user-config', { configs });
  }

  async calculateCreditLimit(userId: string, monthlySalary: number): Promise<ApiResponse<{
    userId: number;
    monthlySalary: number;
    creditLimitMultiplier: number;
    calculatedCreditLimit: number;
    calculation: string;
  }>> {
    return this.request('GET', `/settings/user-config/calculate-credit-limit?userId=${userId}&monthlySalary=${monthlySalary}`);
  }

  // SMS Configuration Management
  async getSmsConfigs(): Promise<ApiResponse<Array<{
    id: number;
    config_name: string;
    provider: string;
    api_url: string;
    api_key: string;
    username: string;
    password: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
    created_at: string;
    updated_at: string;
  }>>> {
    return this.request('GET', '/settings/sms-configs');
  }

  async updateSmsConfig(id: number, configData: {
    config_name: string;
    provider: string;
    api_url: string;
    api_key: string;
    username: string;
    password: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('PUT', `/settings/sms-configs/${id}`, configData);
  }

  async testSmsConfig(configId: number, testNumber: string, testMessage: string): Promise<ApiResponse<{
    config_name: string;
    test_number: string;
    test_message: string;
    timestamp: string;
  }>> {
    return this.request('POST', '/settings/test-sms', {
      config_id: configId,
      test_number: testNumber,
      test_message: testMessage
    });
  }

  // Email Configuration Management
  async getEmailConfigs(): Promise<ApiResponse<Array<{
    id: number;
    config_name: string;
    provider: string;
    host: string;
    port: number;
    encryption: 'tls' | 'ssl' | 'none';
    username: string;
    password: string;
    from_email: string;
    from_name: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
    created_at: string;
    updated_at: string;
  }>>> {
    return this.request('GET', '/settings/email-configs');
  }

  async updateEmailConfig(id: number, configData: {
    config_name: string;
    provider: string;
    host: string;
    port: number;
    encryption: 'tls' | 'ssl' | 'none';
    username: string;
    password: string;
    from_email: string;
    from_name: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('PUT', `/settings/email-configs/${id}`, configData);
  }

  async testEmailConfig(configId: number, testEmail: string, testSubject: string, testMessage: string): Promise<ApiResponse<{
    config_name: string;
    test_email: string;
    test_subject: string;
    test_message: string;
    timestamp: string;
  }>> {
    return this.request('POST', '/settings/test-email', {
      config_id: configId,
      test_email: testEmail,
      test_subject: testSubject,
      test_message: testMessage
    });
  }

  // Cloud Configuration Management
  async getCloudConfigs(): Promise<ApiResponse<Array<{
    id: number;
    config_name: string;
    provider: 'aws' | 'gcp' | 'azure';
    bucket_name: string;
    access_key: string;
    secret_key: string;
    region: string;
    base_url: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
    created_at: string;
    updated_at: string;
  }>>> {
    return this.request('GET', '/settings/cloud-configs');
  }

  async updateCloudConfig(id: number, configData: {
    config_name: string;
    provider: 'aws' | 'gcp' | 'azure';
    bucket_name: string;
    access_key: string;
    secret_key: string;
    region: string;
    base_url: string;
    status: 'active' | 'inactive';
    is_primary: boolean;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('PUT', `/settings/cloud-configs/${id}`, configData);
  }

  // Eligibility Configuration Management
  async getEligibilityConfig(): Promise<ApiResponse<{
    min_monthly_salary: { id: number; value: string; description: string; data_type: string; updated_at: string };
    allowed_payment_modes: { id: number; value: string; description: string; data_type: string; updated_at: string };
    hold_period_days: { id: number; value: string; description: string; data_type: string; updated_at: string };
    required_employment_types: { id: number; value: string; description: string; data_type: string; updated_at: string };
    min_age_years: { id: number; value: string; description: string; data_type: string; updated_at: string };
    max_age_years: { id: number; value: string; description: string; data_type: string; updated_at: string };
  }>> {
    return this.request('GET', '/settings/eligibility-config');
  }

  async updateEligibilityConfig(configs: {
    min_monthly_salary?: { value: string; description?: string };
    allowed_payment_modes?: { value: string; description?: string };
    hold_period_days?: { value: string; description?: string };
    required_employment_types?: { value: string; description?: string };
    min_age_years?: { value: string; description?: string };
    max_age_years?: { value: string; description?: string };
  }): Promise<ApiResponse<Array<{
    key: string;
    value: string;
    description: string;
  }>>> {
    return this.request('PUT', '/settings/eligibility-config', { configs });
  }

  // ==================== Loan Limit Tiers APIs ====================

  /**
   * Get all loan limit tiers
   */
  async getLoanTiers(): Promise<any> {
    return this.request('GET', '/loan-tiers');
  }

  /**
   * Get single loan tier by ID
   */
  async getLoanTier(id: string | number): Promise<any> {
    return this.request('GET', `/loan-tiers/${id}`);
  }

  /**
   * Create new loan tier
   */
  async createLoanTier(data: {
    tier_name: string;
    min_salary: number;
    max_salary?: number | null;
    loan_limit: number;
    is_active?: boolean;
    tier_order: number;
  }): Promise<any> {
    return this.request('POST', '/loan-tiers', data);
  }

  /**
   * Update existing loan tier
   */
  async updateLoanTier(id: string | number, data: {
    tier_name: string;
    min_salary: number;
    max_salary?: number | null;
    loan_limit: number;
    is_active?: boolean;
    tier_order: number;
  }): Promise<any> {
    return this.request('PUT', `/loan-tiers/${id}`, data);
  }

  /**
   * Delete loan tier
   */
  async deleteLoanTier(id: string | number): Promise<any> {
    return this.request('DELETE', `/loan-tiers/${id}`);
  }

  /**
   * Toggle loan tier active status
   */
  async toggleLoanTier(id: string | number): Promise<any> {
    return this.request('PATCH', `/loan-tiers/${id}/toggle`);
  }

  // ==================== Loan Plans APIs ====================

  /**
   * Get all loan plans
   */
  async getLoanPlans(): Promise<any> {
    return this.request('GET', '/loan-plans');
  }

  /**
   * Get single loan plan by ID
   */
  async getLoanPlan(id: string | number): Promise<any> {
    return this.request('GET', `/loan-plans/${id}`);
  }

  /**
   * Create new loan plan
   */
  async createLoanPlan(data: {
    plan_name: string;
    plan_code: string;
    plan_type: 'single' | 'multi_emi';
    repayment_days?: number;
    calculate_by_salary_date?: boolean;
    emi_frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    emi_count?: number;
    interest_percent_per_day?: number;
    eligible_member_tiers?: string[];
    eligible_employment_types?: string[];
    is_active?: boolean;
    description?: string;
    terms_conditions?: string;
  }): Promise<any> {
    return this.request('POST', '/loan-plans', data);
  }

  /**
   * Update existing loan plan
   */
  async updateLoanPlan(id: string | number, data: any): Promise<any> {
    return this.request('PUT', `/loan-plans/${id}`, data);
  }

  /**
   * Delete loan plan
   */
  async deleteLoanPlan(id: string | number): Promise<any> {
    return this.request('DELETE', `/loan-plans/${id}`);
  }

  /**
   * Toggle loan plan active status
   */
  async toggleLoanPlan(id: string | number): Promise<any> {
    return this.request('PATCH', `/loan-plans/${id}/toggle`);
  }

  /**
   * Set loan plan as default
   */
  async setDefaultLoanPlan(id: string | number): Promise<any> {
    return this.request('PATCH', `/loan-plans/${id}/set-default`);
  }

  // ==================== Loan Calculations APIs ====================

  /**
   * Get complete loan calculation for a loan
   */
  async getLoanCalculation(loanId: string | number, options?: {
    customDays?: number;
    calculationDate?: string;
  }): Promise<any> {
    const params: any = {};
    if (options?.customDays !== undefined) {
      params.customDays = options.customDays;
    }
    if (options?.calculationDate) {
      params.calculationDate = options.calculationDate;
    }
    return this.request('GET', `/loan-calculations/${loanId}`, undefined, params);
  }

  /**
   * Assign/Update loan plan for an existing loan application
   */
  async assignLoanPlanToApplication(applicationId: string | number, planId: number): Promise<any> {
    return this.request('PUT', `/applications/${applicationId}/loan-plan`, { plan_id: planId });
  }

  /**
   * Get late penalties for a loan plan
   */
  async getLoanPlanLatePenalties(planId: string | number): Promise<any> {
    return this.request('GET', `/loan-plans/${planId}/late-penalties`);
  }

  /**
   * Create late penalty tier for a loan plan
   */
  async createLoanPlanLatePenalty(planId: string | number, data: {
    days_overdue_start: number;
    days_overdue_end: number | null;
    penalty_percent: number;
    tier_order: number;
  }): Promise<any> {
    return this.request('POST', `/loan-plans/${planId}/late-penalties`, data);
  }

  /**
   * Update late penalty tier for a loan plan
   */
  async updateLoanPlanLatePenalty(planId: string | number, penaltyId: string | number, data: {
    days_overdue_start: number;
    days_overdue_end: number | null;
    penalty_percent: number;
    tier_order: number;
  }): Promise<any> {
    return this.request('PUT', `/loan-plans/${planId}/late-penalties/${penaltyId}`, data);
  }

  /**
   * Delete late penalty tier for a loan plan
   */
  async deleteLoanPlanLatePenalty(planId: string | number, penaltyId: string | number): Promise<any> {
    return this.request('DELETE', `/loan-plans/${planId}/late-penalties/${penaltyId}`);
  }

  /**
   * Get fees assigned to a loan plan
   */
  async getLoanPlanFees(planId: string | number): Promise<any> {
    return this.request('GET', `/loan-plans/${planId}/fees`);
  }

  /**
   * Assign fee to loan plan
   */
  async assignFeeToLoanPlan(planId: string | number, data: {
    fee_type_id: number;
    fee_percent: number;
  }): Promise<any> {
    return this.request('POST', `/loan-plans/${planId}/fees`, data);
  }

  /**
   * Remove fee from loan plan
   */
  async removeFeeFromLoanPlan(planId: string | number, feeId: string | number): Promise<any> {
    return this.request('DELETE', `/loan-plans/${planId}/fees/${feeId}`);
  }

  // ==================== Late Fee Tiers APIs ====================

  /**
   * Get late fee tiers for a member tier
   */
  async getLateFees(memberTierId: string | number): Promise<any> {
    return this.request('GET', `/late-fees/${memberTierId}`);
  }

  /**
   * Create new late fee tier
   */
  async createLateFee(data: {
    member_tier_id: number;
    tier_name: string;
    days_overdue_start: number;
    days_overdue_end?: number | null;
    fee_type: 'percentage' | 'fixed';
    fee_value: number;
    tier_order: number;
  }): Promise<any> {
    return this.request('POST', '/late-fees', data);
  }

  /**
   * Update late fee tier
   */
  async updateLateFee(id: string | number, data: any): Promise<any> {
    return this.request('PUT', `/late-fees/${id}`, data);
  }

  /**
   * Delete late fee tier
   */
  async deleteLateFee(id: string | number): Promise<any> {
    return this.request('DELETE', `/late-fees/${id}`);
  }

  // Validation APIs - using direct axios calls since these routes are not under /api/admin
  async getValidationOptions(type?: string): Promise<ApiResponse<any>> {
    try {
      const endpoint = type ? `/api/validation/options/${type}` : '/api/validation/options';
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async addValidationOption(data: { name: string; type: string }): Promise<ApiResponse<any>> {
    try {
      const response = await axios.post('/api/validation/options', data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async submitValidationAction(data: {
    userId: number;
    loanApplicationId?: number;
    actionType: string;
    actionDetails: any;
    adminId: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await axios.post('/api/validation/submit', data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getValidationHistory(userId: number, loanApplicationId?: number): Promise<ApiResponse<any>> {
    try {
      const params = loanApplicationId ? `?loanApplicationId=${loanApplicationId}` : '';
      const response = await axios.get(`/api/validation/history/${userId}${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getValidationStatus(userId: number, loanApplicationId?: number): Promise<ApiResponse<any>> {
    try {
      const params = loanApplicationId ? `?loanApplicationId=${loanApplicationId}` : '';
      const response = await axios.get(`/api/validation/status/${userId}${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async updateValidationStatus(userId: number, data: any): Promise<ApiResponse<any>> {
    try {
      const response = await axios.put(`/api/validation/status/${userId}`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  // Loan Calculations API

  async updateLoanCalculation(loanId: number, data: { processing_fee_percent?: number; interest_percent_per_day?: number }): Promise<ApiResponse<any>> {
    try {
      const response = await axios.put(`/api/loan-calculations/${loanId}`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async updateLoanAmount(applicationId: string, data: { loan_amount?: number; principalAmount?: number }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/applications/${applicationId}/amount`, {
      loan_amount: data.loan_amount || data.principalAmount,
      principalAmount: data.principalAmount || data.loan_amount
    });
  }

  async calculateLoanPreview(data: { loan_amount: number; processing_fee_percent: number; interest_percent_per_day: number; days: number }): Promise<ApiResponse<any>> {
    try {
      const response = await axios.post('/api/loan-calculations/calculate', data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getLoanDays(loanId: number): Promise<ApiResponse<any>> {
    try {
      const response = await axios.get(`/api/loan-calculations/${loanId}/days`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  // KFS (Key Facts Statement) API
  async getKFS(loanId: number): Promise<ApiResponse<any>> {
    try {
      const response = await axios.get(`/api/kfs/${loanId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async generateKFSPDF(loanId: number, htmlContent: string): Promise<Blob> {
    try {
      const response = await axios.post(`/api/kfs/${loanId}/generate-pdf`, { htmlContent }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        responseType: 'blob'
      });

      // Check if response is actually a PDF (blob with PDF content type)
      if (response.headers['content-type']?.includes('application/pdf')) {
        return response.data;
      }

      // If not PDF, might be an error message - try to parse it
      if (response.headers['content-type']?.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || errorData.error || 'Failed to generate PDF');
      }

      return response.data;
    } catch (error: any) {
      // If error response is a blob (JSON error sent as blob), try to parse it
      if (error.response?.data instanceof Blob && error.response.status === 500) {
        try {
          const errorText = await error.response.data.text();
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || errorData.error || 'Failed to generate PDF');
        } catch (parseError) {
          // If parsing fails, use original error
          console.error('Error parsing error response:', parseError);
        }
      }

      this.handleAuthError(error);
      throw error;
    }
  }

  async downloadBankStatementExcel(txnId: string): Promise<Blob> {
    try {
      const response = await axios.post('/api/bank-statement/download-excel', { txn_id: txnId }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async emailKFSPDF(loanId: number, htmlContent: string, recipientEmail: string, recipientName: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/kfs/${loanId}/email-pdf`, {
      htmlContent,
      recipientEmail,
      recipientName
    });
  }

  /**
   * Get Extension Letter data
   */
  async getExtensionLetter(loanId: number, transactionId?: number, extensionNumber?: number): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (transactionId) params.append('transactionId', transactionId.toString());
      if (extensionNumber) params.append('extensionNumber', extensionNumber.toString());

      const queryString = params.toString();
      const url = `/api/kfs/${loanId}/extension-letter${queryString ? `?${queryString}` : ''}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Get pending extension requests
   */
  async getPendingExtensions(page: number = 1, limit: number = 20): Promise<ApiResponse<any>> {
    // Base URL is /api/admin, route is /loan-extensions/pending
    // Full path: /api/admin/loan-extensions/pending
    return this.request('GET', `/loan-extensions/pending`, undefined, { page, limit });
  }

  /**
   * Approve extension request
   */
  async approveExtension(extensionId: number, referenceNumber?: string): Promise<ApiResponse<any>> {
    // Base URL is /api/admin, route is /loan-extensions/:extensionId/approve
    // Full path: /api/admin/loan-extensions/:extensionId/approve
    return this.request('POST', `/loan-extensions/${extensionId}/approve`, {
      reference_number: referenceNumber
    });
  }

  /**
   * Reject extension request
   */
  async rejectExtension(extensionId: number, rejectionReason?: string): Promise<ApiResponse<any>> {
    // Base URL is /api/admin, route is /loan-extensions/:extensionId/reject
    // Full path: /api/admin/loan-extensions/:extensionId/reject
    return this.request('POST', `/loan-extensions/${extensionId}/reject`, {
      rejection_reason: rejectionReason
    });
  }

  /**
   * Get NOC (No Dues Certificate) data
   */
  async getNOC(loanId: number): Promise<ApiResponse<any>> {
    try {
      const response = await axios.get(`/api/kfs/${loanId}/noc`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Generate Extension Letter PDF
   */
  async generateExtensionLetterPDF(loanId: number, htmlContent: string, transactionId?: number, extensionNumber?: number): Promise<Blob> {
    try {
      const response = await axios.post(`/api/kfs/${loanId}/extension-letter/generate-pdf`, {
        htmlContent,
        transactionId,
        extensionNumber
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        responseType: 'blob'
      });

      // Check if response is actually a PDF (blob with PDF content type)
      if (response.headers['content-type']?.includes('application/pdf')) {
        return response.data;
      }

      // If not PDF, might be an error message - try to parse it
      if (response.headers['content-type']?.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || errorData.error || 'Failed to generate PDF');
      }

      return response.data;
    } catch (error: any) {
      // If error response is a blob (JSON error sent as blob), try to parse it
      if (error.response?.data instanceof Blob && error.response.status === 500) {
        try {
          const errorText = await error.response.data.text();
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || errorData.error || 'Failed to generate PDF');
        } catch (parseError) {
          // If parsing fails, use original error
          console.error('Error parsing error response:', parseError);
        }
      }

      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Generate NOC PDF
   */
  async generateNOCPDF(loanId: number, htmlContent: string): Promise<Blob> {
    try {
      const response = await axios.post(`/api/kfs/${loanId}/noc/generate-pdf`, {
        htmlContent
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        responseType: 'blob'
      });

      // Check if response is actually a PDF (blob with PDF content type)
      if (response.headers['content-type']?.includes('application/pdf')) {
        return response.data;
      }

      // If not PDF, might be an error message - try to parse it
      if (response.headers['content-type']?.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || errorData.error || 'Failed to generate PDF');
      }

      return response.data;
    } catch (error: any) {
      // If error response is a blob (JSON error sent as blob), try to parse it
      if (error.response?.data instanceof Blob && error.response.status === 500) {
        try {
          const errorText = await error.response.data.text();
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || errorData.error || 'Failed to generate PDF');
        } catch (parseError) {
          // If parsing fails, use original error
          console.error('Error parsing error response:', parseError);
        }
      }

      this.handleAuthError(error);
      throw error;
    }
  }

  async getUserCreditAnalytics(userId: number): Promise<ApiResponse<any>> {
    try {
      const response = await axios.get(`/api/admin/users/${userId}/credit-analytics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async performCreditCheck(userId: number, forceRefetch: boolean = false): Promise<ApiResponse<any>> {
    try {
      const response = await axios.post(`/api/admin/users/${userId}/perform-credit-check`, { force: forceRefetch }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  // Loan Application Documents API
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
    try {
      const response = await axios.get(`/api/admin/loan-documents/${loanApplicationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getLoanDocumentUrl(documentId: number): Promise<ApiResponse<{
    url: string;
    expires_in: number;
  }>> {
    try {
      const token = localStorage.getItem('adminToken');
      // Use the user endpoint (admin can access it with admin token)
      const response = await axios.get(`/api/loan-documents/${documentId}/url`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async search(query: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/search?q=${encodeURIComponent(query)}`);
  }

  // ==================== Team Management APIs ====================

  /**
   * Get all team members (paginated)
   */
  async getTeamMembers(page: number = 1, limit: number = 50, filters?: {
    role?: string;
    search?: string;
  }): Promise<ApiResponse<{
    admins: Array<{
      id: string;
      name: string;
      email: string;
      role: 'superadmin' | 'manager' | 'officer';
      permissions: string[];
      is_active: boolean;
      last_login?: string;
      created_at: string;
      updated_at: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    return this.request('GET', '/team', undefined, {
      page,
      limit,
      ...filters
    });
  }

  /**
   * Get team statistics
   */
  async getTeamStats(): Promise<ApiResponse<{
    total: number;
    superadmin: number;
    manager: number;
    officer: number;
    active: number;
    inactive: number;
  }>> {
    return this.request('GET', '/team/stats');
  }

  /**
   * Get single team member details
   */
  async getTeamMember(id: string): Promise<ApiResponse<{
    admin: {
      id: string;
      name: string;
      email: string;
      role: 'superadmin' | 'manager' | 'officer';
      permissions: string[];
      is_active: boolean;
      last_login?: string;
      created_at: string;
      updated_at: string;
    };
  }>> {
    return this.request('GET', `/team/${id}`);
  }

  /**
   * Get team member activity log
   */
  async getTeamMemberActivity(id: string, limit: number = 50): Promise<ApiResponse<{
    activities: Array<{
      id: string;
      action: string;
      type: string;
      metadata: any;
      timestamp: string;
      priority: string;
      ip_address?: string;
      user_agent?: string;
    }>;
    stats: {
      today: number;
      week: number;
      month: number;
    };
  }>> {
    return this.request('GET', `/team/${id}/activity`, undefined, { limit });
  }

  // ==================== Partner Management APIs ====================

  /**
   * Get all partners (admin)
   */
  async getPartners(): Promise<ApiResponse<{
    partners: Array<{
      id: number;
      partner_uuid: string;
      client_id: string;
      name: string;
      email: string | null;
      public_key_path: string | null;
      allowed_ips: string | null;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>;
  }>> {
    return this.request('GET', '/partners');
  }

  /**
   * Get single partner
   */
  async getPartner(id: number): Promise<ApiResponse<{
    id: number;
    partner_uuid: string;
    client_id: string;
    name: string;
    email: string | null;
    public_key_path: string | null;
    allowed_ips: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
  }>> {
    return this.request('GET', `/partners/${id}`);
  }

  /**
   * Create new partner
   */
  async createPartner(data: {
    client_id: string;
    client_secret: string;
    name: string;
    email?: string;
    public_key_path?: string;
    public_key_pem?: string;
    allowed_ips?: string;
  }): Promise<ApiResponse<{ id: number; partner_uuid: string; client_id: string; name: string; email: string | null; is_active: boolean }>> {
    return this.request('POST', '/partners', data);
  }

  /**
   * Update partner
   */
  async updatePartner(id: number, data: {
    name?: string;
    email?: string;
    public_key_path?: string;
    public_key_pem?: string;
    allowed_ips?: string;
    is_active?: boolean;
    client_secret?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/partners/${id}`, data);
  }

  /**
   * Get partner leads (admin view)
   */
  async getPartnerLeads(partnerId: number, params?: {
    page?: number;
    limit?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<{
    partner: { id: number; name: string; client_id: string };
    leads: Array<{
      id: number;
      first_name: string;
      last_name: string;
      mobile_number: string;
      pan_number: string | null;
      dedupe_status: string;
      dedupe_code: number;
      lead_shared_at: string;
      user_registered_at: string | null;
      loan_application_id: number | null;
      loan_status: string | null;
      disbursed_at: string | null;
      disbursal_amount: number | null;
      payout_eligible: number | null;
      payout_amount: number | null;
      payout_grade: string | null;
      payout_status: string | null;
      user_id: number | null;
      email: string | null;
      application_number: string | null;
    }>;
    pagination: { page: number; limit: number; total: number; total_pages: number };
  }>> {
    return this.request('GET', `/partners/${partnerId}/leads`, undefined, params);
  }

  /**
   * Create new team member
   */
  async createTeamMember(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    permissions?: string[];
    phone?: string;
    department?: string;
    sub_admin_category?: string | null;
    whitelisted_ip?: string | null;
  }): Promise<ApiResponse<{
    admin: {
      id: string;
      name: string;
      email: string;
      role: 'superadmin' | 'manager' | 'officer';
      permissions: string[];
      is_active: boolean;
      last_login?: string;
      created_at: string;
      updated_at: string;
    };
  }>> {
    return this.request('POST', '/team', data);
  }

  /**
   * Update team member
   */
  async updateTeamMember(id: string, data: {
    name?: string;
    email?: string;
    role?: string;
    permissions?: string[];
    phone?: string;
    department?: string;
    is_active?: boolean;
    sub_admin_category?: string | null;
    whitelisted_ip?: string | null;
    weekly_off_days?: number[] | string | null;
    temp_inactive_from?: string | null;
    temp_inactive_to?: string | null;
  }): Promise<ApiResponse<{
    admin: {
      id: string;
      name: string;
      email: string;
      role: 'superadmin' | 'manager' | 'officer';
      permissions: string[];
      is_active: boolean;
      last_login?: string;
      created_at: string;
      updated_at: string;
    };
  }>> {
    return this.request('PUT', `/team/${id}`, data);
  }

  /**
   * Toggle team member status (activate/deactivate)
   */
  async toggleTeamMemberStatus(id: string): Promise<ApiResponse<{
    is_active: boolean;
  }>> {
    return this.request('PATCH', `/team/${id}/status`);
  }

  /**
   * Update team member permissions
   */
  async updateTeamMemberPermissions(id: string, permissions: string[]): Promise<ApiResponse<any>> {
    return this.request('PUT', `/team/${id}/permissions`, { permissions });
  }

  /**
   * Delete team member
   */
  async deleteTeamMember(id: string): Promise<ApiResponse<any>> {
    return this.request('DELETE', `/team/${id}`);
  }

  /**
   * Redistribute assignments for a sub-admin category (verify_user, qa_user, account_manager, recovery_officer).
   * Splits all relevant loans across all active sub-admins of that category.
   */
  async redistributeSubAdminAssignments(category: string): Promise<ApiResponse<{ message: string }>> {
    return this.request('POST', '/team/redistribute', { category });
  }

  /**
   * Get current admin's profile (for leave settings).
   */
  async getMyAdminProfile(): Promise<ApiResponse<{ admin: any }>> {
    return this.request('GET', '/team/me');
  }

  /**
   * Update current admin's own weekly off and leave. Sub-admins only (except debt_agency).
   */
  async updateMyLeave(data: {
    weekly_off_days?: number[] | string | null;
    temp_inactive_from?: string | null;
    temp_inactive_to?: string | null;
  }): Promise<ApiResponse<{ admin: any; message: string }>> {
    return this.request('PUT', '/team/me/leave', data);
  }

  // Policies Management
  async getPolicies(): Promise<ApiResponse<any[]>> {
    const response = await axios.get('/api/policies');
    return response.data;
  }

  async getPolicy(id: number): Promise<ApiResponse<any>> {
    const response = await axios.get(`/api/policies/${id}`);
    return response.data;
  }

  async createPolicy(formData: FormData): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('adminToken');
    const response = await axios.post('/api/policies', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      },
    });
    return response.data;
  }

  async updatePolicy(id: number, formData: FormData): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('adminToken');
    const response = await axios.put(`/api/policies/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      },
    });
    return response.data;
  }

  async deletePolicy(id: number): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('adminToken');
    const response = await axios.delete(`/api/policies/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  }

  // Payout Management APIs
  // Note: Payout routes are under /api/payout (not /api/admin), but still require admin auth
  async getReadyForDisbursementLoans(): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/payout/ready-for-disbursement', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async disburseLoan(loanApplicationId: string): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post('/api/payout/disburse-loan', { loanApplicationId }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getTransferStatus(transferId: string): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`/api/payout/transfer-status/${transferId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getPayoutDetails(loanApplicationId: string): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`/api/payout/loan/${loanApplicationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  // Cooling Period Users
  async getCoolingPeriodUsers(page: number = 1, limit: number = 20, search: string = ''): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/users/cooling-period/list', {
        params: { page, limit, search },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  // Registered Users (just completed OTP step)
  async getRegisteredUsers(page: number = 1, limit: number = 20, search: string = ''): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/users/registered/list', {
        params: { page, limit, search },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  // Approved Users (completed 2nd page and moved to next step)
  async getApprovedUsers(page: number = 1, limit: number = 20, search: string = ''): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/users/approved/list', {
        params: { page, limit, search },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  // Cron Management
  async getCronStatus(): Promise<ApiResponse<any>> {
    return this.request('GET', '/cron/status');
  }

  async getCronTaskStatus(taskName: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/cron/task/${taskName}`);
  }

  async runCronTask(taskName: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/cron/task/${taskName}/run`);
  }

  async enableCronTask(taskName: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/cron/task/${taskName}/enable`);
  }

  async disableCronTask(taskName: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/cron/task/${taskName}/disable`);
  }

  async getCronLogs(): Promise<ApiResponse<any>> {
    return this.request('GET', '/cron/logs');
  }

  async getCronLogByDate(date: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/cron/logs/${date}`);
  }

  async deleteCronLogs(days?: number, date?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    if (date) params.append('date', date);
    return this.request('DELETE', `/cron/logs?${params.toString()}`);
  }

  // QA Verification Users (loans pending QA verification)
  async getQAVerificationUsers(page: number = 1, limit: number = 20, search: string = ''): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/users/qa-verification/list', {
        params: { page, limit, search },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Get users with loans in Account Manager status (account_manager or overdue)
   */
  async getAccountManagerUsers(page: number = 1, limit: number = 20, search: string = ''): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get('/api/admin/users/account-manager/list', {
        params: { page, limit, search },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * UAN Basic V3 API Method (Admin version - synchronous API)
   */
  async getUANBasic(userId: string, data: { mobile: string }): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post('/api/digitap/uan/admin/basic', { userId, ...data }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Get stored UAN data for a user (Admin version)
   */
  async getStoredUANData(userId: string): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`/api/digitap/uan/admin/stored/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }
}

// Export singleton instance
export const adminApiService = new AdminApiService();
export default adminApiService;
