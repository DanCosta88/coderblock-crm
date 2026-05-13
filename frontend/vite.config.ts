import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

// Read optional template-specific dependency overrides (e.g. Three.js, Phaser)
// Templates needing extra deps provide a vite.overrides.json in the project root.
// This file IS synced from S3 (unlike vite.config.ts which is excluded from sync).
let extraIncludes: string[] = []
let extraDedupe: string[] = []
try {
  const overrides = JSON.parse(readFileSync('./vite.overrides.json', 'utf-8'))
  extraIncludes = overrides.optimizeDeps?.include || []
  extraDedupe = overrides.resolve?.dedupe || []
} catch {
  // No overrides file — standard template, no extra deps needed
}

// https://vitejs.dev/config/
// IMPORTANT: This config is used for both local dev AND Fly.io previews
// HMR_HOST env var is set by Fly.io preview server
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    dedupe: ['react', 'react-dom', ...extraDedupe]
  },
  // CRITICAL: Disable automatic dependency discovery to prevent esbuild OOM
  // All common deps are pre-installed in the base image
  optimizeDeps: {
    // Don't scan for new dependencies at runtime (prevents esbuild OOM)
    noDiscovery: true,
    // Pre-include all common dependencies used in our templates
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'lucide-react',
      'motion',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'sonner',
      'react-hook-form',
      '@hookform/resolvers',
      'zod',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      '@ag-ui/core',
      ...extraIncludes
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5173,  // Nginx proxy expects Vite on 5173
    strictPort: true,
    allowedHosts: true,
    // NOTE: Headers are set by Nginx proxy, not here (to avoid duplicates)
    // headers: {},
    hmr: process.env.HMR_HOST ? {
      host: process.env.HMR_HOST,
      clientPort: 443,
      protocol: 'wss'
    } : false,
    watch: {
      usePolling: true,
      interval: 1000
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
