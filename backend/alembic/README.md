# Database Migrations with Alembic

This project uses Alembic for database schema migrations.

## How Migrations Work

1. **Create a migration**: When you need to change the database schema (add tables, modify columns, etc.)
2. **Apply migration**: Run `alembic upgrade head` to apply pending migrations
3. **Rollback**: Run `alembic downgrade -1` to rollback the last migration

## Creating Migrations

### Auto-generate from models (recommended):
```bash
alembic revision --autogenerate -m "Add users table"
```

### Manual migration:
```bash
alembic revision -m "Add custom index"
```

## Applying Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Apply one migration at a time
alembic upgrade +1

# Apply to a specific revision
alembic upgrade <revision_id>
```

## Rollback Migrations

```bash
# Rollback one migration
alembic downgrade -1

# Rollback all migrations
alembic downgrade base

# Rollback to a specific revision
alembic downgrade <revision_id>
```

## Migration History

```bash
# Show current revision
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic history --verbose
```

## Important Notes

- Migrations run automatically on deployment (via Dockerfile or start script)
- Each project gets its own dedicated database in the shared cluster
- Database name format: `cb_<project_id>` (e.g., `cb_e350e2bd`)
- All model changes should go through migrations for version control

## Migration File Structure

```
alembic/
├── versions/           # Migration files
│   ├── 001_initial.py
│   └── 002_add_users.py
├── env.py             # Alembic environment configuration
└── script.py.mako     # Template for new migrations
```

## Example Migration

```python
"""Add users table

Revision ID: 001
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now())
    )

    op.create_index('idx_users_email', 'users', ['email'])

def downgrade():
    op.drop_index('idx_users_email', 'users')
    op.drop_table('users')
```

## AI Agent Integration

When working with the AI agent, you can request database changes like:

> "Add a users table with email and password fields"

The AI will generate the appropriate migration file in `alembic/versions/`.
After deployment, migrations are automatically applied.
