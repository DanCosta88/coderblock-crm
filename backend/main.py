"""
FastAPI Backend - ULTRA-SIMPLE Production Template
🚨 KEEP THIS FILE MINIMAL - Only add new routers, nothing else!

ALLOWED CHANGES:
- Import new router: from routes import new_router
- Register router: app.include_router(new_router)

FORBIDDEN CHANGES:
- Adding middleware (除了CORS)
- Adding dependencies beyond FastAPI basics
- Complex error handling
- Background tasks, websockets, etc.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import importlib

from core.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-ready FastAPI backend with modular structure",
    docs_url="/docs",
    redoc_url="/redoc",
    debug=settings.DEBUG
)

# Configure CORS
# Allow WebContainer (localhost:5173, localhost:5174), production (coderblock.ai), 
# preview apps (*.coderblock.dev) and deployed apps (*.coderblock.app)
# Also supports custom domains via CUSTOM_DOMAIN env var

# Build allowed origins list dynamically
cors_origins = settings.ALLOWED_ORIGINS + [settings.FRONTEND_URL]

# Add custom domain if configured (e.g., mybusiness.com)
if settings.CUSTOM_DOMAIN:
    custom = settings.CUSTOM_DOMAIN.strip()
    cors_origins.append(f"https://{custom}")
    cors_origins.append(f"https://www.{custom}")
    logger.info(f"🌐 CORS: Custom domain enabled: {custom}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # Wildcard regex for BOTH preview (*.coderblock.dev) AND production (*.coderblock.app)
    allow_origin_regex=r"https://.*\.(coderblock\.dev|coderblock\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Resilient auto-discovery: scan the routes/ directory for .py files and
# import each one individually.  An import error in one route file does NOT
# break any other routes (each file gets its own try/except).
#
# All routers are mounted under the /api prefix so the URL the frontend calls
# (/api/auth/login, /api/tasks, …) is the same URL the backend sees — no
# Nginx stripping, no ambiguity.
# ---------------------------------------------------------------------------
import os as _os
import pathlib as _pathlib

API_PREFIX = "/api"

def _discover_and_register_routers():
    """Scan routes/ directory, import each .py file, and register its router."""
    routes_dir = _pathlib.Path(__file__).parent / "routes"
    if not routes_dir.is_dir():
        logger.warning("⚠️  No routes/ directory found")
        return

    registered = 0
    failed = 0

    for py_file in sorted(routes_dir.glob("*.py")):
        if py_file.name.startswith("_"):
            continue

        module_name = py_file.stem
        module_path = f"routes.{module_name}"

        try:
            mod = importlib.import_module(module_path)
            router = getattr(mod, "router", None)
            if router is None:
                continue
            app.include_router(router, prefix=API_PREFIX)
            logger.info(f"✅ Registered {module_path} → {API_PREFIX}{getattr(router, 'prefix', '') or ''}")
            registered += 1
        except Exception as e:
            logger.error(f"❌ Failed to register {module_path}: {e}")
            failed += 1

    logger.info(f"📦 Router registration complete: {registered} ok, {failed} failed")

_discover_and_register_routers()


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An error occurred"
        }
    )


# Startup event
@app.on_event("startup")
async def startup_event():
    """
    Application startup with safe database initialization.

    IMPORTANT: Wraps database imports in try/except to prevent
    crashes from configuration errors.
    """
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"📝 Environment: {'Development' if settings.DEBUG else 'Production'}")
    logger.info(f"🌐 CORS enabled for: {settings.FRONTEND_URL}")
    logger.info(f"📚 API Documentation: http://{settings.HOST}:{settings.PORT}/docs")

    # Safe database connection test
    try:
        from core.database import engine
        # Test database connection
        with engine.connect() as conn:
            logger.info("✅ Database connection successful")
    except Exception as e:
        # Log error but don't crash - app can still serve /api/health endpoint
        logger.error(f"⚠️  Database connection failed: {e}")
        logger.warning("App will continue but database operations will fail")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info(f"🛑 Shutting down {settings.APP_NAME}")


# For local development
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
