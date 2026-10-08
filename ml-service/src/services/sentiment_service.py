"""
Sentiment service with dual-mode FinBERT support:
- FINBERT_ENABLED=false + HF_TOKEN set  → Hugging Face Inference API (0MB RAM, free)
- FINBERT_ENABLED=true                  → Local model (requires >1GB RAM)
- Neither                               → Returns error suggesting rule-based fallback
"""

import logging
from threading import Lock

import requests
import torch

from src.config import Config
from src.models.model_loader import get_finbert

logger = logging.getLogger(__name__)

LABEL_MAP = {
    "positive": "positive",
    "negative": "negative",
    "neutral": "neutral",
    "label_0": "positive",
    "label_1": "negative",
    "label_2": "neutral",
}

_warmup_lock = Lock()
_warmup_started = False
_warmup_ready = False
_warmup_error = None

# HF Inference API endpoint for FinBERT
_HF_INFERENCE_URL = (
    f"https://api-inference.huggingface.co/models/{Config.FINBERT_MODEL_NAME}"
)


def warmup_finbert_model():
    global _warmup_started, _warmup_ready, _warmup_error

    if not Config.FINBERT_ENABLED:
        if Config.HF_TOKEN:
            # Use HF Inference API — no local model needed, mark as ready immediately
            logger.info("FinBERT running via HF Inference API (no local model loaded)")
            _warmup_started = True
            _warmup_ready = True
            _warmup_error = None
        else:
            _warmup_started = True
            _warmup_ready = False
            _warmup_error = (
                "FinBERT is disabled and no HF_TOKEN is configured. "
                "Either set HF_TOKEN to use the Inference API, or use /dsfm/sentiment/rule-based."
            )
        return

    # Local model path (paid tier / local dev with enough RAM)
    with _warmup_lock:
        if _warmup_started:
            return
        _warmup_started = True
    try:
        get_finbert()
        _warmup_ready = True
        _warmup_error = None
        logger.info("FinBERT local model loaded and ready")
    except Exception as exc:
        _warmup_ready = False
        _warmup_error = str(exc)
        logger.error(f"FinBERT local warmup failed: {exc}")


def get_finbert_warmup_status() -> dict:
    mode = (
        "local"
        if Config.FINBERT_ENABLED
        else ("api" if Config.HF_TOKEN else "disabled")
    )
    return {
        "started": _warmup_started,
        "ready": _warmup_ready,
        "error": _warmup_error,
        "mode": mode,
    }


def _run_finbert_via_api(text: str) -> dict:
    """Call the Hugging Face Hosted Inference API for FinBERT — no RAM cost."""
    headers = {"Authorization": f"Bearer {Config.HF_TOKEN}"}
    payload = {"inputs": text[:512], "options": {"wait_for_model": True}}

    try:
        resp = requests.post(
            _HF_INFERENCE_URL, headers=headers, json=payload, timeout=60
        )
    except requests.Timeout:
        raise RuntimeError("HF Inference API timed out after 60 seconds")
    except requests.ConnectionError as exc:
        raise RuntimeError(f"Failed to reach HF Inference API: {exc}")

    if resp.status_code == 503:
        raise RuntimeError("HF model server is warming up, please retry in ~20 seconds")
    if resp.status_code == 401:
        raise RuntimeError("Invalid HF_TOKEN. Please verify your Hugging Face token.")
    if not resp.ok:
        raise RuntimeError(
            f"HF Inference API error {resp.status_code}: {resp.text[:200]}"
        )

    raw = resp.json()
    # API returns [[{"label": "positive", "score": 0.9}, ...]]
    labels_list = raw[0] if isinstance(raw[0], list) else raw
    label_probs = {
        LABEL_MAP.get(item["label"].lower(), "neutral"): float(item["score"])
        for item in labels_list
    }

    positive = label_probs.get("positive", 0.0)
    negative = label_probs.get("negative", 0.0)
    neutral = label_probs.get("neutral", 0.0)
    sentiment = max(
        [("positive", positive), ("negative", negative), ("neutral", neutral)],
        key=lambda x: x[1],
    )[0]

    return {
        "model": f"FinBERT (HF Inference API — {Config.FINBERT_MODEL_NAME})",
        "text": text[:200],
        "sentiment": sentiment,
        "score": label_probs[sentiment],
        "confidence": label_probs[sentiment],
        "positive_probability": positive,
        "negative_probability": negative,
        "neutral_probability": neutral,
    }


def _run_finbert_local(text: str) -> dict:
    """Run FinBERT inference using the locally loaded model."""
    tokenizer, model = get_finbert()
    encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = model(**encoded).logits
        probs = torch.softmax(logits, dim=-1).squeeze(0)

    id2label = {idx: value.lower() for idx, value in model.config.id2label.items()}
    label_probs = {}
    for idx, prob in enumerate(probs.tolist()):
        canonical_label = LABEL_MAP.get(id2label.get(idx, f"label_{idx}"), "neutral")
        label_probs[canonical_label] = float(prob)

    positive = label_probs.get("positive", 0.0)
    negative = label_probs.get("negative", 0.0)
    neutral = label_probs.get("neutral", 0.0)
    sentiment = max(
        [("positive", positive), ("negative", negative), ("neutral", neutral)],
        key=lambda x: x[1],
    )[0]

    return {
        "model": f"FinBERT (local — {Config.FINBERT_MODEL_NAME})",
        "text": text[:200],
        "sentiment": sentiment,
        "score": label_probs[sentiment],
        "confidence": label_probs[sentiment],
        "positive_probability": positive,
        "negative_probability": negative,
        "neutral_probability": neutral,
    }


def run_finbert_sentiment(text: str) -> dict:
    """Route to either local or API inference based on config."""
    if Config.FINBERT_ENABLED:
        return _run_finbert_local(text)
    else:
        return _run_finbert_via_api(text)


def run_rule_based_sentiment(text: str) -> dict:
    text_lower = text.lower()
    bullish_patterns = [
        "bullish",
        "breakout",
        "resistance",
        "support",
        "uptrend",
        "rally",
        "surge",
        "gain",
        "profit",
        "growth",
        "strong",
        "buy",
        "long",
        "target",
        "higher",
    ]
    bearish_patterns = [
        "bearish",
        "breakdown",
        "sell-off",
        "downtrend",
        "crash",
        "plunge",
        "drop",
        "loss",
        "decline",
        "weak",
        "sell",
        "short",
        "lower",
        "fall",
    ]
    neutral_patterns = [
        "consolidate",
        "sideways",
        "range",
        "stable",
        "unchanged",
        "flat",
    ]

    bullish_score = sum(1 for p in bullish_patterns if p in text_lower)
    bearish_score = sum(1 for p in bearish_patterns if p in text_lower)
    neutral_score = sum(1 for p in neutral_patterns if p in text_lower)

    total = bullish_score + bearish_score + neutral_score
    if total == 0:
        sentiment, score = "neutral", 0.5
    elif bullish_score > bearish_score and bullish_score > neutral_score:
        sentiment = "bullish"
        score = 0.5 + (bullish_score / total) * 0.4
    elif bearish_score > bullish_score and bearish_score > neutral_score:
        sentiment = "bearish"
        score = 0.5 - (bearish_score / total) * 0.4
    else:
        sentiment, score = "neutral", 0.5

    return {
        "model": "Rule-Based",
        "text": text[:200],
        "sentiment": sentiment,
        "score": float(score),
        "bullish_signals": bullish_score,
        "bearish_signals": bearish_score,
        "neutral_signals": neutral_score,
        "confidence": float(abs(score - 0.5) * 2),
        "matched_patterns": {
            "bullish": [p for p in bullish_patterns if p in text_lower],
            "bearish": [p for p in bearish_patterns if p in text_lower],
            "neutral": [p for p in neutral_patterns if p in text_lower],
        },
    }
