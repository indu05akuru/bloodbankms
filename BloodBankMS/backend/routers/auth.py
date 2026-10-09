import re
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from database import get_db
from rules import BLOOD_GROUPS
from security import current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterIn(BaseModel):
    role: str
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    city: Optional[str] = None
    blood_group: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    weight: Optional[float] = None
    haemoglobin: Optional[float] = None
    hospital_name: Optional[str] = None
    license_no: Optional[str] = None


class LoginIn(BaseModel):
    email: str
    password: str


def new_session(db, user_id):
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    db.commit()
    return token


@router.post("/register")
def register(data: RegisterIn, db=Depends(get_db)):
    if data.role not in ("donor", "hospital"):
        raise HTTPException(400, "Role must be donor or hospital")
    if not data.name.strip():
        raise HTTPException(400, "Name is required")
    if not EMAIL_RE.match(data.email):
        raise HTTPException(400, "Enter a valid email address")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    email = data.email.strip().lower()
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise HTTPException(400, "This email is already registered")

    if data.role == "donor":
        if data.blood_group not in BLOOD_GROUPS:
            raise HTTPException(400, "Select a valid blood group")
        if not data.age or data.age < 1 or data.age > 120:
            raise HTTPException(400, "Enter a valid age")
        if not data.weight or data.weight < 10 or data.weight > 300:
            raise HTTPException(400, "Enter a valid weight in kg")
        if data.haemoglobin is not None and (data.haemoglobin < 5 or data.haemoglobin > 25):
            raise HTTPException(400, "Enter a valid haemoglobin value in g/dL")
    else:
        if not (data.hospital_name or "").strip():
            raise HTTPException(400, "Hospital name is required")

    pw_hash, salt = hash_password(data.password)
    cur = db.execute(
        "INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)",
        (data.name.strip(), email, pw_hash, salt, data.role),
    )
    user_id = cur.lastrowid
    if data.role == "donor":
        db.execute(
            "INSERT INTO donors (user_id, blood_group, age, gender, weight, haemoglobin, phone, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, data.blood_group, data.age, data.gender, data.weight, data.haemoglobin, data.phone, data.city),
        )
    else:
        db.execute(
            "INSERT INTO hospitals (user_id, hospital_name, license_no, phone, city) VALUES (?, ?, ?, ?, ?)",
            (user_id, data.hospital_name.strip(), data.license_no, data.phone, data.city),
        )
    token = new_session(db, user_id)
    return {"token": token, "user": {"id": user_id, "name": data.name.strip(), "email": email, "role": data.role}}


@router.post("/login")
def login(data: LoginIn, db=Depends(get_db)):
    user = db.execute("SELECT * FROM users WHERE email = ?", (data.email.strip().lower(),)).fetchone()
    if not user or not verify_password(data.password, user["password_hash"], user["salt"]):
        raise HTTPException(401, "Wrong email or password")
    token = new_session(db, user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]},
    }


@router.post("/logout")
def logout(authorization: str = Header(None), db=Depends(get_db)):
    if authorization and authorization.startswith("Bearer "):
        db.execute("DELETE FROM sessions WHERE token = ?", (authorization[7:],))
        db.commit()
    return {"ok": True}


@router.get("/me")
def me(user=Depends(current_user)):
    return user
