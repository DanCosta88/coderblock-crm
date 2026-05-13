"""
Application Configuration
Centralized settings management with Pydantic V2
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    IMPORTANT: Uses extra="allow" to accept any .env variables,
    preventing crashes from undefined settings.
    """

    # Application
    APP_NAME: str = "Fullstack API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS - Allow specific origins for WebContainer preview and deployed apps
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Custom domain support - set via environment when user configures custom domain
    # Example: CUSTOM_DOMAIN=mybusiness.com
    CUSTOM_DOMAIN: str = ""
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",      # Local Vite dev server
        "http://localhost:5174",      # Alternative Vite port
        "https://coderblock.ai",      # Production platform
        "https://www.coderblock.ai",  # Production platform (www)
        # Deployed apps (*.coderblock.dev, *.coderblock.app) are handled via allow_origin_regex in main.py
        # Custom domains are added dynamically in main.py based on CUSTOM_DOMAIN env var
    ]

    # Database (PostgreSQL/Aurora)
    # IMPORTANT: On Fly.io, DATABASE_URL is set automatically via postgres attach
    # This default is only for local development
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/dbname"

    # PostgreSQL Schema Isolation
    # Each project gets its own schema in the shared database
    # Format: cb_<project_id> (e.g., cb_e350e2bd)
    # Set automatically by Fly.io deployment
    POSTGRES_SCHEMA: str = "public"

    # Database pool — small values are REQUIRED for NeonDB PgBouncer (transaction mode).
    # Large pools saturate PgBouncer and cause 504 Gateway Timeouts.
    DB_POOL_SIZE: int = 3
    DB_MAX_OVERFLOW: int = 2

    # AWS Configuration (optional)
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # Security
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Email Verification (Brevo)
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "noreply@coderblock.ai"
    BREVO_SENDER_NAME: str = "Coderblock App"

    # Logging
    LOG_LEVEL: str = "INFO"

    # Pydantic V2 configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"  # CRITICAL: Allows extra .env variables without crashing
    )


# Global settings instance
settings = Settings()
