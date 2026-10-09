from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db
from rules import check_eligibility, expiry_for
from security import current_user, donor_of, require_role

router = APIRouter(prefix="/api", tags=["Camps"])


class CampIn(BaseModel):
    title: str
    venue: str
    city: Optional[str] = None
    camp_date: str
    capacity: int = 50


@router.get("/camps")
def list_camps(upcoming_only: bool = True, user=Depends(current_user), db=Depends(get_db)):
    donor_id = None
    if user["role"] == "donor":
        donor_id = donor_of(db, user)["id"]
    sql = (
        "SELECT c.*, "
        "(SELECT COUNT(*) FROM appointments a WHERE a.camp_id = c.id AND a.status IN ('booked','completed')) AS booked, "
        "(SELECT a.status FROM appointments a WHERE a.camp_id = c.id AND a.donor_id = ?) AS my_status "
        "FROM camps c"
    )
    params = [donor_id]
    if upcoming_only:
        sql += " WHERE c.camp_date >= ?"
        params.append(date.today().isoformat())
    sql += " ORDER BY c.camp_date"
    return [dict(r) for r in db.execute(sql, params).fetchall()]


@router.post("/camps")
def create_camp(data: CampIn, user=Depends(require_role("admin")), db=Depends(get_db)):
    if not data.title.strip() or not data.venue.strip():
        raise HTTPException(400, "Title and venue are required")
    try:
        camp_date = date.fromisoformat(data.camp_date)
    except ValueError:
        raise HTTPException(400, "Enter a valid camp date")
    if camp_date < date.today():
        raise HTTPException(400, "Camp date cannot be in the past")
    if data.capacity < 1:
        raise HTTPException(400, "Capacity must be at least 1")
    cur = db.execute(
        "INSERT INTO camps (title, venue, city, camp_date, capacity) VALUES (?, ?, ?, ?, ?)",
        (data.title.strip(), data.venue.strip(), data.city, camp_date.isoformat(), data.capacity),
    )
    db.commit()
    return {"id": cur.lastrowid}


@router.delete("/camps/{camp_id}")
def delete_camp(camp_id: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    db.execute("DELETE FROM camps WHERE id = ?", (camp_id,))
    db.commit()
    return {"ok": True}


@router.get("/camps/{camp_id}/appointments")
def camp_appointments(camp_id: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    rows = db.execute(
        "SELECT a.id, a.status, u.name, d.blood_group, d.phone FROM appointments a "
        "JOIN donors d ON d.id = a.donor_id JOIN users u ON u.id = d.user_id "
        "WHERE a.camp_id = ? ORDER BY u.name",
        (camp_id,),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/camps/{camp_id}/book")
def book_camp(camp_id: int, user=Depends(require_role("donor")), db=Depends(get_db)):
    donor = donor_of(db, user)
    camp = db.execute("SELECT * FROM camps WHERE id = ?", (camp_id,)).fetchone()
    if not camp:
        raise HTTPException(404, "Camp not found")
    if camp["camp_date"] < date.today().isoformat():
        raise HTTPException(400, "This camp is already over")

    check = check_eligibility(
        donor["age"], donor["weight"], donor["last_donation_date"], donor["gender"], donor["haemoglobin"]
    )
    if not check["eligible"]:
        raise HTTPException(400, "You are not eligible to donate: " + "; ".join(check["reasons"]))

    booked = db.execute(
        "SELECT COUNT(*) FROM appointments WHERE camp_id = ? AND status IN ('booked','completed')", (camp_id,)
    ).fetchone()[0]
    if booked >= camp["capacity"]:
        raise HTTPException(400, "This camp is full")

    existing = db.execute(
        "SELECT * FROM appointments WHERE donor_id = ? AND camp_id = ?", (donor["id"], camp_id)
    ).fetchone()
    if existing and existing["status"] != "cancelled":
        raise HTTPException(400, "You have already booked this camp")
    if existing:
        db.execute("UPDATE appointments SET status = 'booked' WHERE id = ?", (existing["id"],))
    else:
        db.execute("INSERT INTO appointments (donor_id, camp_id) VALUES (?, ?)", (donor["id"], camp_id))
    db.commit()
    return {"ok": True}


@router.get("/appointments/mine")
def my_appointments(user=Depends(require_role("donor")), db=Depends(get_db)):
    donor = donor_of(db, user)
    rows = db.execute(
        "SELECT a.id, a.status, c.title, c.venue, c.city, c.camp_date FROM appointments a "
        "JOIN camps c ON c.id = a.camp_id WHERE a.donor_id = ? ORDER BY c.camp_date DESC",
        (donor["id"],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/appointments/{appointment_id}/cancel")
def cancel_appointment(appointment_id: int, user=Depends(require_role("donor")), db=Depends(get_db)):
    donor = donor_of(db, user)
    appt = db.execute(
        "SELECT * FROM appointments WHERE id = ? AND donor_id = ?", (appointment_id, donor["id"])
    ).fetchone()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    if appt["status"] != "booked":
        raise HTTPException(400, "Only booked appointments can be cancelled")
    db.execute("UPDATE appointments SET status = 'cancelled' WHERE id = ?", (appointment_id,))
    db.commit()
    return {"ok": True}


@router.post("/appointments/{appointment_id}/complete")
def complete_appointment(appointment_id: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    appt = db.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,)).fetchone()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    if appt["status"] != "booked":
        raise HTTPException(400, "Only booked appointments can be completed")
    donor = db.execute("SELECT * FROM donors WHERE id = ?", (appt["donor_id"],)).fetchone()
    today = date.today()
    db.execute(
        "INSERT INTO blood_units (blood_group, donor_id, collected_on, expiry_date) VALUES (?, ?, ?, ?)",
        (donor["blood_group"], donor["id"], today.isoformat(), expiry_for(today).isoformat()),
    )
    db.execute("UPDATE donors SET last_donation_date = ? WHERE id = ?", (today.isoformat(), donor["id"]))
    db.execute("UPDATE appointments SET status = 'completed' WHERE id = ?", (appointment_id,))
    db.commit()
    return {"ok": True}
