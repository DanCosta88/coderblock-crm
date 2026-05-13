/**
 * Analytics Hook for Coderblock Projects
 * 
 * This hook automatically tracks page views and user interactions
 * for published Coderblock projects.
 * 
 * Usage:
 * import { useAnalytics } from '../hooks/useAnalytics'
 * 
 * function App() {
 *   useAnalytics() // Call once in your root component
 *   return <div>...</div>
 * }
 */

import { useEffect, useRef } from 'react'

// Get the project ID from the URL or environment
const getProjectId = (): string | null => {
  // Check if we're on a Coderblock deployed domain
  const hostname = window.location.hostname
  
  // Extract project ID from subdomain (e.g., cb-<project_id>.coderblock.dev)
  const coderblockMatch = hostname.match(/^cb-([a-f0-9-]+)\./)
  if (coderblockMatch) {
    return coderblockMatch[1]
  }
  
  // Check for project ID in meta tag (set during build)
  const metaTag = document.querySelector('meta[name="coderblock-project-id"]')
  if (metaTag) {
    return metaTag.getAttribute('content')
  }
  
  // Check environment variable
  if (import.meta.env.VITE_PROJECT_ID) {
    return import.meta.env.VITE_PROJECT_ID as string
  }
  
  return null
}

// Generate a simple session ID
const getSessionId = (): string => {
  const stored = sessionStorage.getItem('cb_session_id')
  if (stored) return stored
  
  const newId = Math.random().toString(36).substring(2) + Date.now().toString(36)
  sessionStorage.setItem('cb_session_id', newId)
  return newId
}

// Get visitor ID (persistent)
const getVisitorId = (): string => {
  const stored = localStorage.getItem('cb_visitor_id')
  if (stored) return stored
  
  const newId = Math.random().toString(36).substring(2) + Date.now().toString(36)
  localStorage.setItem('cb_visitor_id', newId)
  return newId
}

// Analytics API endpoint
const ANALYTICS_API = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/analytics/track`
  : 'https://api.coderblock.ai/api/v1/analytics/track'

interface TrackEventOptions {
  event_type?: string
  page_path?: string
  referrer?: string
  duration?: number
  metadata?: Record<string, any>
}

// Track an event
const trackEvent = async (projectId: string, options: TrackEventOptions = {}): Promise<void> => {
  try {
    const payload = {
      project_id: projectId,
      event_type: options.event_type || 'page_view',
      page_path: options.page_path || window.location.pathname,
      referrer: options.referrer || document.referrer || null,
      duration: options.duration || 0,
      metadata: options.metadata || {}
    }
    
    // Use sendBeacon for better reliability, fallback to fetch
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_API, blob)
    } else {
      fetch(ANALYTICS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {
        // Silently ignore tracking errors
      })
    }
  } catch {
    // Silently ignore tracking errors
  }
}

/**
 * Analytics hook - automatically tracks page views
 * 
 * @param enabled - Whether analytics is enabled (default: true)
 */
export const useAnalytics = (enabled: boolean = true): void => {
  const startTimeRef = useRef<number>(Date.now())
  const trackedRef = useRef<boolean>(false)
  
  useEffect(() => {
    if (!enabled) return
    
    const projectId = getProjectId()
    if (!projectId) return
    
    // Track initial page view (only once)
    if (!trackedRef.current) {
      trackedRef.current = true
      trackEvent(projectId, {
        event_type: 'page_view',
        page_path: window.location.pathname + window.location.search
      })
    }
    
    // Track page duration on unload
    const handleUnload = () => {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
      trackEvent(projectId, {
        event_type: 'page_duration',
        duration
      })
    }
    
    // Track navigation changes
    const handlePopState = () => {
      trackEvent(projectId, {
        event_type: 'page_view',
        page_path: window.location.pathname + window.location.search
      })
    }
    
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled])
}

/**
 * Track a custom event
 * 
 * @param eventName - Name of the event
 * @param metadata - Additional event metadata
 */
export const trackCustomEvent = (eventName: string, metadata?: Record<string, any>): void => {
  const projectId = getProjectId()
  if (!projectId) return
  
  trackEvent(projectId, {
    event_type: eventName,
    page_path: window.location.pathname,
    metadata
  })
}

export default useAnalytics
