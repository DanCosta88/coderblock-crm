"""Alembic environment configuration for database migrations with schema isolation"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, text
from alembic import context

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import your models' Base
from core.database import Base
from core.config import settings

# Import all models so Alembic can detect them
from models.item import Item  # noqa: F401
# Add more model imports here as you create them

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for autogenerate support
target_metadata = Base.metadata

# Get DATABASE_URL from environment variable
database_url = os.getenv("DATABASE_URL")
if database_url:
    # Handle postgres:// vs postgresql:// URL scheme
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    config.set_main_option("sqlalchemy.url", database_url)

# Get project-specific schema name from environment
# Format: cb_<project_id> (e.g., cb_e350e2bd)
# This provides isolation between projects in the same database
POSTGRES_SCHEMA = os.getenv("POSTGRES_SCHEMA", "public")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=POSTGRES_SCHEMA,  # Store alembic_version in project schema
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with schema isolation.

    Creates project-specific schema if it doesn't exist,
    then runs migrations within that schema.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Create schema if it doesn't exist (idempotent)
        if POSTGRES_SCHEMA != "public":
            connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {POSTGRES_SCHEMA}"))
            connection.commit()
            print(f"✅ Schema '{POSTGRES_SCHEMA}' ready")

        # Set search_path to use project-specific schema
        connection.execute(text(f"SET search_path TO {POSTGRES_SCHEMA}"))
        connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=POSTGRES_SCHEMA,  # Store alembic_version in project schema
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
