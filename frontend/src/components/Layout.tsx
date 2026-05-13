import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useAnalytics } from '../hooks/useAnalytics'

/**
 * Main Layout Component - Minimal Base
 *
 * This component provides:
 * - Analytics tracking (automatic)
 * - Main content area (renders child routes via Outlet)
 * - Page-level ErrorBoundary so a crash in one page doesn't blank the whole app
 *
 * 🎨 AI INSTRUCTION:
 * When building an app, CREATE custom Header and Footer components based on
 * the project requirements. DO NOT use a generic template - design them to
 * match the app's purpose, branding, and user needs.
 *
 * Examples:
 * - E-commerce: Header with cart, search, categories; Footer with policies
 * - SaaS dashboard: Minimal header with user menu; No footer needed
 * - Portfolio: Creative header with navigation; Footer with social links
 * - Blog: Header with logo and categories; Footer with newsletter signup
 *
 * Import your custom components here when created:
 * import Header from './Header'
 * import Footer from './Footer'
 *
 * ⚠️  DO NOT REMOVE the <PageErrorBoundary> wrapper around <Outlet />.
 * It converts a blank-screen/"placeholder" failure mode into a readable
 * debug panel, which is how users discover build/runtime issues.
 */

interface PageErrorBoundaryState {
  error: Error | null
  componentStack: string | null
}

class PageErrorBoundary extends Component<{ children: ReactNode }, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error, componentStack: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface into browser console so the platform's log stream captures it too.
    console.error('[PageErrorBoundary] Page crashed:', error)
    if (info.componentStack) {
      console.error('[PageErrorBoundary] Component stack:', info.componentStack)
    }
    this.setState({ error, componentStack: info.componentStack ?? null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const { error, componentStack } = this.state
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          padding: '32px 24px',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: 880, width: '100%' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              background: '#7f1d1d',
              color: '#fecaca',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f87171',
                display: 'inline-block',
              }}
            />
            Page crashed
          </div>

          <h1 style={{ fontSize: 26, margin: '0 0 8px', fontWeight: 700 }}>
            This page threw an error while rendering
          </h1>
          <p style={{ margin: '0 0 24px', color: '#cbd5e1', lineHeight: 1.55 }}>
            The rest of the app is fine — only this route failed. Your source code is still there;
            nothing has been deleted. Fix the error below and the page will hot-reload automatically.
          </p>

          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Error</div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14, color: '#fca5a5', wordBreak: 'break-word' }}>
              {error.name}: {error.message}
            </div>
          </div>

          {isDev && error.stack && (
            <details open style={{ marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
                Stack trace
              </summary>
              <pre
                style={{
                  background: '#020617',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: '#e2e8f0',
                  overflow: 'auto',
                  maxHeight: 260,
                  margin: 0,
                }}
              >
                {error.stack}
              </pre>
            </details>
          )}

          {isDev && componentStack && (
            <details style={{ marginBottom: 24 }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
                Component stack
              </summary>
              <pre
                style={{
                  background: '#020617',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: '#e2e8f0',
                  overflow: 'auto',
                  maxHeight: 220,
                  margin: 0,
                }}
              >
                {componentStack}
              </pre>
            </details>
          )}

          <button
            type="button"
            onClick={this.handleReload}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}

export default function Layout() {
  useAnalytics()

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col">
      {/*
        Add your custom Header here when created:
        <Header />
      */}

      <main className="flex-1">
        <PageErrorBoundary>
          <Outlet />
        </PageErrorBoundary>
      </main>

      {/*
        Add your custom Footer here when created:
        <Footer />
      */}
    </div>
  )
}
