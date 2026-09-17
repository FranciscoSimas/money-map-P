import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Safe storage wrapper to handle localStorage locks gracefully
const createSafeStorage = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  // Check if localStorage is available with retry logic
  let isAvailable = true;
  let retryCount = 0;
  const maxRetries = 3;
  
  const checkAvailability = (): boolean => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // Retry on abort errors (concurrent access)
        retryCount++;
        if (retryCount < maxRetries) {
          // Wait a bit and retry
          setTimeout(() => checkAvailability(), 50);
          return true; // Assume available for now
        }
      }
      isAvailable = false;
      console.warn('LocalStorage is not available:', e);
      return false;
    }
  };
  
  checkAvailability();

  return {
    getItem: (key: string): string | null => {
      if (!isAvailable) return null;
      try {
        return localStorage.getItem(key);
      } catch (error) {
        if (error instanceof DOMException) {
          if (error.name === 'AbortError') {
            // Operation was aborted - likely due to concurrent access
            // Return null gracefully instead of throwing
            console.warn('LocalStorage getItem aborted (concurrent access):', key);
            return null;
          }
          if (error.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded:', error);
            return null;
          }
        }
        console.warn('Error reading from localStorage:', error);
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      if (!isAvailable) return;
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        if (error instanceof DOMException) {
          if (error.name === 'AbortError') {
            // Operation was aborted - likely due to concurrent access
            // Don't retry, just log and continue silently
            // Supabase will retry on its own if needed
            return;
          }
          if (error.name === 'QuotaExceededError') {
            try {
              // Clear old Supabase auth data
              const keys = Object.keys(localStorage);
              keys.forEach(k => {
                if (k.startsWith('sb-') && (k.includes('auth-token') || k.includes('auth'))) {
                  try {
                    localStorage.removeItem(k);
                  } catch (e) {
                    // Ignore errors when clearing
                  }
                }
              });
              // Retry once after clearing
              localStorage.setItem(key, value);
            } catch (retryError) {
              console.error('Failed to clear and retry localStorage:', retryError);
            }
            return;
          }
        }
        console.warn('Error writing to localStorage:', error);
      }
    },
    removeItem: (key: string): void => {
      if (!isAvailable) return;
      try {
        localStorage.removeItem(key);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Operation was aborted - don't throw, just log
          console.warn('LocalStorage removeItem aborted (concurrent access):', key);
          return;
        }
        console.warn('Error removing from localStorage:', error);
      }
    },
  };
};

// Create a singleton instance to avoid multiple initializations
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error('Missing Supabase environment variables');
      throw new Error('Missing Supabase configuration');
    }

    const safeStorage = createSafeStorage();

    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: safeStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'x-client-info': 'money-map-p',
        },
      },
    });
  }
  return supabaseInstance;
})();