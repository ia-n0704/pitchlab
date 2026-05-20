from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analyses, auth, health, uploads
from app.config import settings
from app.db import Base, engine

# Auto-create tables on startup. In production this would be Alembic migrations.
from app import models  # noqa: F401 — register models with Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PitchLab API",
    version="0.1.0",
    description="AI 기반 투구 동작 생체역학 분석 플랫폼 — Open Beta v0.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(analyses.router)
