# Backend - Python FastAPI

Simple FastAPI backend for the fullstack application.

## Features

- ✅ FastAPI framework
- ✅ CORS enabled for frontend
- ✅ Environment variables with python-dotenv
- ✅ RESTful API endpoints
- ✅ Pydantic data validation
- ✅ In-memory database (replace with real DB)
- ✅ Auto-generated API docs

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Run development server:
```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /` - Root endpoint
- `GET /api/health` - Health check
- `GET /api/items` - Get all items
- `GET /api/items/{id}` - Get specific item
- `POST /api/items` - Create new item
- `PUT /api/items/{id}` - Update item
- `DELETE /api/items/{id}` - Delete item

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── main.py              # Main FastAPI application
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables
├── .env.example         # Environment template
└── README.md           # This file
```

## Next Steps

1. Add database (PostgreSQL, MongoDB, etc.)
2. Add authentication (JWT, OAuth)
3. Add file uploads
4. Add background tasks
5. Add WebSocket support
6. Add tests with pytest
