"""Password hashing with bcrypt (bcrypt 4.x–compatible; avoids passlib backend issues)."""
import bcrypt

# bcrypt ignores input beyond 72 bytes; truncate so hashing never raises.
def _bcrypt_bytes(plain: str) -> bytes:
    b = plain.encode("utf-8")
    if len(b) > 72:
        return b[:72]
    return b


def hash_password(plain: str) -> str:
    pw = _bcrypt_bytes(plain)
    return bcrypt.hashpw(pw, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    pw = _bcrypt_bytes(plain)
    try:
        h = hashed.encode("ascii") if isinstance(hashed, str) else hashed
        return bcrypt.checkpw(pw, h)
    except (ValueError, TypeError):
        return False
