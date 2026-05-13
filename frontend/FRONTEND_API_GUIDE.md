# Frontend API Guide

## 🔌 Connecting to Backend

This template includes a pre-configured API client that handles:
- ✅ Automatic URL configuration (dev vs production)
- ✅ Prevention of double `/api/api/` prefixes
- ✅ Consistent error handling
- ✅ TypeScript support

## 📦 Using the API Client

### Import the client

```typescript
import { apiClient, API_BASE_URL } from './services/api'
```

### Make API calls

```typescript
// GET request
const items = await apiClient.get('/items')
// Calls: http://localhost:8000/api/items (dev)
// Calls: https://cb-xxx.coderblock.dev/api/items (production)

// POST request
const newItem = await apiClient.post('/items', {
  title: 'New Item',
  description: 'Item description'
})

// PUT request
const updated = await apiClient.put('/items/1', {
  title: 'Updated'
})

// DELETE request
await apiClient.delete('/items/1')
```

### With TypeScript types

```typescript
interface Item {
  id: number
  title: string
  description: string
}

// Typed response
const items = await apiClient.get<Item[]>('/items')
// items is now typed as Item[]
```

## ⚠️ Important: Never Hardcode URLs!

### ❌ WRONG
```typescript
// This breaks in production!
fetch('http://localhost:8000/api/items')
```

### ✅ CORRECT
```typescript
// This works everywhere
import { apiClient } from './services/api'
const items = await apiClient.get('/items')
```

## 🔄 How URLs Work

The API client automatically selects the right URL:

| Environment | URL Used |
|------------|----------|
| **Development** | `http://localhost:8000/api` |
| **Production** | `https://cb-{projectid}.coderblock.dev/api` |

This happens via the `VITE_API_URL` environment variable:
- In dev: Falls back to `localhost:8000/api`
- In production: Set automatically during deployment

## 🎯 Example: Complete Component

```typescript
import { useEffect, useState } from 'react'
import { apiClient } from './services/api'

interface Item {
  id: number
  title: string
  description: string
}

function ItemsList() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const data = await apiClient.get<Item[]>('/items')
        setItems(data)
      } catch (err) {
        setError('Failed to load items')
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.title}</li>
      ))}
    </ul>
  )
}
```

## 🛠️ Customizing the API Client

The client is in `src/services/api.ts`. You can extend it with:

### Authentication Headers

```typescript
export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const url = buildUrl(endpoint)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${getToken()}`, // Add auth
      }
    })
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`)
    return response.json()
  },
  // ... other methods
}
```

### Custom Error Handling

```typescript
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const url = buildUrl(endpoint)
    const response = await fetch(url)

    if (!response.ok) {
      throw new ApiError(response.status, await response.text())
    }

    return response.json()
  },
  // ... other methods
}
```

## 🧪 Testing Backend Connection

The template's `App.tsx` includes a health check example:

```typescript
const checkHealth = async () => {
  try {
    const data = await apiClient.get('/health')
    console.log('Backend connected:', data)
  } catch (err) {
    console.error('Backend connection failed:', err)
  }
}
```

Run your app and you'll see the connection status in the UI!

## 📚 Backend Documentation

Your backend automatically generates API docs at:
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

Click the "API Documentation" link in the app to view all available endpoints.

## 🐛 Troubleshooting

### "Failed to fetch" error

**Cause**: Backend not running or CORS issue

**Fix**:
1. Make sure backend is running: `cd backend && python main.py`
2. Check backend URL in browser: `http://localhost:8000/api/health`
3. Check CORS settings in backend `main.py`

### Double `/api/api/` in URLs

**Cause**: Manually adding `/api/` prefix when it's already in `API_BASE_URL`

**Fix**: The client automatically handles this! Just use:
```typescript
apiClient.get('/items')  // ✅ Correct
apiClient.get('/api/items')  // ✅ Also works (normalized)
```

### Wrong URL in production

**Cause**: `VITE_API_URL` not set during build

**Fix**: The deployment process handles this automatically. If deploying manually:
```bash
# Create .env.production
echo "VITE_API_URL=https://your-backend.com/api" > .env.production

# Build
npm run build
```

## 🚀 Deployment

When you deploy via Coderblock:
1. ✅ Backend deploys to `https://cb-{projectid}.coderblock.dev`
2. ✅ `.env.production` is auto-created with correct `VITE_API_URL`
3. ✅ Frontend is built with production URL
4. ✅ Everything just works!

No manual configuration needed! 🎉
