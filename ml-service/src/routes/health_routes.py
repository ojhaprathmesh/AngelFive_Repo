import os
import sys
from datetime import datetime
from typing import Any

from fastapi import APIRouter

from src.config import Config
from src.services.sentiment_service import get_finbert_warmup_status


router = APIRouter(tags=["Health"])


@router.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "AngelFive ML Service",
        "status": "running",
        "available_endpoints": ["/health", "/forecast", "/models", "/dsfm/*"],
    }


@router.get("/health")
def health_check() -> dict[str, Any]:
    warmup = get_finbert_warmup_status()
    return {
        "status": "success",
        "message": "ML service is healthy and running",
        "timestamp": datetime.now().isoformat(),
        "service": "ml-service",
        "version": "3.0.0",
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "model_warmup": {"finbert": warmup},
    }


@router.get("/health/detailed")
def detailed_health_check() -> dict[str, Any]:
    import psutil
    warmup = get_finbert_warmup_status()
    return {
        "status": "success",
        "message": "Detailed health check passed",
        "timestamp": datetime.now().isoformat(),
        "service": "ml-service",
        "version": "3.0.0",
        "system": {
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "platform": sys.platform,
            "cpu_count": os.cpu_count(),
            "memory_usage": f"{psutil.virtual_memory().percent}%",
            "disk_usage": f"{psutil.disk_usage('/').percent}%",
        },
        "configuration": {"debug": Config.DEBUG, "host": Config.HOST, "port": Config.PORT},
        "model_warmup": {"finbert": warmup},
    }
