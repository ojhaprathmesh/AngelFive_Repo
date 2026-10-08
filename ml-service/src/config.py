import os


class Config:
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))
    DEBUG = os.getenv("FLASK_ENV", "development") == "development"
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    LSTM_MODEL_PATH = os.getenv(
        "LSTM_MODEL_PATH", "model_assets/lstm_timeseries.safetensors"
    )
    FINBERT_MODEL_NAME = os.getenv("FINBERT_MODEL_NAME", "ProsusAI/finbert")
    HF_TOKEN = os.getenv("HF_TOKEN")
    # Set to "true" only on instances with >1GB RAM (e.g. Render Starter tier)
    # Defaults to false to prevent OOM crashes on Render Free Tier (512MB)
    FINBERT_ENABLED = os.getenv("FINBERT_ENABLED", "false").lower() == "true"
