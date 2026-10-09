from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db
from rules import BLOOD_GROUPS, EXPIRY_WARNING_DAYS, LOW_STOCK_LIMIT, can_receive_from, CAN_DONATE_TO, expiry_for
from security import current_user, require_role

router = APIRouter(prefix="/api", tags=["Inventory"])


class UnitIn(BaseModel):
    blood_group: str
    collected_on: Optional[str] = None
    donor_id: Optional[int] = None


def mark_expired(db):
    db.execute(
        "UPDATE blood_units SET status = 'expired' WHERE status = 'available' AND expiry_date < ?",
        (date.today().isoformat(),),
    )
    db.commit()


@router.get("/inventory/summary")
def inventory_summary(user=Depends(current_user), db=Depends(get_db)):
    mark_expired(db)
    today = date.today()
    soon = (today + timedelta(days=EXPIRY_WARNING_DAYS)).isoformat()
    result = []
    for group in BLOOD_GROUPS:
        available = db.execute(
            "SELECT COUNT(*) FROM blood_units WHERE blood_group = ? AND status = 'available'", (group,)
        ).fetchone()[0]
        expiring = db.execute(
            "SELECT COUNT(*) FROM blood_units WHERE blood_group = ? AND status = 'available' AND expiry_date <= ?",
            (group, soon),
        ).fetchone()[0]
        result.append(
            {
                "blood_group": group,
                "available": available,
                "expiring_soon": expiring,
                "low_stock": available < LOW_STOCK_LIMIT,
            }
        )
    return result


@router.get("/inventory/units")
def list_units(
    status: Optional[str] = None,
    blood_group: Optional[str] = None,
    user=Depends(require_role("admin")),
    db=Depends(get_db),
):
    mark_expired(db)
    sql = (
        "SELECT b.*, u.name AS donor_name FROM blood_units b "
        "LEFT JOIN donors d ON d.id = b.donor_id LEFT JOIN users u ON u.id = d.user_id WHERE 1=1"
    )
    params = []
    if status:
        sql += " AND b.status = ?"
        params.append(status)
    if blood_group:
        sql += " AND b.blood_group = ?"
        params.append(blood_group)
    sql += " ORDER BY b.expiry_date LIMIT 300"
    return [dict(r) for r in db.execute(sql, params).fetchall()]


@router.post("/inventory/units")
def add_unit(data: UnitIn, user=Depends(require_role("admin")), db=Depends(get_db)):
    if data.blood_group not in BLOOD_GROUPS:
        raise HTTPException(400, "Select a valid blood group")
    try:
        collected = date.fromisoformat(data.collected_on) if data.collected_on else date.today()
    except ValueError:
        raise HTTPException(400, "Invalid collection date")
    if collected > date.today():
        raise HTTPException(400, "Collection date cannot be in the future")
    if data.donor_id is not None:
        donor = db.execute("SELECT blood_group FROM donors WHERE id = ?", (data.donor_id,)).fetchone()
        if not donor:
            raise HTTPException(404, "Donor not found")
        if donor["blood_group"] != data.blood_group:
            raise HTTPException(400, "Donor blood group does not match the unit")
        db.execute("UPDATE donors SET last_donation_date = ? WHERE id = ?", (collected.isoformat(), data.donor_id))
    cur = db.execute(
        "INSERT INTO blood_units (blood_group, donor_id, collected_on, expiry_date) VALUES (?, ?, ?, ?)",
        (data.blood_group, data.donor_id, collected.isoformat(), expiry_for(collected).isoformat()),
    )
    db.commit()
    return {"id": cur.lastrowid}


@router.delete("/inventory/units/{unit_id}")
def delete_unit(unit_id: int, user=Depends(require_role("admin")), db=Depends(get_db)):
    unit = db.execute("SELECT status FROM blood_units WHERE id = ?", (unit_id,)).fetchone()
    if not unit:
        raise HTTPException(404, "Unit not found")
    if unit["status"] == "issued":
        raise HTTPException(400, "Issued units cannot be removed")
    db.execute("DELETE FROM blood_units WHERE id = ?", (unit_id,))
    db.commit()
    return {"ok": True}


@router.get("/compatibility/{group}")
def compatibility(group: str, user=Depends(current_user)):
    group = group.upper()
    if group not in BLOOD_GROUPS:
        raise HTTPException(404, "Unknown blood group")
    return {
        "blood_group": group,
        "can_donate_to": CAN_DONATE_TO[group],
        "can_receive_from": can_receive_from(group),
    }


@router.get("/stats")
def dashboard_stats(user=Depends(require_role("admin")), db=Depends(get_db)):
    mark_expired(db)
    one = lambda sql, p=(): db.execute(sql, p).fetchone()[0]

    months = []
    today = date.today().replace(day=1)
    for i in range(5, -1, -1):
        year = today.year + (today.month - 1 - i) // 12
        month = (today.month - 1 - i) % 12 + 1
        months.append((year, month))
    monthly = []
    for year, month in months:
        prefix = f"{year:04d}-{month:02d}"
        count = one("SELECT COUNT(*) FROM blood_units WHERE collected_on LIKE ?", (prefix + "%",))
        monthly.append({"month": prefix, "donations": count})

    return {
        "donors": one("SELECT COUNT(*) FROM donors"),
        "hospitals": one("SELECT COUNT(*) FROM hospitals"),
        "units_available": one("SELECT COUNT(*) FROM blood_units WHERE status = 'available'"),
        "units_issued": one("SELECT COUNT(*) FROM blood_units WHERE status = 'issued'"),
        "pending_requests": one("SELECT COUNT(*) FROM requests WHERE status = 'pending'"),
        "fulfilled_requests": one("SELECT COUNT(*) FROM requests WHERE status = 'fulfilled'"),
        "upcoming_camps": one("SELECT COUNT(*) FROM camps WHERE camp_date >= ?", (date.today().isoformat(),)),
        "monthly_donations": monthly,
    }
