import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import Config
from src.middleware.profiler import ComputeProfilerMiddleware
from src.routes.dsfm_routes import router as dsfm_router
from src.routes.forecast_routes import router as forecast_router
from src.routes.health_routes import router as health_router
from src.routes.model_routes import router as models_router
from src.services.sentiment_service import warmup_finbert_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class HealthEndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("GET /health") == -1


logging.getLogger("uvicorn.access").addFilter(HealthEndpointFilter())


import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start FinBERT warmup in background on startup, with a slight delay so uvicorn can bind."""
    logger.info("🚀 Starting AngelFive ML Service")

    async def delayed_warmup():
        await asyncio.sleep(2)  # Give uvicorn 2 seconds to bind to $PORT
        logger.info("Initiating delayed model warmup...")
        threading.Thread(target=warmup_finbert_model, daemon=True).start()

    asyncio.create_task(delayed_warmup())

    yield
    logger.info("🛑 Shutting down AngelFive ML Service")


def create_app() -> FastAPI:
    app = FastAPI(
        title="AngelFive ML Service",
        description="DSFM analytics, forecasting, and sentiment inference API",
        version="3.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=Config.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(ComputeProfilerMiddleware)

    app.include_router(health_router)
    app.include_router(forecast_router)
    app.include_router(models_router)
    app.include_router(dsfm_router, prefix="/dsfm")

    return app
