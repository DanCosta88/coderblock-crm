---
{
  "session_count": 8,
  "last_compacted": "",
  "schema_version": 2
}
---

# Project Memory

## 🎯 Project Goal
Build a feature-rich B2B commercial CRM web application for sales teams with dashboard KPIs, visual pipeline management, prospect database, customer success integration, and modern trust-focused design. Must include persistent data, drag-drop Kanban interface, and free trial CTAs with full CRUD functionality.

## 🏗️ Architecture & Stack
- Auto-discovery router: backend routes auto-discovered from `routes/` folder; frontend pages from unified generation pass
- Two-column prospect detail layout with activity timeline and quote management
- Database-backed auth with session persistence (user created as 'Danilo')
['- Frontend routing uses `BrowserRouter` wrapper with `AuthProvider` context + `AppRouter` component pattern (not `createBrowserRouter`)']
['- JWT token storage: login saves to localStorage key `crm_token`, API client reads from same key']
['- CRMLayout uses fixed-height viewport pattern: root container with `h-screen overflow-hidden` prevents body scroll, main flex container with `h-full overflow-hidden` manages layout, individual sections (header, pipeline) handle their own scroll independently']

## 📦 Built Features
- 2026-05-12: Auth system - Login/register with persistent sessions
- 2026-05-12: Dashboard - KPI cards, pipeline bar chart, inactive prospects alert, expiring quotes list
- 2026-05-12: Pipeline Kanban - 7-stage drag-drop (New→Contacted→Call→Demo→Proposal→Won→Lost) with prospect cards
- 2026-05-12: Prospects Table - Full CRUD, search, stage/ICP/industry filters, sorting, CSV export
- 2026-05-12: Prospect Detail - Two-column layout with activity timeline and quotes

## ⚠️ Known Issues / TODOs
- Backend response shape for dashboard stats required reconciliation with frontend field expectations; fixed in this session
- B2B CRM build compatibility: `@hello-pangea/dnd` ESM export mismatch in Vite 5 environment (resolved via pinned versions and npm overrides)
- Resolved: PipelinePage was importing non-existent `api` function instead of `apiClient` object

## 📚 Recent Sessions
### 2026-05-12 15:15
- Built a complete B2B commercial CRM web app (Coderblock CRM) with auth, dashboard, pipeline Kanban, prospects table, and detail views
- Implemented persistent data with backend auto-discovery routing and frontend page generation
- Deployed live at https://preview-11323dae.coderblock.dev with full CRUD operations, drag-drop pipeline, search/filter/export, and activity timelines
- Resolved worker coordination and file ownership conflicts by writing critical files directly

### 2026-05-12 15:26
- Fixed import error in `DashboardPage.tsx`: changed non-existent `api` import to correct `apiClient` export
- Corrected backend `/dashboard/stats` route response shape to match frontend expectations (field name mismatches: `pipeline_value` → `total_pipeline_value`, `expiring_quotes` structure, added `first_name`/`last_name` to `inactive_prospects`)
- Dashboard component now successfully integrates with backend through properly typed API calls

### 2026-05-12 15:31
- Request: <project-context> # Build a complete B2B commercial CRM web app for a ... - Application Context  *Generated on: 2026-05-

### 2026-05-12 23:18
- Debugged Vite 5 + ESM module resolution issue with `@hello-pangea/dnd` and `use-sync-external-store` dependency
- Applied three-part fix: pinned `@hello-pangea/dnd` to v16.6.0, added npm override for `use-sync-external-store@1.2.0`, and configured Vite alias for correct shim resolution
- Identified that `vite.config.ts` is not synced from S3, requiring all module fixes in `vite.overrides.json`

### 2026-05-13 17:30
- Fixed import mismatch in `PipelinePage.tsx`: changed `api` import to `apiClient` to match actual export from `api.ts`
- Updated three API calls (`get`, `patch`, `post`) in PipelinePage to use correct `apiClient` methods
- Verified backend prospect endpoints are complete, including `PATCH /{prospect_id}/stage` for pipeline stage updates

### 2026-05-13 20:20
['- Debugged React Router configuration mismatch in `main.tsx`: was using `RouterProvider` with `createBrowserRouter` pattern but app uses `<Routes>` component', '- Corrected `main.tsx` to properly wrap app with `BrowserRouter` + `AuthProvider` + `AppRouter` component', '- Confirmed backend is complete with all routers (auth, prospects, pipeline, demos, quotes, activities, dashboard); issue was frontend-only', '- Frontend routing and auth context setup now aligned; app should load without configuration errors']

### 2026-05-13 20:52
['- Debugged JWT authentication failure: token was stored in localStorage as `crm_token` but API client was reading from `token` key', '- Fixed apiClient in `api.ts` to read from correct `crm_token` key with fallback to `token` for compatibility', "- Resolved 401 'Not authenticated' errors across all API calls (dashboard, pipeline, prospects, quotes)"]

### 2026-05-13 21:06
['- Fixed body scroll overflow by adding `h-screen overflow-hidden` to CRMLayout container and `h-full overflow-hidden` to main element', '- Changed PipelinePage pipeline container from `overflow-x-auto overflow-y-hidden` to `overflow-auto` to enable both horizontal and vertical scrolling within pipeline area only', "- Ensured '+ New Prospect' button remains fixed in top-right header bar and doesn't scroll with pipeline content"]
