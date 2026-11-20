# syntax=docker/dockerfile:1

# Stage 1: Build virtualenv using uv and compile tools
FROM python:3.11-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install build tools only in builder stage for native C/Fortran extension wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./

# Install CPU-only dependencies into /app/.venv and clean up __pycache__
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project && \
    find /app/.venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Stage 2: Minimal Production Runtime
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    TRANSFORMERS_CACHE=/app/model_cache \
    HF_HOME=/app/model_cache \
    PATH="/app/.venv/bin:$PATH" \
    MALLOC_ARENA_MAX=2

# Install only the runtime OpenMP dynamic library for PyTorch / cvxpy (without build-essential)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and cache directory
RUN addgroup --system appgroup && \
    adduser --system --group appuser && \
    mkdir -p /app/model_cache && \
    chown -R appuser:appgroup /app/model_cache

# Copy prebuilt virtualenv from builder stage directly with correct permissions
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv

# Copy application source code
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Production: gunicorn with uvicorn workers (config in gunicorn.conf.py)
CMD ["gunicorn", "app:app", "--config", "gunicorn.conf.py"]
