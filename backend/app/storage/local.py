import shutil
from pathlib import Path

from .base import Storage


class LocalStorage(Storage):
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _full(self, key: str) -> Path:
        return self.root / key

    def put(self, key: str, src: Path, content_type: str = "video/mp4") -> str:
        dst = self._full(key)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        return key

    def open_path(self, key: str) -> Path:
        return self._full(key)

    def delete(self, key: str) -> None:
        try:
            self._full(key).unlink()
        except FileNotFoundError:
            pass

    def exists(self, key: str) -> bool:
        return self._full(key).exists()
