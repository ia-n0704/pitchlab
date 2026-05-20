from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.postgres_dsn, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a Session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
