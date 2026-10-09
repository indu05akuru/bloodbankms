from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from rules import BLOOD_GROUPS, CAN_DONATE_TO, LOW_STOCK_LIMIT, can_receive_from

router = APIRouter(prefix="/api/public", tags=["Public"])

FACTS = [
    "One donation can save up to three lives.",
    "Every two seconds someone needs blood.",
    "Red blood cells can be stored for only 42 days, so regular donors matter.",
    "O negative blood can be given to any patient in an emergency.",
    "You can donate again after 3 months (men) or 4 months (women).",
]


@router.get("/summary")
def public_summary(db=Depends(get_db)):
    today = date.today().isoformat()
    db.execute("UPDATE blood_units SET status = 'expired' WHERE status = 'available' AND expiry_date < ?", (today,))
    db.commit()
    groups = []
    for group in BLOOD_GROUPS:
        count = db.execute(
            "SELECT COUNT(*) FROM blood_units WHERE blood_group = ? AND status = 'available'", (group,)
        ).fetchone()[0]
        level = "out" if count == 0 else ("low" if count < LOW_STOCK_LIMIT else "ok")
        groups.append({"blood_group": group, "available": count, "level": level})
    one = lambda sql, p=(): db.execute(sql, p).fetchone()[0]
    return {
        "groups": groups,
        "donors": one("SELECT COUNT(*) FROM donors"),
        "units_available": one("SELECT COUNT(*) FROM blood_units WHERE status = 'available'"),
        "requests_fulfilled": one("SELECT COUNT(*) FROM requests WHERE status = 'fulfilled'"),
        "hospitals": one("SELECT COUNT(*) FROM hospitals"),
        "upcoming_camps": one("SELECT COUNT(*) FROM camps WHERE camp_date >= ?", (today,)),
    }


@router.get("/camps")
def public_camps(db=Depends(get_db)):
    rows = db.execute(
        "SELECT c.id, c.title, c.venue, c.city, c.camp_date, c.capacity, "
        "(SELECT COUNT(*) FROM appointments a WHERE a.camp_id = c.id AND a.status IN ('booked','completed')) AS booked "
        "FROM camps c WHERE c.camp_date >= ? ORDER BY c.camp_date LIMIT 6",
        (date.today().isoformat(),),
    ).fetchall()
    return [dict(r) for r in rows]


@router.get("/ticker")
def public_ticker(db=Depends(get_db)):
    items = []
    for r in db.execute(
        "SELECT r.units, r.blood_group, r.urgency, h.hospital_name FROM requests r "
        "JOIN hospitals h ON h.id = r.hospital_id WHERE r.status = 'pending' AND r.urgency IN ('critical', 'urgent') "
        "ORDER BY CASE r.urgency WHEN 'critical' THEN 0 ELSE 1 END, r.id DESC LIMIT 4"
    ).fetchall():
        label = "Critical" if r["urgency"] == "critical" else "Urgent"
        items.append({"type": "urgent", "text": f"{label}: {r['units']} unit(s) of {r['blood_group']} needed at {r['hospital_name']}"})

    for g in BLOOD_GROUPS:
        count = db.execute(
            "SELECT COUNT(*) FROM blood_units WHERE blood_group = ? AND status = 'available'", (g,)
        ).fetchone()[0]
        if count < LOW_STOCK_LIMIT:
            items.append({"type": "low", "text": f"Low stock: only {count} unit(s) of {g} left. Donors with {g} please come forward"})

    today = date.today()
    for c in db.execute(
        "SELECT title, venue, city, camp_date FROM camps WHERE camp_date >= ? ORDER BY camp_date LIMIT 3",
        (today.isoformat(),),
    ).fetchall():
        d = date.fromisoformat(c["camp_date"])
        days = (d - today).days
        when = "today" if days == 0 else ("tomorrow" if days == 1 else f"in {days} days ({d.strftime('%d %b')})")
        items.append({"type": "camp", "text": f"Donation camp {when}: {c['title']}, {c['venue']}, {c['city'] or ''}".rstrip(", ")})

    for f in FACTS:
        items.append({"type": "fact", "text": f})
    return items


@router.get("/compatibility/{group}")
def public_compatibility(group: str):
    group = group.upper()
    if group not in BLOOD_GROUPS:
        raise HTTPException(404, "Unknown blood group")
    return {"blood_group": group, "can_donate_to": CAN_DONATE_TO[group], "can_receive_from": can_receive_from(group)}
