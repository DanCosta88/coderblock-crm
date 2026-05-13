# 🚨 ULTRA-SIMPLE BACKEND RULES

## Core Philosophy: KEEP IT SIMPLE

This backend template is designed to be **bulletproof** and **crash-proof**. Every violation of these rules increases the chance of deployment failures.

## ✅ ALLOWED (Canonical Python/FastAPI)

### Dependencies
- FastAPI, Uvicorn (core)
- Pydantic, pydantic-settings (configuration)
- SQLAlchemy, psycopg2-binary (database)
- python-dotenv (environment)
- **NOTHING ELSE**

### Code Patterns
- Simple CRUD operations
- Basic SQLAlchemy models (Column, Integer, String, Boolean, DateTime only)
- Pydantic schemas for validation
- FastAPI routers with `@router.get`, `@router.post`, etc.
- Basic try/except with HTTPException

### File Structure
```
backend/
├── main.py              # FastAPI app - DON'T MODIFY
├── core/
│   ├── config.py        # Settings - ADD defaults only
│   └── database.py      # SQLAlchemy - DON'T MODIFY
├── models/              # One model per file
│   └── item.py
├── routes/              # One route per file
│   ├── health.py
│   └── items.py
├── schemas/             # Pydantic models
│   └── item.py
└── requirements.txt     # DON'T ADD dependencies
```

## ❌ FORBIDDEN (Will Cause Crashes)

### Dependencies
- ❌ requests, httpx, aiohttp (use urllib.request if needed)
- ❌ pandas, numpy (not needed for APIs)
- ❌ redis, celery (no caching/background tasks)
- ❌ alembic (no migrations, create tables on startup)
- ❌ ANY authentication library (use simple JWT in code)

### Code Patterns
- ❌ Foreign keys, relationships, backref in models
- ❌ Complex SQL queries, subqueries, raw SQL
- ❌ Async database operations (use sync only!)
- ❌ Custom middleware
- ❌ Background tasks (@app.task)
- ❌ WebSockets
- ❌ Custom decorators, metaclasses
- ❌ Database transactions beyond basic commit/rollback

### Settings Anti-Patterns
- ❌ Using `settings.UNDEFINED_VARIABLE` (will crash!)
- ❌ Settings without default values
- ❌ Accessing attributes not defined in Settings class

## 📝 Code Examples (COPY THESE)

### Model (models/todo.py)
```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from core.database import Base
from datetime import datetime

class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # DON'T ADD: relationships, foreign keys
```

### Route (routes/todos.py)
```python
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.todo import Todo
from schemas.todo import TodoCreate, TodoResponse

router = APIRouter(prefix="/todos", tags=["todos"])

@router.get("", response_model=list[TodoResponse])
def get_todos(db: Session = Depends(get_db)):
    try:
        return db.query(Todo).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=TodoResponse, status_code=201)
def create_todo(todo: TodoCreate, db: Session = Depends(get_db)):
    try:
        db_todo = Todo(**todo.dict())
        db.add(db_todo)
        db.commit()
        db.refresh(db_todo)
        return db_todo
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
```

### Schema (schemas/todo.py)
```python
from pydantic import BaseModel
from datetime import datetime

class TodoCreate(BaseModel):
    title: str
    completed: bool = False

class TodoResponse(BaseModel):
    id: int
    title: str
    completed: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

### Main.py - Register Router
```python
# main.py - ONLY change these lines when adding new routes
from routes import health_router, items_router, todos_router  # Add import

app.include_router(health_router)
app.include_router(items_router)
app.include_router(todos_router)  # Add registration
```

## 🚨 Common Mistakes

1. **Adding Dependencies**: Don't add ANY library not in requirements.txt
2. **Using Undefined Settings**: Always check Settings class before using `settings.X`
3. **Complex Queries**: Keep queries simple - query one table at a time
4. **Async Database**: Don't use `async def` with database operations
5. **Foreign Keys**: Don't add relationships between tables

## ✅ Deployment

When you modify backend files, deployment happens **automatically**:
1. Files uploaded to S3
2. Docker image built
3. Deployed to Fly.io with PostgreSQL
4. DATABASE_URL set automatically
5. Frontend gets backend URL

No manual action needed!

## 🐛 Debugging

If backend crashes:
1. Check `flyctl logs -a <app-name>` for actual errors
2. Verify DATABASE_URL is set correctly
3. Check requirements.txt has only allowed dependencies
4. Verify Settings class has defaults for all variables
5. Ensure no foreign keys/relationships in models
