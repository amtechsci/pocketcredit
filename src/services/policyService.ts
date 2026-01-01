import axios from 'axios';

// Determine API base URL (same pattern as api.ts)
// In development, use port 3002; in production, use relative URL
const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    // In development (port 3000), use port 3002 for API
    if (port === '3000' || (hostname === 'localhost' && !port)) {
      return `http://${hostname}:3002/api`;
    }
  }
  return '/api';
})();

export interface Policy {
  id: number;
  policy_name: string;
  policy_slug: string;
  pdf_url: string | null;
  pdf_filename: string | null;
  is_active: number;
  display_order: number;
  is_system_policy?: number | boolean;
}

export interface PolicyResponse {
  status: 'success' | 'error';
  data?: Policy;
  message?: string;
}

export interface PoliciesListResponse {
  status: 'success' | 'error';
  data?: Policy[];
  message?: string;
}

/**
 * Fetch all active policies
 */
export const fetchAllPolicies = async (): Promise<Policy[]> => {
  try {
    const response = await axios.get<PoliciesListResponse>(`${API_BASE_URL}/policies`);
    if (response.data.status === 'success' && response.data.data) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error('Error fetching policies:', error);
    return [];
  }
};

/**
 * Fetch a single policy by slug (e.g., 'privacy-policy', 'terms-conditions')
 * Returns null if not found or inactive
 */
export const fetchPolicyBySlug = async (slug: string): Promise<Policy | null> => {
  try {
    const response = await axios.get<PolicyResponse>(`${API_BASE_URL}/policies/slug/${slug}`);
    if (response.data.status === 'success' && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn(`Policy with slug '${slug}' not found`);
    } else {
      console.error(`Error fetching policy '${slug}':`, error);
    }
    return null;
  }
};

/**
 * Get PDF URL for a policy by slug
 * Returns null if policy not found, inactive, or has no PDF
 */
export const getPolicyPdfUrl = async (slug: string): Promise<string | null> => {
  const policy = await fetchPolicyBySlug(slug);
  return policy?.pdf_url || null;
};

/**
 * Open policy PDF in new tab
 */
export const openPolicyPdf = async (slug: string): Promise<void> => {
  const pdfUrl = await getPolicyPdfUrl(slug);
  if (pdfUrl) {
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  } else {
    console.warn(`Policy PDF for '${slug}' is not available`);
  }
};

