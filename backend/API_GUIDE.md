# API Guide - Backend Template

## 📚 API Documentation

Your FastAPI backend automatically generates interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs` (or your deployed URL + `/docs`)
- **ReDoc**: `http://localhost:8000/redoc`

These endpoints are **automatically generated** from your FastAPI code and provide:
- Interactive API testing
- Request/response schemas
- Authentication requirements
- Example requests and responses

## 🔌 Available Endpoints

### Health Check
- **GET** `/health`
- Returns backend status, version, and metrics
- Used by frontend to test connection
- No authentication required
- **Note**: In deployed apps with Nginx, access via `/api/health` (Nginx proxies `/api` → backend)

### Root
- **GET** `/`
- Basic API information
- Links to documentation

### Items (Example CRUD)
- **GET** `/items` - List all items
- **POST** `/items` - Create new item
- **GET** `/items/{id}` - Get specific item
- **PUT** `/items/{id}` - Update item
- **DELETE** `/items/{id}` - Delete item
- **Note**: In deployed apps with Nginx, access via `/api/items` (Nginx adds `/api` prefix)

## 🎯 How to Add New Endpoints

### 1. Create a new router file in `routes/`

```python
# routes/users.py
from fastapi import APIRouter

# ⚠️ IMPORTANT: Do NOT include "/api" in prefix
# Nginx adds "/api" automatically in deployed apps
router = APIRouter(prefix="/users", tags=["users"])

@router.get("")
async def list_users():
    return {"users": []}
```

### 2. Register the router in `main.py`

```python
# main.py
from routes import users_router

app.include_router(users_router)
```

### 3. Documentation is automatically updated!

Visit `/docs` to see your new endpoints.

## 🌐 CORS Configuration

CORS is pre-configured to allow requests from:
- Your frontend URL (set in `FRONTEND_URL` env var)
- Additional origins in `ALLOWED_ORIGINS`

In production, this is automatically set during deployment.

## 🔐 Adding Authentication

The template uses simple patterns. To add auth:

1. Create `routes/auth.py` with login/register endpoints
2. Use FastAPI dependencies for protected routes
3. See FastAPI docs for JWT or OAuth2 examples

## 🧪 Testing APIs

### Using the Interactive Docs
1. Visit `http://localhost:8000/docs`
2. Click on any endpoint
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"

### Using curl
```bash
# Health check (local dev - direct to backend)
curl http://localhost:8000/health

# Health check (deployed - via Nginx proxy)
curl https://your-app.coderblock.dev/api/health

# List items (local dev)
curl http://localhost:8000/items

# List items (deployed)
curl https://your-app.coderblock.dev/api/items

# Create item (local dev)
curl -X POST http://localhost:8000/items \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "description": "Test item"}'
```

### Using Frontend
The template frontend already includes an API client in `src/services/api.ts`:

```typescript
import { apiClient } from './services/api'

// GET request
const items = await apiClient.get('/items')

// POST request
const newItem = await apiClient.post('/items', { title: 'New' })
```

## 🚀 Production URLs

When deployed, your API will be available at:
- **App URL**: `https://cb-{projectid}.coderblock.dev`
- **API Docs**: `https://cb-{projectid}.coderblock.dev/docs`
- **API Endpoints**: `https://cb-{projectid}.coderblock.dev/api/*`

The frontend automatically uses the correct URL via the `VITE_API_URL` environment variable set during deployment.

## 🔀 Nginx Proxy Routing (Deployed Apps)

**IMPORTANT**: In deployed apps, Nginx sits in front of your backend and handles routing:

```
Client Request:          https://your-app.coderblock.dev/api/items
                                    ↓
Nginx (port 8080):      Receives /api/items
                                    ↓
Nginx proxy_pass:       Forwards to http://localhost:8000/items
                                    ↓
FastAPI Backend:        Router prefix="/items" receives request
                                    ↓
Final Route:            GET /items (NOT /api/items)
```

**Why this matters:**
- ✅ **Backend routers should NOT include `/api` prefix**
- ✅ **Nginx adds `/api` automatically via proxy configuration**
- ❌ **Including `/api` in router prefix creates double prefix: `/api/api/items`**

**Example:**
```python
# ✅ CORRECT - Nginx will add /api
router = APIRouter(prefix="/items", tags=["items"])

# ❌ WRONG - Creates /api/api/items
router = APIRouter(prefix="/api/items", tags=["items"])
```

## 📝 Best Practices

1. **DO NOT use `/api/` prefix** in router definitions - Nginx adds it automatically
2. **Use proper HTTP methods**: GET (read), POST (create), PUT/PATCH (update), DELETE (remove)
3. **Return appropriate status codes**: 200 (OK), 201 (Created), 404 (Not Found), etc.
4. **Use Pydantic models** for request/response validation
5. **Add docstrings** to endpoints - they appear in `/docs`
6. **Keep routers modular** - one router per resource type

## 🐛 Debugging

### Check if backend is running
```bash
# Local development
curl http://localhost:8000/health

# Deployed app (via Nginx)
curl https://your-app.coderblock.dev/api/health
```

### Check logs
Backend logs are printed to console when running locally.

### Common Issues

**CORS errors**: Make sure `FRONTEND_URL` is set correctly in `.env`

**Database errors**: Check `DATABASE_URL` in `.env` and ensure database is running

**Import errors**: Make sure all dependencies are installed: `pip install -r requirements.txt`
