/**
 * API Client Configuration
 *
 * CRITICAL: This is the CORRECT way to handle API URLs in Coderblock apps!
 *
 * - NEVER hardcode localhost:8000 or absolute http:// URLs in your code!
 * - ALWAYS use this apiClient for all API calls!
 *
 * How it works:
 * - Development: Uses localhost:8000/api (from .env.local fallback)
 * - Production: Uses /api (relative) — same-origin, inherits HTTPS automatically
 *
 * Example usage:
 *   import { apiClient } from '@/services/api';
 *   const items = await apiClient.get('/items');
 */

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  // In production (HTTPS page), always prefer relative /api to avoid Mixed Content
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // If the env var is relative already, use it
    if (raw.startsWith('/')) return raw;
    // If it's an absolute URL on the same host, strip to path
    try {
      const url = new URL(raw);
      if (url.hostname === window.location.hostname) {
        return url.pathname;
      }
      // Different host (cross-origin API) — force HTTPS
      url.protocol = 'https:';
      return url.toString().replace(/\/$/, '');
    } catch {
      return '/api';
    }
  }

  return raw;
}

const API_BASE_URL = resolveApiBaseUrl();

/**
 * Normalize endpoint to prevent double /api prefix
 */
function normalizeEndpoint(endpoint: string): string {
  return endpoint.startsWith('/api/') ? endpoint.substring(4) : endpoint;
}

/**
 * Build full URL from endpoint
 */
function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const normalized = normalizeEndpoint(endpoint);
  return `${API_BASE_URL}${normalized}`;
}

/**
 * Get auth headers including JWT token from localStorage
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * API client with automatic auth token injection
 *
 * Usage:
 *   apiClient.get('/items')           — auto-includes auth
 *   apiClient.post('/items', data)    — auto-includes auth
 */
export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  },

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  },

  async put<T>(endpoint: string, data: any): Promise<T> {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  },

  async patch<T>(endpoint: string, data: any): Promise<T> {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  },
};

/**
 * Callable shorthand for arbitrary HTTP methods.
 *
 * Use this when you want a single fetch-like call site with method/body in
 * an options bag (mirrors the native `fetch()` signature). Prefer the
 * typed `apiClient.get/post/...` helpers for new code.
 *
 * Usage:
 *   await api('/prospects')                                                 // GET
 *   await api('/prospects', { method: 'POST', body: JSON.stringify(data) }) // POST
 *   await api(`/prospects/${id}`, { method: 'PATCH', body: JSON.stringify({stage}) })
 *   await api(`/prospects/${id}`, { method: 'DELETE' })
 *
 * Behavior:
 *   - Auth header injected automatically (same as apiClient)
 *   - JSON Content-Type set by default; override via options.headers
 *   - 204 No Content returns undefined
 *   - Empty body returns undefined (instead of crashing on JSON.parse(''))
 */
export async function api<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = buildUrl(endpoint);
  const baseHeaders = getAuthHeaders();
  const userHeaders = (options.headers as Record<string, string> | undefined) ?? {};
  const headers = { ...baseHeaders, ...userHeaders };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}


export { API_BASE_URL };
