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
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.request<DashboardStats>('GET', '/dashboard');
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
    return this.request<UserDetailData>('GET', `/users/${userId}`);
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

  // User Profile Management APIs
  async getUserProfile(userId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/user-profile/${userId}`);
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

  // Dashboard APIs
  async getDashboardStats(period: string = '30d'): Promise<ApiResponse<any>> {
    return this.request('GET', '/dashboard/stats', undefined, { period });
  }

  async getRecentActivity(limit: number = 10): Promise<ApiResponse<any>> {
    return this.request('GET', `/dashboard/recent-activity?limit=${limit}`);
  }

  async getChartData(period: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/dashboard/charts?period=${period}`);
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

  async addBankDetails(userId: string, data: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    branchName: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/bank-details`, data);
  }

  async addReferenceDetails(userId: string, data: {
    name: string;
    relationship: string;
    phone: string;
    email: string;
    address: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/reference-details`, data);
  }

  async uploadDocument(userId: string, data: {
    documentType: string;
    fileName: string;
    fileSize: number;
    description?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/documents`, data);
  }

  async addTransaction(userId: string, data: {
    amount: number;
    type: string;
    description: string;
    date: string;
    status: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/transactions`, data);
  }

  async addFollowUp(userId: string, data: {
    type: string;
    scheduledDate: string;
    notes: string;
    priority: string;
    status: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/follow-ups`, data);
  }

  async addNote(userId: string, data: {
    subject: string;
    note: string;
    category: string;
    priority: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/notes`, data);
  }

  async sendSMS(userId: string, data: {
    message: string;
    templateId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', `/user-profile/${userId}/sms`, data);
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
}

// Export singleton instance
export const adminApiService = new AdminApiService();
export default adminApiService;
