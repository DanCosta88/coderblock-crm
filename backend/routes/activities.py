from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db
from routes.auth import get_current_user
from routes.database_query import _ensure_tables
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/activities", tags=["activities"])


class ActivityCreate(BaseModel):
    prospect_id: int
    activity_type: str
    outcome: Optional[str] = None
    author: Optional[str] = "Danilo"
    activity_date: Optional[datetime] = None


def row_to_dict(row):
    if row is None:
        return None
    return dict(row._mapping)


@router.get("")
async def list_activities(
    prospect_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if prospect_id:
        rows = db.execute(text("""
            SELECT a.*, p.first_name || ' ' || p.last_name as prospect_name, p.company
            FROM activities a
            JOIN prospects p ON p.id = a.prospect_id
            WHERE a.prospect_id = :pid AND p.user_id = :uid
            ORDER BY a.activity_date DESC
        """), {"pid": prospect_id, "uid": current_user["id"]}).fetchall()
    else:
        rows = db.execute(text("""
            SELECT a.*, p.first_name || ' ' || p.last_name as prospect_name, p.company
            FROM activities a
            JOIN prospects p ON p.id = a.prospect_id
            WHERE p.user_id = :uid
            ORDER BY a.activity_date DESC
            LIMIT 200
        """), {"uid": current_user["id"]}).fetchall()

    return [row_to_dict(r) for r in rows]


@router.post("")
async def create_activity(data: ActivityCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    activity_date = data.activity_date or datetime.utcnow()
    result = db.execute(text("""
        INSERT INTO activities (prospect_id, user_id, activity_type, outcome, author, activity_date)
        VALUES (:pid, :uid, :type, :outcome, :author, :date)
        RETURNING *
    """), {
        "pid": data.prospect_id, "uid": current_user["id"],
        "type": data.activity_type, "outcome": data.outcome,
        "author": data.author or "Danilo", "date": activity_date
    })
    db.commit()
    return row_to_dict(result.fetchone())


@router.delete("/{activity_id}")
async def delete_activity(activity_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("""
        DELETE FROM activities WHERE id = :id AND prospect_id IN (
            SELECT id FROM prospects WHERE user_id = :uid
        )
    """), {"id": activity_id, "uid": current_user["id"]})
    db.commit()
    return {"ok": True}
