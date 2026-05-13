from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db
from routes.auth import get_current_user
from routes.database_query import _ensure_tables
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/quotes", tags=["quotes"])


class QuoteCreate(BaseModel):
    prospect_id: int
    title: str
    service_description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = "€"
    status: Optional[str] = "draft"
    send_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class QuoteUpdate(BaseModel):
    title: Optional[str] = None
    service_description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    send_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


def row_to_dict(row):
    if row is None:
        return None
    return dict(row._mapping)


@router.get("")
async def list_quotes(
    prospect_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if prospect_id:
        rows = db.execute(text("""
            SELECT q.*, p.first_name || ' ' || p.last_name as prospect_name, p.company
            FROM quotes q JOIN prospects p ON p.id = q.prospect_id
            WHERE q.prospect_id = :pid AND q.user_id = :uid
            ORDER BY q.created_at DESC
        """), {"pid": prospect_id, "uid": current_user["id"]}).fetchall()
    else:
        rows = db.execute(text("""
            SELECT q.*, p.first_name || ' ' || p.last_name as prospect_name, p.company
            FROM quotes q JOIN prospects p ON p.id = q.prospect_id
            WHERE q.user_id = :uid
            ORDER BY q.created_at DESC
        """), {"uid": current_user["id"]}).fetchall()
    return [row_to_dict(r) for r in rows]


@router.post("")
async def create_quote(data: QuoteCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    result = db.execute(text("""
        INSERT INTO quotes (prospect_id, user_id, title, service_description, amount, currency, status, send_date, expiry_date)
        VALUES (:pid, :uid, :title, :desc, :amount, :currency, :status, :send, :expiry)
        RETURNING *
    """), {
        "pid": data.prospect_id, "uid": current_user["id"], "title": data.title,
        "desc": data.service_description, "amount": data.amount, "currency": data.currency or "€",
        "status": data.status or "draft", "send": data.send_date, "expiry": data.expiry_date
    })
    db.commit()
    return row_to_dict(result.fetchone())


@router.patch("/{quote_id}")
async def update_quote(quote_id: int, data: QuoteUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    set_clauses += ", updated_at = NOW()"
    updates["id"] = quote_id
    updates["uid"] = current_user["id"]
    result = db.execute(text(f"UPDATE quotes SET {set_clauses} WHERE id = :id AND user_id = :uid RETURNING *"), updates)
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Quote not found")
    return row_to_dict(row)


@router.delete("/{quote_id}")
async def delete_quote(quote_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM quotes WHERE id = :id AND user_id = :uid"), {"id": quote_id, "uid": current_user["id"]})
    db.commit()
    return {"ok": True}
