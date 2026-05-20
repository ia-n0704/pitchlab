"""
Pre-analysis quality gate. Reads the video header via OpenCV and rejects
clips that don't meet the strict-mode guide (fps, resolution).
"""
from dataclasses import dataclass
from pathlib import Path

import cv2


@dataclass
class QualityReport:
    fps: float
    frames: int
    width: int
    height: int
    issues: list[str]

    @property
    def passed(self) -> bool:
        return not self.issues


def inspect(video_path: Path) -> QualityReport:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return QualityReport(0, 0, 0, 0, ["영상을 열 수 없습니다 (코덱 미지원 또는 손상)."])

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    cap.release()

    issues: list[str] = []
    if fps < 55:
        issues.append(f"프레임레이트 {fps:.0f}fps · 60fps 이상 필요")
    if height < 700 and width < 700:
        issues.append(f"해상도 {width}×{height} · 720p 이상 필요")
    if frames < 30:
        issues.append("영상 길이가 너무 짧습니다 (≥ 30 프레임 필요).")

    return QualityReport(fps=fps, frames=frames, width=width, height=height, issues=issues)
