from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db
from rules import BLOOD_GROUPS, check_eligibility
from security import current_user, donor_of, require_role

router = APIRouter(prefix="/api", tags=["Donors"])


class DonorUpdate(BaseModel):
    name: str
    blood_group: str
    age: int
    gender: Optional[str] = None
    weight: float
    haemoglobin: Optional[float] = None
    phone: Optional[str] = None
    city: Optional[str] = None


def eligibility_of(donor):
    return check_eligibility(
        donor["age"], donor["weight"], donor["last_donation_date"], donor.get("gender"), donor.get("haemoglobin")
    )


def profile_payload(db, user):
    donor = donor_of(db, user)
    donor["name"] = user["name"]
    donor["email"] = user["email"]
    donor["eligibility"] = eligibility_of(donor)
    donor["total_donations"] = db.execute(
        "SELECT COUNT(*) FROM blood_units WHERE donor_id = ?", (donor["id"],)
    ).fetchone()[0]
    return donor


@router.get("/donor/profile")
def get_profile(user=Depends(require_role("donor")), db=Depends(get_db)):
    return profile_payload(db, user)


@router.put("/donor/profile")
def update_profile(data: DonorUpdate, user=Depends(require_role("donor")), db=Depends(get_db)):
    if data.blood_group not in BLOOD_GROUPS:
        raise HTTPException(400, "Select a valid blood group")
    if data.age < 1 or data.age > 120 or data.weight < 10 or data.weight > 300:
        raise HTTPException(400, "Enter a valid age and weight")
    if data.haemoglobin is not None and (data.haemoglobin < 5 or data.haemoglobin > 25):
        raise HTTPException(400, "Enter a valid haemoglobin value in g/dL")
    if not data.name.strip():
        raise HTTPException(400, "Name is required")
    db.execute("UPDATE users SET name = ? WHERE id = ?", (data.name.strip(), user["id"]))
    db.execute(
        "UPDATE donors SET blood_group = ?, age = ?, gender = ?, weight = ?, haemoglobin = ?, phone = ?, city = ? WHERE user_id = ?",
        (data.blood_group, data.age, data.gender, data.weight, data.haemoglobin, data.phone, data.city, user["id"]),
    )
    db.commit()
    user["name"] = data.name.strip()
    return profile_payload(db, user)


@router.get("/donor/history")
def donation_history(user=Depends(require_role("donor")), db=Depends(get_db)):
    donor = donor_of(db, user)
    rows = db.execute(
        "SELECT id, blood_group, collected_on, status FROM blood_units WHERE donor_id = ? ORDER BY collected_on DESC",
        (donor["id"],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.get("/donors/search")
def search_donors(
    blood_group: Optional[str] = None,
    city: Optional[str] = None,
    user=Depends(require_role("admin", "hospital")),
    db=Depends(get_db),
):
    sql = (
        "SELECT d.id, u.name, d.blood_group, d.city, d.phone, d.age, d.gender, d.weight, d.haemoglobin, d.last_donation_date "
        "FROM donors d JOIN users u ON u.id = d.user_id WHERE 1=1"
    )
    params = []
    if blood_group:
        sql += " AND d.blood_group = ?"
        params.append(blood_group)
    if city:
        sql += " AND LOWER(d.city) LIKE ?"
        params.append(f"%{city.strip().lower()}%")
    sql += " ORDER BY u.name"
    result = []
    for r in db.execute(sql, params).fetchall():
        row = dict(r)
        row["eligible"] = eligibility_of(row)["eligible"]
        result.append(row)
    return result


@router.get("/admin/donors")
def all_donors(user=Depends(require_role("admin")), db=Depends(get_db)):
    rows = db.execute(
        "SELECT d.id, u.name, u.email, d.blood_group, d.age, d.gender, d.weight, d.haemoglobin, d.phone, d.city, d.last_donation_date, "
        "(SELECT COUNT(*) FROM blood_units b WHERE b.donor_id = d.id) AS donations "
        "FROM donors d JOIN users u ON u.id = d.user_id ORDER BY u.name"
    ).fetchall()
    result = []
    for r in rows:
        row = dict(r)
        row["eligible"] = eligibility_of(row)["eligible"]
        result.append(row)
    return result
