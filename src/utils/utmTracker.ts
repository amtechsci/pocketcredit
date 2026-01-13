/**
 * UTM Parameter Tracker
 * Captures and stores UTM parameters from URL for partner lead tracking
 */

const UTM_STORAGE_KEY = 'pocketcredit_utm_params';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/**
 * Extract UTM parameters from current URL
 */
export const extractUTMParams = (): UTMParams => {
  if (typeof window === 'undefined') {
    return {};
  }

  const urlParams = new URLSearchParams(window.location.search);
  const utmParams: UTMParams = {};

  const utm_source = urlParams.get('utm_source');
  const utm_medium = urlParams.get('utm_medium');
  const utm_campaign = urlParams.get('utm_campaign');

  if (utm_source) utmParams.utm_source = utm_source;
  if (utm_medium) utmParams.utm_medium = utm_medium;
  if (utm_campaign) utmParams.utm_campaign = utm_campaign;

  return utmParams;
};

/**
 * Store UTM parameters in localStorage
 */
export const storeUTMParams = (params: UTMParams): void => {
  if (typeof window === 'undefined') {
    return;
  }

  // Only store if we have at least utm_source
  if (params.utm_source) {
    try {
      localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(params));
      console.log('✅ UTM parameters stored:', params);
    } catch (error) {
      console.error('Error storing UTM parameters:', error);
    }
  }
};

/**
 * Get stored UTM parameters from localStorage
 */
export const getStoredUTMParams = (): UTMParams => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading stored UTM parameters:', error);
  }

  return {};
};

/**
 * Clear stored UTM parameters
 */
export const clearUTMParams = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(UTM_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing UTM parameters:', error);
  }
};

/**
 * Initialize UTM tracking - call this when app loads
 * Captures UTM params from URL and stores them
 */
export const initializeUTMTracking = (): UTMParams => {
  // Extract from URL first (if present)
  const urlParams = extractUTMParams();
  
  // If URL has UTM params, store them (overwrite existing)
  if (urlParams.utm_source) {
    storeUTMParams(urlParams);
    return urlParams;
  }
  
  // Otherwise, return stored params (if any)
  return getStoredUTMParams();
};
