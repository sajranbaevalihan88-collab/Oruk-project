"""JWT auth helpers (PyJWT + pbkdf2_hmac, zero external crypto deps)."""
import hashlib
import hmac
import os
import sqlite3

import jwt

SECRET = os.environ.get("DJANGO_SECRET_KEY", os.environ.get("ORUK_SECRET", "oruk-demo-secret-2027"))
ALGO = "HS256"
TOKEN_TTL_HOURS = 24 * 7


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return salt.hex() + "$" + dk.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 200_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def make_token(user_id: int, role: str) -> str:
    payload = {"sub": str(user_id), "role": role}
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        return {"user_id": int(payload["sub"]), "role": payload["role"]}
    except Exception:
        return None


def get_current_user(conn: sqlite3.Connection, authorization: str | None):
    """Return the users row for the request's Authorization: Bearer header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    claims = decode_token(authorization.split(" ", 1)[1])
    if not claims:
        return None
    row = conn.execute("SELECT * FROM users WHERE id=?", (claims["user_id"],)).fetchone()
    return row


def require_role(user, *roles):
    if user is None:
        return "auth", None
    if roles and user["role"] not in roles:
        return "forbidden", user
    return None, user
