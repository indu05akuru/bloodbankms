from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db
from rules import BLOOD_GROUPS, can_receive_from
from security import hospital_of, require_role

router = APIRouter(prefix="/api/requests", tags=["Blood Requests"])


class RequestIn(BaseModel):
    patient_name: str
    blood_group: str
    units: int
    urgency: str = "normal"


class FulfillIn(BaseModel):
    allow_compatible: bool = False


class RejectIn(BaseModel):
    remarks: Optional[str] = None


@router.post("")
def create_request(data: RequestIn, user=Depends(require_role("hospital")), db=Depends(get_db)):
    hospital = hospital_of(db, user)
    if not data.patient_name.strip():
        raise HTTPException(400, "Patient name is required")
    if data.blood_group not in BLOOD_GROUPS:
        raise HTTPException(400, "Select a valid blood group")
    if data.units < 1 or data.units > 20:
        raise HTTPException(400, "Units must be between 1 and 20")
    if data.urgency not in ("normal", "urgent", "critical"):
        raise HTTPException(400, "Invalid urgency")
    cur = db.execute(
        "INSERT INTO requests (hospital_id, patient_name, blood_group, units, urgency) VALUES (?, ?, ?, ?, ?)",
        (hospital["id"], data.patient_name.strip(), data.blood_group, data.units, data.urgency),
    )
    db.commit()
    return {"id": cur.lastrowid, "status": "pending"}


@router.get("/mine")
def my_requests(user=Depends(require_role("hospital")), db=Depends(get_db)):
    hospital = hospital_of(db, user)
    rows = db.execute(
        "SELECT * FROM requests WHERE hospital_id = ? ORDER BY id DESC", (hospital["id"],)
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/{request_id}/cancel")
def cancel_request(request_id: int, user=Depends(require_role("hospital")), db=Depends(get_db)):
    hospital = hospital_of(db, user)
    req = db.execute(
        "SELECT * FROM requests WHERE id = ? AND hospital_id = ?", (request_id, hospital["id"])
    ).fetchone()
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] != "pending":
        raise HTTPException(400, "Only pending requests can be cancelled")
    db.execute(
        "UPDATE requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (request_id,)
    )
    db.commit()
    return {"ok": True}


@router.get("")
def all_requests(status: Optional[str] = None, user=Depends(require_role("admin")), db=Depends(get_db)):
    sql = (
        "SELECT r.*, h.hospital_name, h.city AS hospital_city FROM requests r "
        "JOIN hospitals h ON h.id = r.hospital_id"
    )
    params = []
    if status:
        sql += " WHERE r.status = ?"
        params.append(status)
    sql += (
        " ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, "
        "CASE r.urgency WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, r.id DESC"
    )
    return [dict(r) for r in db.execute(sql, params).fetchall()]


@router.post("/{request_id}/fulfill")
def fulfill_request(request_id: int, data: FulfillIn, user=Depends(require_role("admin")), db=Depends(get_db)):
    req = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] != "pending":
        raise HTTPException(400, "This request is already processed")

    groups = [req["blood_group"]]
    if data.allow_compatible:
        groups += [g for g in can_receive_from(req["blood_group"]) if g != req["blood_group"]]

    today = date.today().isoformat()
    picked = []
    for group in groups:
        need = req["units"] - len(picked)
        if need <= 0:
            break
        rows = db.execute(
            "SELECT id FROM blood_units WHERE blood_group = ? AND status = 'available' AND expiry_date >= ? "
            "ORDER BY expiry_date LIMIT ?",
            (group, today, need),
        ).fetchall()
        picked += [r["id"] for r in rows]

    if len(picked) < req["units"]:
        raise HTTPException(
            400,
            f"Only {len(picked)} suitable unit(s) in stock, {req['units']} required",
        )

    for unit_id in picked:
        db.execute("UPDATE blood_units SET status = 'issued', request_id = ? WHERE id = ?", (request_id, unit_id))
    db.execute(
        "UPDATE requests SET status = 'fulfilled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (request_id,)
    )
    db.commit()
    return {"ok": True, "issued_units": len(picked)}


@router.post("/{request_id}/reject")
def reject_request(request_id: int, data: RejectIn, user=Depends(require_role("admin")), db=Depends(get_db)):
    req = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] != "pending":
        raise HTTPException(400, "This request is already processed")
    db.execute(
        "UPDATE requests SET status = 'rejected', remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (data.remarks, request_id),
    )
    db.commit()
    return {"ok": True}
