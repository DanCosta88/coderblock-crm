/**
 * @deprecated This file is kept for backwards compatibility.
 * The app now uses React Router - see src/router.tsx for routes.
 * 
 * If you see this component rendered, it means the router
 * is not properly configured. Check src/main.tsx
 */

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Router Not Configured
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          Please check src/main.tsx to ensure RouterProvider is used.
        </p>
      </div>
    </div>
  )
}

export default App
