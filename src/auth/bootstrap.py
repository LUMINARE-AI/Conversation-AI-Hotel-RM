"""Create default admin user if none exists (env-driven credentials)."""
import logging
import os

from sqlalchemy.orm import Session

from src.models.database import User, get_engine
from src.auth.passwords import hash_password

logger = logging.getLogger(__name__)


def seed_default_admin() -> None:
    email = os.getenv("AUTH_ADMIN_EMAIL", "admin@luminare.local").strip().lower()
    password = os.getenv("AUTH_ADMIN_PASSWORD", "changeme123")
    engine = get_engine()
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(bind=engine)
    db: Session = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return
        admin = User(
            email=email,
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Seeded default admin user: %s", email)
    except Exception as e:
        logger.exception("Failed to seed admin user: %s", e)
        db.rollback()
    finally:
        db.close()
