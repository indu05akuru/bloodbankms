import hashlib
import secrets

from fastapi import Depends, Header, HTTPException

from database import get_db


def hash_password(password: str, salt: str = None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 100_000).hex()
    return digest, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    return secrets.compare_digest(hash_password(password, salt)[0], password_hash)


def current_user(authorization: str = Header(None), db=Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Please log in")
    token = authorization[7:]
    row = db.execute(
        "SELECT u.id, u.name, u.email, u.role FROM sessions s "
        "JOIN users u ON u.id = s.user_id WHERE s.token = ?",
        (token,),
    ).fetchone()
    if not row:
        raise HTTPException(401, "Session expired, please log in again")
    return dict(row)


def require_role(*roles):
    def checker(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "You are not allowed to do this")
        return user

    return checker


def donor_of(db, user):
    row = db.execute("SELECT * FROM donors WHERE user_id = ?", (user["id"],)).fetchone()
    if not row:
        raise HTTPException(404, "Donor profile not found")
    return dict(row)


def hospital_of(db, user):
    row = db.execute("SELECT * FROM hospitals WHERE user_id = ?", (user["id"],)).fetchone()
    if not row:
        raise HTTPException(404, "Hospital profile not found")
    return dict(row)
