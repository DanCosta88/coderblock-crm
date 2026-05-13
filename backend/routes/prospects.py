from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db
from routes.auth import get_current_user
from routes.database_query import _ensure_tables
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import csv
import io

router = APIRouter(prefix="/prospects", tags=["prospects"])


class ProspectCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    macro_category: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: Optional[str] = "other"
    icp_score: Optional[int] = 2
    notes: Optional[str] = None
    pipeline_stage: Optional[str] = "new"


class ProspectUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    macro_category: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: Optional[str] = None
    icp_score: Optional[int] = None
    notes: Optional[str] = None
    pipeline_stage: Optional[str] = None


def row_to_dict(row):
    if row is None:
        return None
    return dict(row._mapping)


@router.get("/export/csv")
async def export_csv(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_tables(db)
    rows = db.execute(text("""
        SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.company, p.website,
               p.industry, p.macro_category, p.linkedin_url, p.source, p.icp_score,
               p.pipeline_stage, p.notes, p.created_at, p.updated_at
        FROM prospects p
        WHERE p.user_id = :uid
        ORDER BY p.created_at DESC
    """), {"uid": current_user["id"]}).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "First Name", "Last Name", "Email", "Phone", "Company",
                     "Website", "Industry", "Macro Category", "LinkedIn", "Source",
                     "ICP Score", "Stage", "Notes", "Created At", "Updated At"])
    for r in rows:
        writer.writerow(list(r))

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=prospects.csv"}
    )


@router.get("")
async def list_prospects(
    stage: Optional[str] = None,
    icp_score: Optional[int] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _ensure_tables(db)
    conditions = ["p.user_id = :uid"]
    params = {"uid": current_user["id"]}

    if stage:
        conditions.append("p.pipeline_stage = :stage")
        params["stage"] = stage
    if icp_score:
        conditions.append("p.icp_score = :icp")
        params["icp"] = icp_score
    if search:
        conditions.append("(LOWER(p.first_name || ' ' || p.last_name) LIKE :search OR LOWER(p.company) LIKE :search OR LOWER(p.email) LIKE :search)")
        params["search"] = f"%{search.lower()}%"

    where = " AND ".join(conditions)
    rows = db.execute(text(f"""
        SELECT p.*, 
               COUNT(DISTINCT a.id) as activity_count,
               MAX(q.amount) as latest_quote_amount
        FROM prospects p
        LEFT JOIN activities a ON a.prospect_id = p.id
        LEFT JOIN quotes q ON q.prospect_id = p.id
        WHERE {where}
        GROUP BY p.id
        ORDER BY p.updated_at DESC
    """), params).fetchall()

    return [row_to_dict(r) for r in rows]


@router.post("")
async def create_prospect(data: ProspectCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_tables(db)
    result = db.execute(text("""
        INSERT INTO prospects (user_id, first_name, last_name, email, phone, company, website,
            industry, macro_category, linkedin_url, source, icp_score, notes, pipeline_stage)
        VALUES (:uid, :fn, :ln, :email, :phone, :company, :website, :industry, :macro, :linkedin,
            :source, :icp, :notes, :stage)
        RETURNING *
    """), {
        "uid": current_user["id"], "fn": data.first_name, "ln": data.last_name,
        "email": data.email, "phone": data.phone, "company": data.company,
        "website": data.website, "industry": data.industry, "macro": data.macro_category,
        "linkedin": data.linkedin_url, "source": data.source, "icp": data.icp_score,
        "notes": data.notes, "stage": data.pipeline_stage
    })
    db.commit()
    return row_to_dict(result.fetchone())


@router.get("/{prospect_id}")
async def get_prospect(prospect_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.execute(text("SELECT * FROM prospects WHERE id = :id AND user_id = :uid"), {"id": prospect_id, "uid": current_user["id"]}).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Prospect not found")
    result = row_to_dict(p)

    activities = db.execute(text("SELECT * FROM activities WHERE prospect_id = :id ORDER BY activity_date DESC"), {"id": prospect_id}).fetchall()
    result["activities"] = [row_to_dict(a) for a in activities]

    quotes = db.execute(text("SELECT * FROM quotes WHERE prospect_id = :id ORDER BY created_at DESC"), {"id": prospect_id}).fetchall()
    result["quotes"] = [row_to_dict(q) for q in quotes]

    return result


@router.patch("/{prospect_id}")
async def update_prospect(prospect_id: int, data: ProspectUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    set_clauses += ", updated_at = NOW()"
    updates["id"] = prospect_id
    updates["uid"] = current_user["id"]

    result = db.execute(text(f"UPDATE prospects SET {set_clauses} WHERE id = :id AND user_id = :uid RETURNING *"), updates)
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return row_to_dict(row)


@router.patch("/{prospect_id}/stage")
async def update_stage(prospect_id: int, body: dict, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    stage = body.get("pipeline_stage")
    if not stage:
        raise HTTPException(status_code=400, detail="pipeline_stage required")
    result = db.execute(text(
        "UPDATE prospects SET pipeline_stage = :stage, updated_at = NOW() WHERE id = :id AND user_id = :uid RETURNING *"
    ), {"stage": stage, "id": prospect_id, "uid": current_user["id"]})
    db.commit()
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return row_to_dict(row)


@router.delete("/{prospect_id}")
async def delete_prospect(prospect_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM prospects WHERE id = :id AND user_id = :uid"), {"id": prospect_id, "uid": current_user["id"]})
    db.commit()
    return {"ok": True}
