FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# OpenCV runtime deps (libGL etc.) — mediapipe pulls cv2.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# torch first from the CPU wheel index — the default PyPI wheel drags in the
# multi-GB CUDA stack, which is useless in this CPU container. GPU deployments
# should swap the index for the matching CUDA one.
RUN pip install --upgrade pip \
    && pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r requirements.txt

COPY app ./app

EXPOSE 8000

# Default command runs the API. Compose overrides this for the worker service.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
