from functools import lru_cache

from app.config import settings

from .base import Storage
from .local import LocalStorage
from .r2 import R2Storage


@lru_cache(maxsize=1)
def get_storage() -> Storage:
    if settings.storage_backend == "r2":
        if not (settings.r2_endpoint_url and settings.r2_access_key_id and settings.r2_secret_access_key):
            raise RuntimeError("STORAGE_BACKEND=r2 but R2 credentials are missing.")
        return R2Storage(
            endpoint_url=settings.r2_endpoint_url,
            bucket=settings.r2_bucket,
            access_key_id=settings.r2_access_key_id,
            secret_access_key=settings.r2_secret_access_key,
        )
    return LocalStorage(settings.local_uploads_dir)
