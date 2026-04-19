"""JWT creation and validation for Voice-Labs auth."""
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me-use-long-random-string-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))


def create_access_token(subject_email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject_email.lower(),
        "role": role,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def safe_decode(token: str) -> Optional[Dict[str, Any]]:
    try:
        return decode_token(token)
    except JWTError:
        return None
