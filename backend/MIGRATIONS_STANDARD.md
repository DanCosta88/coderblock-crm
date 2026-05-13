# Database Migrations Standard for AI Agents

**IMPORTANT**: When users request database schema changes, always follow this standard for creating Alembic migrations.

## Database Architecture (Schema Isolation)

**Your project uses PostgreSQL schema isolation for data security:**

- ✅ **Shared database cluster**: All Coderblock projects share one database instance
- ✅ **Project-specific schema**: Your tables live in schema `cb_<project_id>` (e.g., `cb_e350e2bd`)
- ✅ **Automatic isolation**: Alembic creates your schema automatically and runs all migrations within it
- ✅ **Complete privacy**: Other projects cannot access your data
- ✅ **Zero configuration**: `POSTGRES_SCHEMA` environment variable is set automatically

**You don't need to worry about schemas** - everything is automatic! Just write your migrations normally.

## Migration Naming Convention

- Use descriptive names in snake_case
- Include action verb: `add`, `create`, `modify`, `remove`, `alter`
- Be specific: `add_users_table` not `add_table`
- Examples:
  - `add_users_table`
  - `add_email_index_to_users`
  - `modify_items_add_price_column`
  - `create_orders_and_order_items_tables`

## Migration File Structure

All migrations go in `alembic/versions/` directory.

### Standard Template:

```python
"""<Descriptive message>

Revision ID: <auto_generated>
Revises: <previous_revision>
Create Date: <timestamp>
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = '<auto_generated>'
down_revision = '<previous_revision>'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply schema changes"""
    # Your schema changes here
    pass


def downgrade() -> None:
    """Revert schema changes"""
    # Your rollback logic here
    pass
```

## Common Operations

### 1. Creating a Table

```python
def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    # Add indexes
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_username', 'users', ['username'])


def downgrade() -> None:
    op.drop_index('idx_users_username', 'users')
    op.drop_index('idx_users_email', 'users')
    op.drop_table('users')
```

### 2. Adding Columns

```python
def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('verified_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'verified_at')
    op.drop_column('users', 'phone')
```

### 3. Creating Relationships (Foreign Keys)

```python
def upgrade() -> None:
    op.create_table(
        'posts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now())
    )

    # Foreign key constraint
    op.create_foreign_key(
        'fk_posts_user_id',  # Constraint name
        'posts',             # Source table
        'users',             # Referenced table
        ['user_id'],         # Source column
        ['id'],              # Referenced column
        ondelete='CASCADE'   # Delete posts when user is deleted
    )

    # Index for foreign key
    op.create_index('idx_posts_user_id', 'posts', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_posts_user_id', 'posts')
    op.drop_constraint('fk_posts_user_id', 'posts', type_='foreignkey')
    op.drop_table('posts')
```

### 4. Modifying Columns

```python
def upgrade() -> None:
    # Change column type
    op.alter_column('users', 'email',
                    existing_type=sa.String(100),
                    type_=sa.String(255),
                    nullable=False)

    # Add NOT NULL constraint
    op.alter_column('users', 'username',
                    existing_type=sa.String(100),
                    nullable=False)


def downgrade() -> None:
    op.alter_column('users', 'username',
                    existing_type=sa.String(100),
                    nullable=True)

    op.alter_column('users', 'email',
                    existing_type=sa.String(255),
                    type_=sa.String(100),
                    nullable=False)
```

### 5. Creating Indexes

```python
def upgrade() -> None:
    # Simple index
    op.create_index('idx_users_created_at', 'users', ['created_at'])

    # Composite index
    op.create_index('idx_posts_user_created', 'posts', ['user_id', 'created_at'])

    # Unique index
    op.create_index('idx_users_email_unique', 'users', ['email'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_users_email_unique', 'users')
    op.drop_index('idx_posts_user_created', 'posts')
    op.drop_index('idx_users_created_at', 'users')
```

### 6. PostgreSQL-specific Types

```python
from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    # JSONB column
    op.add_column('users', sa.Column('metadata', postgresql.JSONB(), nullable=True))

    # Array column
    op.add_column('users', sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True))

    # UUID column
    op.add_column('users', sa.Column('uuid', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()')))


def downgrade() -> None:
    op.drop_column('users', 'uuid')
    op.drop_column('users', 'tags')
    op.drop_column('users', 'metadata')
```

## Best Practices

### 1. Always Provide Downgrade

```python
# ✅ GOOD: Can rollback
def upgrade() -> None:
    op.create_table('users', ...)

def downgrade() -> None:
    op.drop_table('users')

# ❌ BAD: Cannot rollback
def downgrade() -> None:
    pass
```

### 2. Use Server Defaults

```python
# ✅ GOOD: Database handles defaults
sa.Column('created_at', sa.DateTime(), server_default=sa.func.now())
sa.Column('is_active', sa.Boolean(), server_default=sa.true())

# ❌ BAD: Application-level default (won't work in migrations)
sa.Column('created_at', sa.DateTime(), default=datetime.utcnow)
```

### 3. Index Foreign Keys

```python
# ✅ GOOD: Indexed for performance
op.create_foreign_key('fk_posts_user_id', 'posts', 'users', ['user_id'], ['id'])
op.create_index('idx_posts_user_id', 'posts', ['user_id'])

# ⚠️ SLOW: Foreign key without index
op.create_foreign_key('fk_posts_user_id', 'posts', 'users', ['user_id'], ['id'])
```

### 4. Use Descriptive Constraint Names

```python
# ✅ GOOD: Clear naming
op.create_foreign_key('fk_posts_user_id', 'posts', 'users', ['user_id'], ['id'])
op.create_index('idx_users_email', 'users', ['email'])

# ❌ BAD: Auto-generated names are hard to debug
op.create_foreign_key(None, 'posts', 'users', ['user_id'], ['id'])
```

### 5. Handle Nullable Correctly

```python
# When adding non-nullable column to existing table:
def upgrade() -> None:
    # Step 1: Add as nullable
    op.add_column('users', sa.Column('email', sa.String(255), nullable=True))

    # Step 2: Populate data (if needed)
    # op.execute("UPDATE users SET email = username || '@example.com'")

    # Step 3: Make non-nullable
    op.alter_column('users', 'email', nullable=False)
```

## User Request Examples

### Example 1: "Add a users table"

```python
"""Add users table for authentication

Revision ID: 001
Revises:
Create Date: 2025-11-13
"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('is_superuser', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_index('idx_users_email', 'users', ['email'])


def downgrade() -> None:
    op.drop_index('idx_users_email', 'users')
    op.drop_table('users')
```

### Example 2: "Add orders table with relationship to users"

```python
"""Add orders table with user relationship

Revision ID: 002
Revises: 001
Create Date: 2025-11-13
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_foreign_key('fk_orders_user_id', 'orders', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_index('idx_orders_user_id', 'orders', ['user_id'])
    op.create_index('idx_orders_status', 'orders', ['status'])


def downgrade() -> None:
    op.drop_index('idx_orders_status', 'orders')
    op.drop_index('idx_orders_user_id', 'orders')
    op.drop_constraint('fk_orders_user_id', 'orders', type_='foreignkey')
    op.drop_table('orders')
```

## Important Notes for AI

1. **Always create both upgrade() and downgrade()**
2. **Use server_default for timestamps and booleans**
3. **Index all foreign keys**
4. **Use descriptive names for constraints and indexes**
5. **Handle nullable columns carefully when adding to existing tables**
6. **Test migrations work before deployment**
7. **Each migration file should be atomic (one logical change)**

## Deployment

Migrations run automatically on deployment via:
```dockerfile
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app ..."]
```

This ensures the database schema is always up to date before the app starts.
