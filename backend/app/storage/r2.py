import tempfile
from pathlib import Path

import boto3
from botocore.client import Config

from .base import Storage


class R2Storage(Storage):
    """Cloudflare R2 backend. S3-compatible; uses signature v4 + virtual-hosted style."""

    def __init__(self, endpoint_url: str, bucket: str, access_key_id: str, secret_access_key: str) -> None:
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    def put(self, key: str, src: Path, content_type: str = "video/mp4") -> str:
        self.client.upload_file(str(src), self.bucket, key, ExtraArgs={"ContentType": content_type})
        return key

    def open_path(self, key: str) -> Path:
        # download to temp for ffmpeg/cv2 ingestion
        fd = tempfile.NamedTemporaryFile(delete=False, suffix=Path(key).suffix)
        fd.close()
        self.client.download_file(self.bucket, key, fd.name)
        return Path(fd.name)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except self.client.exceptions.ClientError:
            return False
