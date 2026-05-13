from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db
from routes.auth import get_current_user
from routes.database_query import _ensure_tables

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

STAGES = ["new", "contacted", "call", "demo", "proposal", "won", "lost"]


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"]

    # Prospects by stage
    stage_counts = db.execute(text("""
        SELECT pipeline_stage, COUNT(*) as count
        FROM prospects WHERE user_id = :uid
        GROUP BY pipeline_stage
    """), {"uid": uid}).fetchall()
    prospects_by_stage = {s: 0 for s in STAGES}
    total_prospects = 0
    for row in stage_counts:
        if row[0] in prospects_by_stage:
            prospects_by_stage[row[0]] = row[1]
        total_prospects += row[1]

    # Pipeline value by stage (sum of active quotes)
    pipeline_rows = db.execute(text("""
        SELECT p.pipeline_stage, COALESCE(SUM(q.amount), 0) as value
        FROM prospects p
        LEFT JOIN quotes q ON q.prospect_id = p.id AND q.status IN ('sent', 'viewed', 'accepted')
        WHERE p.user_id = :uid
        GROUP BY p.pipeline_stage
    """), {"uid": uid}).fetchall()
    pipeline_value_by_stage = {s: 0.0 for s in STAGES}
    for row in pipeline_rows:
        if row[0] in pipeline_value_by_stage:
            pipeline_value_by_stage[row[0]] = float(row[1])
    total_pipeline_value = sum(pipeline_value_by_stage.values())

    # pipeline_by_stage array for frontend chart
    pipeline_by_stage = [
        {"stage": s, "count": prospects_by_stage[s], "value": pipeline_value_by_stage[s]}
        for s in STAGES
    ]

    # Inactive prospects (no activity in last 14 days)
    inactive_rows = db.execute(text("""
        SELECT p.id, p.first_name, p.last_name, p.company,
               MAX(a.activity_date) as last_activity_date
        FROM prospects p
        LEFT JOIN activities a ON a.prospect_id = p.id
        WHERE p.user_id = :uid AND p.pipeline_stage NOT IN ('won', 'lost')
        GROUP BY p.id, p.first_name, p.last_name, p.company
        HAVING MAX(a.activity_date) < NOW() - INTERVAL '14 days' OR MAX(a.activity_date) IS NULL
        ORDER BY last_activity_date ASC NULLS FIRST
        LIMIT 10
    """), {"uid": uid}).fetchall()
    inactive_prospects = [
        {
            "id": r[0],
            "first_name": r[1],
            "last_name": r[2],
            "company": r[3],
            "last_activity_date": r[4].isoformat() if r[4] else None,
        }
        for r in inactive_rows
    ]

    # Expiring quotes (next 7 days, still 'sent')
    expiring_rows = db.execute(text("""
        SELECT q.id, q.title, p.first_name || ' ' || p.last_name as prospect_name,
               q.amount, q.expiry_date
        FROM quotes q
        JOIN prospects p ON p.id = q.prospect_id
        WHERE q.user_id = :uid AND q.status = 'sent'
          AND q.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY q.expiry_date ASC
    """), {"uid": uid}).fetchall()
    expiring_quotes_list = [
        {
            "id": r[0],
            "title": r[1],
            "prospect_name": r[2],
            "amount": float(r[3]) if r[3] else 0,
            "expiry_date": r[4].isoformat() if r[4] else None,
        }
        for r in expiring_rows
    ]

    # Active demos count
    active_demos = db.execute(text(
        "SELECT COUNT(*) FROM demos WHERE user_id = :uid AND status IN ('queued', 'in_build')"
    ), {"uid": uid}).scalar()

    return {
        "total_prospects": total_prospects,
        "pipeline_value": total_pipeline_value,
        "active_demos": int(active_demos),
        "expiring_quotes": len(expiring_quotes_list),
        "pipeline_by_stage": pipeline_by_stage,
        "inactive_prospects": inactive_prospects,
        "expiring_quotes_list": expiring_quotes_list,
    }
