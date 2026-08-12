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

    # ── pose estimation ──
    # "hq"  → ViTPose 2D + MediaPipe GHUM 3D fusion + temporal smoothing (best accuracy;
    #          needs torch+transformers, first run downloads model weights).
    # "mediapipe" → BlazePose Heavy only (light, no extra deps).
    # "hq" falls back to "mediapipe" automatically if the HQ stack is unavailable.
    pose_backend: str = "hq"
    # ViTPose checkpoint. plus-large ≈ best accuracy/speed balance; use
    # usyd-community/vitpose-plus-huge on a beefy GPU for the ceiling.
    vitpose_model: str = "usyd-community/vitpose-plus-large"
    vitpose_detector: str = "PekingU/rtdetr_r50vd_coco_o365"
    # Run the person detector every N frames (bbox is tracked from keypoints in between).
    vitpose_detect_every: int = 4
    # Force torch device ("cuda" | "mps" | "cpu"); None = auto.
    pose_device: str | None = None

    # ── 3D lifting (MotionBERT) ──
    # Replace MediaPipe GHUM world_xyz with MotionBERT lifting of the ViTPose 2D
    # track. Only active with pose_backend="hq".
    # DEFAULT OFF: on our fenced-cage side-view clips the input 2D is too jittery
    # (shoulder-width CV ~79%) for lifting to help — it improved upper-arm bone
    # consistency slightly but worsened the legs (stride is along the camera-depth
    # axis, the least observable direction for a monocular lifter). Turn on for
    # clean, well-framed footage where MotionBERT's SOTA accuracy can show.
    lift_3d: bool = False
    motionbert_repo: str = "walterzhu/MotionBERT"
    motionbert_ckpt: str = "checkpoint/pose3d/FT_MB_lite_MB_ft_h36m_global_lite/best_epoch.bin"

    # ── LLM ──
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    claude_model: str = "claude-sonnet-4-6"

    # ── auth ──
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # ── email verification ──
    # When True, the signup/resend response includes the 6-digit code so the flow
    # is testable without an SMTP server. Set False in production.
    expose_verification_code: bool = True
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "no-reply@pitchlab.local"


settings = Settings()
