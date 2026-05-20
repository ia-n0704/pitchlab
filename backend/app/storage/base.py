from abc import ABC, abstractmethod
from pathlib import Path


class Storage(ABC):
    """Abstract object storage. `key` is opaque, used for retrieval."""

    @abstractmethod
    def put(self, key: str, src: Path, content_type: str = "video/mp4") -> str:
        """Upload a file. Returns the canonical key."""

    @abstractmethod
    def open_path(self, key: str) -> Path:
        """Return a local filesystem Path for analysis.

        For local backend: the file itself.
        For R2 backend: downloads to a temp path and returns that.
        """

    @abstractmethod
    def delete(self, key: str) -> None:
        ...

    @abstractmethod
    def exists(self, key: str) -> bool:
        ...
