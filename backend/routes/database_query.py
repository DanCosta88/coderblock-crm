from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db
from routes.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/database", tags=["database"])


class SchemaOperation(BaseModel):
    operation: str
    sql: Optional[str] = None


_TABLES_CREATED = False


def _ensure_tables(db: Session):
    global _TABLES_CREATED
    if _TABLES_CREATED:
        return

    db.execute(text("""
        CREATE TABLE IF NOT EXISTS prospects (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(100),
            company VARCHAR(255),
            website VARCHAR(500),
            industry VARCHAR(255),
            macro_category VARCHAR(255),
            linkedin_url VARCHAR(500),
            source VARCHAR(50) DEFAULT 'other',
            icp_score INTEGER DEFAULT 2,
            notes TEXT,
            pipeline_stage VARCHAR(50) DEFAULT 'new',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    db.execute(text("""
        CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            prospect_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            activity_type VARCHAR(100) NOT NULL,
            outcome VARCHAR(255),
            author VARCHAR(255) DEFAULT 'Danilo',
            activity_date TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    db.execute(text("""
        CREATE TABLE IF NOT EXISTS demos (
            id SERIAL PRIMARY KEY,
            prospect_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            demo_type VARCHAR(100) NOT NULL,
            brief TEXT,
            status VARCHAR(50) DEFAULT 'queued',
            deadline TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    db.execute(text("""
        CREATE TABLE IF NOT EXISTS quotes (
            id SERIAL PRIMARY KEY,
            prospect_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            service_description TEXT,
            amount DECIMAL(12,2),
            currency VARCHAR(3) DEFAULT '€',
            status VARCHAR(50) DEFAULT 'draft',
            send_date TIMESTAMPTZ,
            expiry_date TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_prospects_user ON prospects(user_id)
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(pipeline_stage)
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_activities_prospect ON activities(prospect_id)
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_demos_user ON demos(user_id)
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id)
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_quotes_prospect ON quotes(prospect_id)
    """))

    db.commit()
    _TABLES_CREATED = True


@router.post("/query")
async def database_query(op: SchemaOperation, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if op.operation == "schema":
        _ensure_tables(db)
        return {"ok": True, "message": "Schema ensured"}
    if op.sql:
        result = db.execute(text(op.sql))
        db.commit()
        rows = result.fetchall() if result.returns_rows else []
        return {"ok": True, "rows": [dict(r._mapping) for r in rows]}
    raise HTTPException(status_code=400, detail="Invalid operation")
