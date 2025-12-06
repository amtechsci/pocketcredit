import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types for admin API responses
export interface AdminLoginResponse {
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
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
}

class AdminApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: '/api/admin', // Direct admin API calls
      timeout: 10000,
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

    // Add response interceptor for debugging
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log('Admin API Response:', response.status, response.config.url);
        return response;
      },
      (error) => {
        console.error('Admin API Response Error:', error.response?.data || error.message);
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

  // Generic API request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.request({
        method,
        url: endpoint,
        data,
        params,
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

  async logout(): Promise<ApiResponse<any>> {
    const response = await this.request('POST', '/auth/logout');
    
    // Clear local storage and token
    this.token = null;
    this.clearAuthHeader();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    
    return response;
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

  // References Management
  async getUserReferences(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/references`);
  }

  async addReference(userId: string, referenceData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/references`, referenceData);
  }

  async updateReferenceStatus(userId: string, referenceId: string, verificationStatus: string, feedback?: string, rejectionReason?: string): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/references/${referenceId}`, { verificationStatus, feedback, rejectionReason });
  }

  // Transactions Management
  async getUserTransactions(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/transactions`);
  }

  async addTransaction(userId: string, transactionData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/transactions`, transactionData);
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

  // SMS Management
  async getUserSmsHistory(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}/sms-history`);
  }

  async sendSMS(userId: string, smsData: any): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/send-sms`, smsData);
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

  async updateUserContactInfo(userId: string, data: {
    email: string;
    phone: string;
    alternatePhone?: string;
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

  async updateUserEmploymentInfo(userId: string, data: {
    company: string;
    designation: string;
    monthlyIncome: number;
    workExperience: number;
  }): Promise<ApiResponse<any>> {
    return this.request('PUT', `/user-profile/${userId}/employment-info`, data);
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
    emi_frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    emi_count?: number;
    min_credit_score?: number;
    eligible_member_tiers?: string[];
    eligible_employment_types?: string[];
    is_active?: boolean;
    plan_order: number;
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
    const endpoint = type ? `/api/validation/options/${type}` : '/api/validation/options';
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async addValidationOption(data: { name: string; type: string }): Promise<ApiResponse<any>> {
    const response = await axios.post('/api/validation/options', data, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async submitValidationAction(data: {
    userId: number;
    loanApplicationId?: number;
    actionType: string;
    actionDetails: any;
    adminId: string;
  }): Promise<ApiResponse<any>> {
    const response = await axios.post('/api/validation/submit', data, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async getValidationHistory(userId: number, loanApplicationId?: number): Promise<ApiResponse<any>> {
    const params = loanApplicationId ? `?loanApplicationId=${loanApplicationId}` : '';
    const response = await axios.get(`/api/validation/history/${userId}${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async getValidationStatus(userId: number, loanApplicationId?: number): Promise<ApiResponse<any>> {
    const params = loanApplicationId ? `?loanApplicationId=${loanApplicationId}` : '';
    const response = await axios.get(`/api/validation/status/${userId}${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async updateValidationStatus(userId: number, data: any): Promise<ApiResponse<any>> {
    const response = await axios.put(`/api/validation/status/${userId}`, data, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  // Loan Calculations API
  async getLoanCalculation(loanId: number, days?: number): Promise<ApiResponse<any>> {
    const params = days ? `?days=${days}` : '';
    const response = await axios.get(`/api/loan-calculations/${loanId}${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async updateLoanCalculation(loanId: number, data: { processing_fee_percent?: number; interest_percent_per_day?: number }): Promise<ApiResponse<any>> {
    const response = await axios.put(`/api/loan-calculations/${loanId}`, data, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async calculateLoanPreview(data: { loan_amount: number; processing_fee_percent: number; interest_percent_per_day: number; days: number }): Promise<ApiResponse<any>> {
    const response = await axios.post('/api/loan-calculations/calculate', data, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async getLoanDays(loanId: number): Promise<ApiResponse<any>> {
    const response = await axios.get(`/api/loan-calculations/${loanId}/days`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  // KFS (Key Facts Statement) API
  async getKFS(loanId: number): Promise<ApiResponse<any>> {
    const response = await axios.get(`/api/kfs/${loanId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async generateKFSPDF(loanId: number, htmlContent: string): Promise<Blob> {
    const response = await axios.post(`/api/kfs/${loanId}/generate-pdf`, { htmlContent }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      responseType: 'blob'
    });
    return response.data;
  }

  async emailKFSPDF(loanId: number, htmlContent: string, recipientEmail: string, recipientName: string): Promise<ApiResponse<any>> {
    const response = await axios.post(`/api/kfs/${loanId}/email-pdf`, { 
      htmlContent, 
      recipientEmail, 
      recipientName 
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async getUserCreditAnalytics(userId: number): Promise<ApiResponse<any>> {
    const response = await axios.get(`/api/admin/users/${userId}/credit-analytics`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }

  async performCreditCheck(userId: number): Promise<ApiResponse<any>> {
    const response = await axios.post(`/api/admin/users/${userId}/perform-credit-check`, {}, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    return response.data;
  }
}

// Export singleton instance
export const adminApiService = new AdminApiService();
export default adminApiService;
