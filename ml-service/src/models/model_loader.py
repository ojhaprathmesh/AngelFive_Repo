from pathlib import Path
from threading import Lock

from src.config import Config

_finbert_lock = Lock()
_lstm_lock = Lock()
_finbert_tokenizer = None
_finbert_model = None
_lstm_model = None


def get_finbert():
    global _finbert_model, _finbert_tokenizer
    if _finbert_model is None or _finbert_tokenizer is None:
        with _finbert_lock:
            if _finbert_model is None or _finbert_tokenizer is None:
                import torch
                from transformers import (
                    AutoModelForSequenceClassification,
                    AutoTokenizer,
                )

                _finbert_tokenizer = AutoTokenizer.from_pretrained(
                    Config.FINBERT_MODEL_NAME, token=Config.HF_TOKEN
                )
                # Load with low_cpu_mem_usage to prevent memory spikes during weights initialization
                _finbert_model = AutoModelForSequenceClassification.from_pretrained(
                    Config.FINBERT_MODEL_NAME,
                    use_safetensors=True,
                    token=Config.HF_TOKEN,
                    low_cpu_mem_usage=True,
                )

                # Render Free Tier has a strict 512MB RAM limit. FinBERT is ~420MB.
                # Dynamic quantization shrinks the Linear layers to 8-bit integers,
                # reducing the RAM footprint by ~70% with negligible accuracy loss.
                _finbert_model = torch.quantization.quantize_dynamic(
                    _finbert_model, {torch.nn.Linear}, dtype=torch.qint8
                )

                _finbert_model.eval()
    return _finbert_tokenizer, _finbert_model


def get_lstm_model():
    global _lstm_model
    if _lstm_model is None:
        with _lstm_lock:
            if _lstm_model is None:
                import torch
                from safetensors.torch import load_file

                from src.models.lstm_model import TimeSeriesLSTM

                model = TimeSeriesLSTM()
                model_path = Path(Config.LSTM_MODEL_PATH)

                # Check for safetensors first (preferred)
                st_path = model_path.with_suffix(".safetensors")
                if st_path.exists():
                    state_dict = load_file(st_path)
                    model.load_state_dict(state_dict)
                elif model_path.exists():
                    # Fallback to pickle (might fail on torch < 2.6 depending on CVE check)
                    try:
                        state_dict = torch.load(
                            model_path,
                            map_location=torch.device("cpu"),
                            weights_only=True,
                        )
                        model.load_state_dict(state_dict)
                    except Exception as e:
                        raise RuntimeError(
                            f"Failed to load LSTM weights from {model_path}. "
                            f"Please use safetensors version or upgrade torch to 2.6+. Error: {e}"
                        )
                else:
                    raise FileNotFoundError(
                        f"LSTM weights not found at '{model_path}'. Run scripts/init_lstm_weights.py first."
                    )

                model.eval()
                _lstm_model = model
    return _lstm_model
