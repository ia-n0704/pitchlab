"""
Centralized config — pulled from env via pydantic-settings.
"""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── service ──
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ── postgres ──
    postgres_dsn: str = "postgresql+psycopg://pitchlab:pitchlab@db:5432/pitchlab"

    # ── redis (Celery broker + result backend) ──
    redis_url: str = "redis://redis:6379/0"

    # ── storage ──
    # "local" → uploads/ on disk; "r2" → Cloudflare R2 (S3-compatible).
    storage_backend: str = "local"
    local_uploads_dir: str = "/app/uploads"
    r2_endpoint_url: str | None = None
    r2_bucket: str = "pitchlab-videos"
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None

    # ── retention ──
    video_retention_days: int = 30

    # ── LLM ──
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    claude_model: str = "claude-sonnet-4-5"

    # ── auth ──
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days


settings = Settings()
