# syntax=docker/dockerfile:1

FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    TRANSFORMERS_CACHE=/app/model_cache \
    HF_HOME=/app/model_cache

# 1. Install build tools for native packages (scipy/cvxpy) and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/app/.venv/bin:$PATH"

# 2. Fast CPU-only install from uv.lock with BuildKit cache mounting
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# 3. Create non-root user and setup directories
RUN addgroup --system appgroup && adduser --system --group appuser && \
    mkdir -p /app/model_cache && chown -R appuser:appgroup /app/model_cache /app/.venv

# 4. Copy application code
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Production: gunicorn with uvicorn workers (config in gunicorn.conf.py)
CMD ["gunicorn", "app:app", "--config", "gunicorn.conf.py"]

