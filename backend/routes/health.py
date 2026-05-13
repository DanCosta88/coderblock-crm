"""
Health Check Router
API endpoints for health monitoring
"""
import logging

from fastapi import APIRouter
from datetime import datetime
from sqlalchemy import text

from core.config import settings
from core.database import engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("", summary="Root endpoint")
async def root():
    """
    Root endpoint - Basic API information.
    """
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "health": "/api/health"
    }


def _check_database() -> dict:
    """Real database connectivity probe.

    Runs ``SELECT 1`` against the project's NeonDB. Reports the actual
    state so /api/health is a trustworthy signal during debugging
    instead of a hardcoded "connected" lie.

    On auth failure surfaces ``error: "auth_failed"`` so the agent /
    operator immediately sees the difference between "DB unreachable"
    and "DB password is wrong" — which is the root cause of an
    embarrassing class of bugs where /api/auth/* returns 500 while the
    in-memory /api/items happily keeps responding 200.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"connected": True}
    except Exception as exc:
        msg = str(exc).lower()
        if "password authentication failed" in msg or "role" in msg and "does not exist" in msg:
            error_kind = "auth_failed"
        elif "could not translate host name" in msg or "name or service not known" in msg:
            error_kind = "dns_failed"
        elif "connection refused" in msg or "no route to host" in msg:
            error_kind = "connection_refused"
        elif "timeout" in msg:
            error_kind = "timeout"
        elif "ssl" in msg:
            error_kind = "ssl_failed"
        else:
            error_kind = "other"
        logger.error(f"[health] database probe failed ({error_kind}): {exc}")
        return {
            "connected": False,
            "error": error_kind,
            "detail": str(exc)[:200],
        }


@router.get("/health", summary="Health check")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.

    Returns application status, version, and a real database probe.
    Useful for Fly.io health checks, monitoring, and debugging:
    when ``database.connected`` is ``false`` the ``error`` field tells
    you whether it's auth, DNS, SSL, timeout, or something else —
    saving you from chasing ghosts in routes/auth.py.
    """
    db = _check_database()

    return {
        "status": "healthy" if db["connected"] else "degraded",
        "timestamp": datetime.now().isoformat(),
        "version": settings.APP_VERSION,
        "environment": "production" if not settings.DEBUG else "development",
        "database": db,
    }
