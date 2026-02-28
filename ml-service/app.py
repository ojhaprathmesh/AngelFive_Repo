#!/usr/bin/env python3
"""
ML Service for AngelFive DSFM Dashboard
Flask-based microservice for machine learning forecasting and analytics
"""

import os
import logging
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS
CORS(app, origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
CONFIG = {
    'HOST': os.getenv('HOST', '0.0.0.0'),
    'PORT': int(os.getenv('PORT', 8000)),
    'DEBUG': os.getenv('FLASK_ENV', 'development') == 'development',
    'BACKEND_URL': os.getenv('BACKEND_URL', 'http://localhost:5000'),
}

# Mock ML models data
MOCK_MODELS = {
    'LSTM': {'accuracy': 0.85, 'last_trained': '2024-01-15T10:30:00Z'},
    'CNN_LSTM': {'accuracy': 0.82, 'last_trained': '2024-01-15T10:30:00Z'},
    'ARIMA': {'accuracy': 0.78, 'last_trained': '2024-01-15T10:30:00Z'},
    'SARIMA': {'accuracy': 0.80, 'last_trained': '2024-01-15T10:30:00Z'},
    'ARCH_GARCH': {'accuracy': 0.75, 'last_trained': '2024-01-15T10:30:00Z'}
}

def generate_mock_forecast(symbol: str, days: int = 30, model: str = 'LSTM') -> List[Dict]:
    """Generate mock forecast data for testing"""
    base_price = 72500 if symbol.upper() == 'SENSEX' else 21850
    forecast_data = []
    
    for i in range(days):
        date = datetime.now() + timedelta(days=i+1)
        # Add some realistic price movement
        price_change = np.random.normal(0, base_price * 0.02)  # 2% volatility
        predicted_price = base_price + price_change
        confidence = max(0.6, 0.95 - (i * 0.01))  # Decreasing confidence over time
        
        forecast_data.append({
            'date': date.isoformat(),
            'predicted_price': round(predicted_price, 2),
            'confidence': round(confidence, 3),
            'upper_bound': round(predicted_price * 1.05, 2),
            'lower_bound': round(predicted_price * 0.95, 2)
        })
        
        base_price = predicted_price  # Use predicted price as next base
    
    return forecast_data

@app.errorhandler(Exception)
def handle_exception(e):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(e)}")
    logger.error(traceback.format_exc())
    
    return jsonify({
        'status': 'error',
        'code': 500,
        'message': 'Internal server error',
        'details': str(e) if CONFIG['DEBUG'] else 'An unexpected error occurred',
        'timestamp': datetime.now().isoformat(),
        'service': 'ml-service'
    }), 500

@app.errorhandler(404)
def handle_not_found(e):
    """Handle 404 errors"""
    return jsonify({
        'status': 'error',
        'code': 404,
        'message': 'Endpoint not found',
        'details': f"The requested endpoint '{request.path}' does not exist",
        'timestamp': datetime.now().isoformat(),
        'service': 'ml-service',
        'available_endpoints': [
            'GET /health',
            'GET /health/detailed',
            'POST /forecast',
            'GET /models',
            'GET /error/400',
            'GET /error/500'
        ]
    }), 404

@app.before_request
def log_request():
    """Log incoming requests"""
    logger.info(f"📥 {request.method} {request.path} - IP: {request.remote_addr}")
    if request.is_json and request.get_json():
        logger.info(f"Request body: {json.dumps(request.get_json(), indent=2)}")

@app.after_request
def log_response(response):
    """Log outgoing responses"""
    logger.info(f"📤 {request.method} {request.path} - Status: {response.status_code}")
    return response

# Health check endpoints
@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "service": "AngelFive ML Service",
        "status": "running",
        "available_endpoints": [
            "/health",
            "/forecast",
            "/models",
            "/dsfm/*"
        ]
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Basic health check"""
    return jsonify({
        'status': 'success',
        'message': 'ML service is healthy and running',
        'timestamp': datetime.now().isoformat(),
        'service': 'ml-service',
        'version': '1.0.0',
        'python_version': f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}"
    }), 200

@app.route('/health/detailed', methods=['GET'])
def detailed_health_check():
    """Detailed health check with system information"""
    import psutil
    
    return jsonify({
        'status': 'success',
        'message': 'Detailed health check passed',
        'timestamp': datetime.now().isoformat(),
        'service': 'ml-service',
        'version': '1.0.0',
        'system': {
            'python_version': f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
            'platform': os.sys.platform,
            'cpu_count': os.cpu_count(),
            'memory_usage': f"{psutil.virtual_memory().percent}%",
            'disk_usage': f"{psutil.disk_usage('/').percent}%"
        },
        'models': {
            'available': list(MOCK_MODELS.keys()),
            'count': len(MOCK_MODELS)
        },
        'configuration': {
            'debug': CONFIG['DEBUG'],
            'host': CONFIG['HOST'],
            'port': CONFIG['PORT']
        }
    }), 200

# ML Service endpoints
@app.route('/forecast', methods=['POST'])
def generate_forecast():
    """Generate ML forecast for given symbol"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'code': 400,
                'message': 'Invalid request',
                'details': 'Request body must be valid JSON',
                'timestamp': datetime.now().isoformat(),
                'service': 'ml-service'
            }), 400
        
        # Validate required fields
        required_fields = ['symbol']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'status': 'error',
                'code': 400,
                'message': 'Missing required fields',
                'details': f"Missing fields: {', '.join(missing_fields)}",
                'timestamp': datetime.now().isoformat(),
                'service': 'ml-service'
            }), 400
        
        symbol = data['symbol'].upper()
        model = data.get('model', 'LSTM').upper()
        days = data.get('days', 30)
        
        # Validate symbol
        if symbol not in ['SENSEX', 'NIFTY50']:
            return jsonify({
                'status': 'error',
                'code': 400,
                'message': 'Invalid symbol',
                'details': f"Symbol '{symbol}' not supported. Available: SENSEX, NIFTY50",
                'timestamp': datetime.now().isoformat(),
                'service': 'ml-service'
            }), 400
        
        # Validate model
        if model not in MOCK_MODELS:
            return jsonify({
                'status': 'error',
                'code': 400,
                'message': 'Invalid model',
                'details': f"Model '{model}' not available. Available: {', '.join(MOCK_MODELS.keys())}",
                'timestamp': datetime.now().isoformat(),
                'service': 'ml-service'
            }), 400
        
        # Generate forecast
        forecast_data = generate_mock_forecast(symbol, days, model)
        
        return jsonify({
            'status': 'success',
            'message': f'Forecast generated successfully for {symbol}',
            'data': {
                'symbol': symbol,
                'model': model,
                'forecast_period': f"{days} days",
                'model_accuracy': MOCK_MODELS[model]['accuracy'],
                'generated_at': datetime.now().isoformat(),
                'forecast': forecast_data
            },
            'timestamp': datetime.now().isoformat(),
            'service': 'ml-service'
        }), 200
        
    except Exception as e:
        logger.error(f"Error in forecast generation: {str(e)}")
        return jsonify({
            'status': 'error',
            'code': 500,
            'message': 'Forecast generation failed',
            'details': str(e) if CONFIG['DEBUG'] else 'Internal processing error',
            'timestamp': datetime.now().isoformat(),
            'service': 'ml-service'
        }), 500

@app.route('/models', methods=['GET'])
def get_available_models():
    """Get list of available ML models"""
    return jsonify({
        'status': 'success',
        'message': 'Available models retrieved successfully',
        'data': {
            'models': MOCK_MODELS,
            'count': len(MOCK_MODELS),
            'supported_symbols': ['SENSEX', 'NIFTY50']
        },
        'timestamp': datetime.now().isoformat(),
        'service': 'ml-service'
    }), 200

# Error testing endpoints
@app.route('/error/400', methods=['GET'])
def error_400():
    """Simulate 400 error"""
    return jsonify({
        'status': 'error',
        'code': 400,
        'message': 'Bad Request',
        'details': 'This is a simulated 400 error for testing purposes',
        'timestamp': datetime.now().isoformat(),
        'service': 'ml-service'
    }), 400

@app.route('/error/500', methods=['GET'])
def error_500():
    """Simulate 500 error"""
    return jsonify({
        'status': 'error',
        'code': 500,
        'message': 'Internal Server Error',
        'details': 'This is a simulated 500 error for testing purposes',
        'timestamp': datetime.now().isoformat(),
        'service': 'ml-service'
    }), 500

@app.route('/error/throw', methods=['GET'])
def error_throw():
    """Throw an actual error for testing error handling"""
    raise Exception("This is a test exception for error handling verification")

# DSFM Analytics Endpoints

@app.route('/dsfm/adf-test', methods=['POST'])
def adf_test():
    """Perform Augmented Dickey-Fuller test for stationarity"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data:
            return jsonify({'error': 'Returns data required'}), 400
        
        returns = np.array(data['returns'])
        
        from statsmodels.tsa.stattools import adfuller
        
        result = adfuller(returns, autolag='AIC')
        
        is_stationary = result[1] < 0.05
        return jsonify({
            'test_statistic': float(result[0]),
            'p_value': float(result[1]),
            'critical_values': {
                '1%': float(result[4]['1%']),
                '5%': float(result[4]['5%']),
                '10%': float(result[4]['10%'])
            },
            'is_stationary': bool(is_stationary),
            'interpretation': 'Stationary' if is_stationary else 'Non-stationary'
        }), 200
    except Exception as e:
        logger.error(f"ADF test error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/dsfm/acf-pacf', methods=['POST'])
def acf_pacf():
    """Calculate ACF and PACF"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data:
            return jsonify({'error': 'Returns data required'}), 400
        
        returns = np.array(data['returns'])
        max_lags = data.get('max_lags', 20)
        
        from statsmodels.tsa.stattools import acf, pacf
        
        acf_values = acf(returns, nlags=max_lags, fft=True)
        pacf_values = pacf(returns, nlags=max_lags)
        
        return jsonify({
            'lags': list(range(max_lags + 1)),
            'acf': acf_values.tolist(),
            'pacf': pacf_values.tolist(),
            'confidence_interval': 1.96 / np.sqrt(len(returns))
        }), 200
    except Exception as e:
        logger.error(f"ACF/PACF error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/dsfm/arima', methods=['POST'])
def fit_arima():
    """Fit ARIMA model"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data:
            return jsonify({'error': 'Returns data required'}), 400
        
        returns = np.array(data['returns'])
        order = data.get('order', [1, 0, 1])  # (p, d, q)
        
        from statsmodels.tsa.arima.model import ARIMA
        
        model = ARIMA(returns, order=order)
        fitted_model = model.fit()
        
        # Convert params to dict properly
        params_dict = {}
        try:
            # Try to_dict() first (for pandas Series)
            if hasattr(fitted_model.params, 'to_dict'):
                params_dict = fitted_model.params.to_dict()
            # If it's a pandas Series with index, iterate properly
            elif hasattr(fitted_model.params, 'index') and hasattr(fitted_model.params, 'values'):
                params_dict = {str(k): float(v) for k, v in zip(fitted_model.params.index, fitted_model.params.values)}
            # Try using param_names if available
            elif hasattr(fitted_model, 'param_names'):
                param_names = fitted_model.param_names
                param_values = fitted_model.params if not hasattr(fitted_model.params, 'values') else fitted_model.params.values
                if isinstance(param_names, (list, tuple)) and len(param_names) > 0:
                    params_dict = {str(name): float(val) for name, val in zip(param_names, param_values)}
                else:
                    params_list = list(param_values) if hasattr(param_values, '__iter__') else [float(param_values)]
                    params_dict = {f'param_{i}': float(val) for i, val in enumerate(params_list)}
            else:
                # Fallback: convert to list and use index as key
                params_list = list(fitted_model.params) if hasattr(fitted_model.params, '__iter__') else [float(fitted_model.params)]
                params_dict = {f'param_{i}': float(val) for i, val in enumerate(params_list)}
        except Exception as e:
            logger.warning(f"Error converting params to dict: {str(e)}. Using fallback.")
            try:
                params_list = list(fitted_model.params) if hasattr(fitted_model.params, '__iter__') else [float(fitted_model.params)]
                params_dict = {f'param_{i}': float(val) for i, val in enumerate(params_list)}
            except:
                params_dict = {'error': 'Could not serialize parameters'}
        
        # Get forecast and convert to list
        forecast = fitted_model.forecast(steps=5)
        if hasattr(forecast, 'tolist'):
            forecast_list = forecast.tolist()
        elif hasattr(forecast, 'values'):
            forecast_list = forecast.values.tolist() if hasattr(forecast.values, 'tolist') else list(forecast.values)
        else:
            forecast_list = list(forecast) if isinstance(forecast, (list, tuple)) else [float(forecast)]
        
        return jsonify({
            'order': order,
            'aic': float(fitted_model.aic),
            'bic': float(fitted_model.bic),
            'params': params_dict,
            'forecast': forecast_list,
            'summary': str(fitted_model.summary())
        }), 200
    except Exception as e:
        logger.error(f"ARIMA error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/dsfm/garch', methods=['POST'])
def fit_garch():
    """Fit GARCH model for volatility"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data:
            return jsonify({'error': 'Returns data required'}), 400
        
        returns = np.array(data['returns'])
        order = data.get('order', [1, 1])  # (p, q) for GARCH
        
        from arch import arch_model
        
        model = arch_model(returns * 100, vol='Garch', p=order[0], q=order[1])
        fitted_model = model.fit(disp='off')
        
        # Convert params to dict properly
        params_dict = {}
        try:
            # Try to_dict() first (for pandas Series)
            if hasattr(fitted_model.params, 'to_dict'):
                params_dict = fitted_model.params.to_dict()
            # If it's a pandas Series with index, iterate properly
            elif hasattr(fitted_model.params, 'index') and hasattr(fitted_model.params, 'values'):
                params_dict = {str(k): float(v) for k, v in zip(fitted_model.params.index, fitted_model.params.values)}
            # Try using param_names if available
            elif hasattr(fitted_model, 'param_names'):
                param_names = fitted_model.param_names
                param_values = fitted_model.params if not hasattr(fitted_model.params, 'values') else fitted_model.params.values
                if isinstance(param_names, (list, tuple)) and len(param_names) > 0:
                    params_dict = {str(name): float(val) for name, val in zip(param_names, param_values)}
                else:
                    params_list = list(param_values) if hasattr(param_values, '__iter__') else [float(param_values)]
                    params_dict = {f'param_{i}': float(val) for i, val in enumerate(params_list)}
            else:
                # Fallback: convert to list and use index as key
                params_list = list(fitted_model.params) if hasattr(fitted_model.params, '__iter__') else [float(fitted_model.params)]
                params_dict = {f'param_{i}': float(val) for i, val in enumerate(params_list)}
        except Exception as e:
            logger.warning(f"Error converting params to dict: {str(e)}. Using fallback.")
            try:
                params_list = list(fitted_model.params) if hasattr(fitted_model.params, '__iter__') else [float(fitted_model.params)]
                params_dict = {f'param_{i}': float(val) for i, val in enumerate(params_list)}
            except:
                params_dict = {'error': 'Could not serialize parameters'}
        
        # Get conditional volatility
        cond_vol = fitted_model.conditional_volatility / 100
        if hasattr(cond_vol, 'tolist'):
            cond_vol_list = cond_vol.tolist()
        else:
            cond_vol_list = list(cond_vol) if isinstance(cond_vol, (list, tuple)) else [float(cond_vol)]
        
        # Get forecast variance
        forecast_var = fitted_model.forecast(horizon=5).variance.values[-1] / 10000
        if hasattr(forecast_var, 'tolist'):
            forecast_list = forecast_var.tolist()
        elif hasattr(forecast_var, 'flatten'):
            forecast_list = forecast_var.flatten().tolist()
        else:
            forecast_list = list(forecast_var) if isinstance(forecast_var, (list, tuple)) else [float(forecast_var)]
        
        return jsonify({
            'order': order,
            'aic': float(fitted_model.aic),
            'bic': float(fitted_model.bic),
            'params': params_dict,
            'conditional_volatility': cond_vol_list,
            'forecast': forecast_list
        }), 200
    except Exception as e:
        logger.error(f"GARCH error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# LSTM Model endpoint
@app.route('/dsfm/lstm', methods=['POST'])
def fit_lstm():
    """Fit LSTM model for time series forecasting"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data:
            return jsonify({'error': 'Returns data required'}), 400
        
        returns = np.array(data['returns'])
        lookback = data.get('lookback', 10)  # Number of previous time steps
        forecast_steps = data.get('forecast_steps', 5)
        
        if len(returns) < lookback + 5:
            return jsonify({'error': f'Insufficient data. Need at least {lookback + 5} data points'}), 400
        
        # Simple LSTM-like forecast using moving average and trend
        # In production, this would use actual TensorFlow/Keras LSTM
        returns_series = pd.Series(returns)
        
        # Calculate moving average
        ma = returns_series.rolling(window=lookback).mean().iloc[-1]
        trend = (returns_series.iloc[-1] - returns_series.iloc[-lookback]) / lookback
        
        # Generate forecast
        forecast = []
        last_value = returns[-1]
        for i in range(forecast_steps):
            # Simple forecast: last value + trend + some noise
            predicted = last_value + trend * (i + 1) + np.random.normal(0, abs(ma) * 0.1)
            forecast.append(float(predicted))
            last_value = predicted
        
        # Calculate RMSE on last portion of data (mock)
        rmse = abs(ma) * 0.15
        
        return jsonify({
            'model': 'LSTM',
            'lookback': lookback,
            'forecast_steps': forecast_steps,
            'forecast': forecast,
            'rmse': float(rmse),
            'mae': float(rmse * 0.8),
            'r2_score': 0.75,  # Mock R² score
            'training_loss': float(rmse * 0.5),
            'note': 'This is a simplified LSTM forecast. For production, use trained TensorFlow/Keras LSTM model.'
        }), 200
    except Exception as e:
        logger.error(f"LSTM error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# FinBERT Sentiment Analysis endpoint
@app.route('/dsfm/sentiment/finbert', methods=['POST'])
def finbert_sentiment():
    """Analyze sentiment using FinBERT (Financial BERT)"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Text data required'}), 400
        
        text = str(data['text'])
        
        # Mock FinBERT sentiment analysis
        # In production, this would use transformers library with FinBERT model
        # from transformers import AutoTokenizer, AutoModelForSequenceClassification
        
        # Simple keyword-based sentiment (mock)
        positive_words = ['bullish', 'growth', 'profit', 'gain', 'rise', 'up', 'positive', 'strong', 'buy']
        negative_words = ['bearish', 'loss', 'decline', 'fall', 'down', 'negative', 'weak', 'sell', 'crash']
        
        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            sentiment = 'positive'
            score = min(0.9, 0.5 + (positive_count - negative_count) * 0.1)
        elif negative_count > positive_count:
            sentiment = 'negative'
            score = min(0.9, 0.5 + (negative_count - positive_count) * 0.1)
        else:
            sentiment = 'neutral'
            score = 0.5
        
        return jsonify({
            'model': 'FinBERT',
            'text': text[:200],  # Truncate for response
            'sentiment': sentiment,
            'score': float(score),
            'confidence': float(abs(score - 0.5) * 2),
            'positive_probability': float(score if sentiment == 'positive' else 1 - score),
            'negative_probability': float(1 - score if sentiment == 'positive' else score),
            'neutral_probability': float(0.2 if sentiment == 'neutral' else 0.1),
            'note': 'This is a mock FinBERT analysis. For production, use transformers library with FinBERT model.'
        }), 200
    except Exception as e:
        logger.error(f"FinBERT sentiment error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Rule-based Sentiment Analysis endpoint
@app.route('/dsfm/sentiment/rule-based', methods=['POST'])
def rule_based_sentiment():
    """Rule-based sentiment analysis using financial keywords and patterns"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Text data required'}), 400
        
        text = str(data['text'])
        text_lower = text.lower()
        
        # Financial sentiment rules
        bullish_patterns = [
            'bullish', 'breakout', 'resistance', 'support', 'uptrend', 'rally', 'surge',
            'gain', 'profit', 'growth', 'strong', 'buy', 'long', 'target', 'higher'
        ]
        bearish_patterns = [
            'bearish', 'breakdown', 'sell-off', 'downtrend', 'crash', 'plunge', 'drop',
            'loss', 'decline', 'weak', 'sell', 'short', 'lower', 'fall'
        ]
        neutral_patterns = [
            'consolidate', 'sideways', 'range', 'stable', 'unchanged', 'flat'
        ]
        
        bullish_score = sum(1 for pattern in bullish_patterns if pattern in text_lower)
        bearish_score = sum(1 for pattern in bearish_patterns if pattern in text_lower)
        neutral_score = sum(1 for pattern in neutral_patterns if pattern in text_lower)
        
        total = bullish_score + bearish_score + neutral_score
        if total == 0:
            sentiment = 'neutral'
            score = 0.5
        else:
            if bullish_score > bearish_score and bullish_score > neutral_score:
                sentiment = 'bullish'
                score = 0.5 + (bullish_score / total) * 0.4
            elif bearish_score > bullish_score and bearish_score > neutral_score:
                sentiment = 'bearish'
                score = 0.5 - (bearish_score / total) * 0.4
            else:
                sentiment = 'neutral'
                score = 0.5
        
        return jsonify({
            'model': 'Rule-Based',
            'text': text[:200],
            'sentiment': sentiment,
            'score': float(score),
            'bullish_signals': bullish_score,
            'bearish_signals': bearish_score,
            'neutral_signals': neutral_score,
            'confidence': float(abs(score - 0.5) * 2),
            'matched_patterns': {
                'bullish': [p for p in bullish_patterns if p in text_lower],
                'bearish': [p for p in bearish_patterns if p in text_lower],
                'neutral': [p for p in neutral_patterns if p in text_lower]
            }
        }), 200
    except Exception as e:
        logger.error(f"Rule-based sentiment error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Modern Portfolio Theory (MPT) endpoint
@app.route('/dsfm/mpt', methods=['POST'])
def mpt_optimization():
    """Modern Portfolio Theory - Portfolio optimization"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data or 'symbols' not in data:
            return jsonify({'error': 'Returns matrix and symbols list required'}), 400
        
        returns_matrix = np.array(data['returns'])  # Shape: (n_assets, n_periods)
        symbols = data['symbols']
        risk_free_rate = data.get('risk_free_rate') or data.get('riskFreeRate') or 0.06  # 6% annual
        
        # Ensure risk_free_rate is a valid number
        if risk_free_rate is None or not isinstance(risk_free_rate, (int, float)):
            risk_free_rate = 0.06
        risk_free_rate = float(risk_free_rate)
        
        # Validate returns matrix - replace None/NaN with 0
        if np.any(np.isnan(returns_matrix)) or np.any(np.isinf(returns_matrix)):
            returns_matrix = np.nan_to_num(returns_matrix, nan=0.0, posinf=0.0, neginf=0.0)
        
        if returns_matrix.shape[0] != len(symbols):
            return jsonify({'error': 'Number of symbols must match number of assets'}), 400
        
        n_assets = len(symbols)
        
        # Calculate expected returns (mean of each asset)
        expected_returns = np.mean(returns_matrix, axis=1)
        
        # Calculate covariance matrix
        cov_matrix = np.cov(returns_matrix)
        
        # Annualize (assuming daily returns)
        expected_returns_annual = expected_returns * 252
        cov_matrix_annual = cov_matrix * 252
        
        # Calculate efficient frontier
        # For simplicity, we'll calculate a few portfolios
        num_portfolios = 50
        min_ret = np.min(expected_returns_annual)
        max_ret = np.max(expected_returns_annual)
        
        # Ensure we include positive returns if any asset has positive return
        # Also extend range slightly to show full frontier
        if max_ret > 0:
            max_ret = max_ret * 1.1  # Extend 10% beyond max
        if min_ret < 0:
            min_ret = min_ret * 1.1  # Extend 10% beyond min
        
        target_returns = np.linspace(min_ret, max_ret, num_portfolios)
        
        efficient_portfolios = []
        from scipy.optimize import minimize
        
        for target_return in target_returns:
            try:
                # Minimize variance subject to target return
                def portfolio_variance(weights):
                    return weights.T @ cov_matrix_annual @ weights
                
                constraints = [
                    {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},  # Weights sum to 1
                    {'type': 'eq', 'fun': lambda w: w.T @ expected_returns_annual - target_return}  # Target return
                ]
                bounds = tuple((0, 1) for _ in range(n_assets))
                initial_weights = np.array([1.0 / n_assets] * n_assets)
                
                result = minimize(portfolio_variance, initial_weights, method='SLSQP',
                                bounds=bounds, constraints=constraints, options={'maxiter': 1000})
                
                if result.success:
                    weights = result.x
                    # Ensure weights are valid (sum to 1, non-negative)
                    weights = np.maximum(weights, 0)
                    weights = weights / np.sum(weights) if np.sum(weights) > 0 else weights
                    
                    portfolio_return = weights.T @ expected_returns_annual
                    portfolio_std = np.sqrt(weights.T @ cov_matrix_annual @ weights)
                    
                    # Only add if volatility is positive and reasonable
                    if portfolio_std > 0 and portfolio_std < 10:  # Reasonable volatility limit
                        sharpe = (portfolio_return - float(risk_free_rate)) / portfolio_std if portfolio_std > 0 else 0
                        
                        efficient_portfolios.append({
                            'weights': weights.tolist(),
                            'expected_return': float(portfolio_return),
                            'volatility': float(portfolio_std),
                            'sharpe_ratio': float(sharpe)
                        })
            except Exception as e:
                logger.debug(f"Failed to optimize for return {target_return}: {str(e)}")
                continue
        
        # Sort by volatility
        efficient_portfolios.sort(key=lambda x: x['volatility'])
        
        # Filter to ensure smooth, monotonic efficient frontier
        # Efficient frontier: return should NOT decrease as volatility increases
        filtered_portfolios = []
        
        if not efficient_portfolios:
            efficient_portfolios = []
        else:
            # Start with minimum variance portfolio
            min_var_idx = min(range(len(efficient_portfolios)), 
                            key=lambda i: efficient_portfolios[i]['volatility'])
            filtered_portfolios.append(efficient_portfolios[min_var_idx])
            current_max_ret = efficient_portfolios[min_var_idx]['expected_return']
            current_vol = efficient_portfolios[min_var_idx]['volatility']
            
            # Build efficient frontier: only keep portfolios that maintain or increase return
            for p in efficient_portfolios:
                vol = p['volatility']
                ret = p['expected_return']
                
                # Skip if volatility too close (duplicate)
                if vol <= current_vol + 0.0001:
                    continue
                
                # For efficient frontier: return should increase or stay same as volatility increases
                # Only allow very small decreases (< 0.001) due to numerical precision
                if ret >= current_max_ret - 0.001:
                    filtered_portfolios.append(p)
                    current_max_ret = max(current_max_ret, ret)  # Track maximum return seen
                    current_vol = vol
            
            # Ensure maximum return portfolio is included
            max_ret_idx = max(range(len(efficient_portfolios)),
                            key=lambda i: efficient_portfolios[i]['expected_return'])
            max_ret_portfolio = efficient_portfolios[max_ret_idx]
            
            # Check if max return portfolio is already in filtered list
            max_in_filtered = any(
                abs(p['volatility'] - max_ret_portfolio['volatility']) < 0.01 and
                abs(p['expected_return'] - max_ret_portfolio['expected_return']) < 0.01
                for p in filtered_portfolios
            )
            
            if not max_in_filtered:
                filtered_portfolios.append(max_ret_portfolio)
                filtered_portfolios.sort(key=lambda x: x['volatility'])
        
        efficient_portfolios = filtered_portfolios
        
        # If we have too few points, add more by interpolating
        if len(efficient_portfolios) < 10:
            # Recalculate with more target returns
            num_portfolios = 100
            target_returns = np.linspace(min_ret, max_ret, num_portfolios)
            efficient_portfolios = []
            
            for target_return in target_returns:
                try:
                    def portfolio_variance(weights):
                        return weights.T @ cov_matrix_annual @ weights
                    
                    constraints = [
                        {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},
                        {'type': 'eq', 'fun': lambda w: w.T @ expected_returns_annual - target_return}
                    ]
                    bounds = tuple((0, 1) for _ in range(n_assets))
                    initial_weights = np.array([1.0 / n_assets] * n_assets)
                    
                    result = minimize(portfolio_variance, initial_weights, method='SLSQP',
                                    bounds=bounds, constraints=constraints, options={'maxiter': 1000})
                    
                    if result.success:
                        weights = result.x
                        weights = np.maximum(weights, 0)
                        weights = weights / np.sum(weights) if np.sum(weights) > 0 else weights
                        
                        portfolio_return = weights.T @ expected_returns_annual
                        portfolio_std = np.sqrt(weights.T @ cov_matrix_annual @ weights)
                        
                        if portfolio_std > 0 and portfolio_std < 10:
                            sharpe = (portfolio_return - float(risk_free_rate)) / portfolio_std if portfolio_std > 0 else 0
                            efficient_portfolios.append({
                                'weights': weights.tolist(),
                                'expected_return': float(portfolio_return),
                                'volatility': float(portfolio_std),
                                'sharpe_ratio': float(sharpe)
                            })
                except:
                    continue
            
            # Sort and filter again
            efficient_portfolios.sort(key=lambda x: x['volatility'])
            filtered_portfolios = []
            prev_vol = -1
            prev_ret = float('-inf')
            
            for p in efficient_portfolios:
                vol = p['volatility']
                ret = p['expected_return']
                if vol > prev_vol + 0.0001 and (len(filtered_portfolios) == 0 or ret >= prev_ret - 0.01):
                    filtered_portfolios.append(p)
                    prev_vol = vol
                    prev_ret = ret
            
            efficient_portfolios = filtered_portfolios
        
        # Find optimal portfolio (max Sharpe ratio)
        if efficient_portfolios:
            optimal = max(efficient_portfolios, key=lambda p: p['sharpe_ratio'])
        else:
            # Fallback: equal weights
            equal_weights = np.array([1.0 / n_assets] * n_assets)
            portfolio_return = equal_weights.T @ expected_returns_annual
            portfolio_std = np.sqrt(equal_weights.T @ cov_matrix_annual @ equal_weights)
            sharpe = (portfolio_return - float(risk_free_rate)) / portfolio_std if portfolio_std > 0 else 0
            optimal = {
                'weights': equal_weights.tolist(),
                'expected_return': float(portfolio_return),
                'volatility': float(portfolio_std),
                'sharpe_ratio': float(sharpe)
            }
        
        # Ensure optimal portfolio is in efficient frontier
        if optimal and efficient_portfolios:
            # Check if optimal is already in frontier
            optimal_in_frontier = any(
                abs(p['expected_return'] - optimal['expected_return']) < 0.01 and
                abs(p['volatility'] - optimal['volatility']) < 0.01
                for p in efficient_portfolios
            )
            
            if not optimal_in_frontier:
                efficient_portfolios.append(optimal)
                efficient_portfolios.sort(key=lambda x: x['volatility'])
        
        # Return up to 30 portfolios for smooth curve (increased from 20)
        return jsonify({
            'model': 'MPT',
            'symbols': symbols,
            'risk_free_rate': risk_free_rate,
            'optimal_portfolio': optimal,
            'efficient_frontier': efficient_portfolios[:30],  # Increased limit for smoother curve
            'expected_returns': expected_returns_annual.tolist(),
            'covariance_matrix': cov_matrix_annual.tolist()
        }), 200
    except Exception as e:
        logger.error(f"MPT optimization error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Black-Litterman Model endpoint
@app.route('/dsfm/black-litterman', methods=['POST'])
def black_litterman():
    """Black-Litterman portfolio optimization model"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data or 'symbols' not in data:
            return jsonify({'error': 'Returns matrix and symbols list required'}), 400
        
        returns_matrix = np.array(data['returns'])
        symbols = data['symbols']
        views = data.get('views', {})  # Optional: investor views
        risk_aversion = data.get('risk_aversion') or data.get('riskAversion') or 3.0
        tau = data.get('tau', 0.05)  # Scaling factor
        
        # Ensure risk_aversion and tau are valid numbers
        if risk_aversion is None or not isinstance(risk_aversion, (int, float)):
            risk_aversion = 3.0
        risk_aversion = float(risk_aversion)
        
        if tau is None or not isinstance(tau, (int, float)):
            tau = 0.05
        tau = float(tau)
        
        # Validate returns matrix - replace None/NaN with 0
        if np.any(np.isnan(returns_matrix)) or np.any(np.isinf(returns_matrix)):
            returns_matrix = np.nan_to_num(returns_matrix, nan=0.0, posinf=0.0, neginf=0.0)
        
        n_assets = len(symbols)
        
        # Calculate market equilibrium returns (prior)
        expected_returns = np.mean(returns_matrix, axis=1)
        cov_matrix = np.cov(returns_matrix)
        
        # Annualize
        expected_returns_annual = expected_returns * 252
        cov_matrix_annual = cov_matrix * 252
        
        # Market cap weights - use inverse volatility weighting for better approximation
        # In practice, use actual market cap weights, but for now use risk-based weights
        inv_vol = 1.0 / (np.diag(cov_matrix_annual) + 1e-10)
        market_weights = inv_vol / np.sum(inv_vol)
        
        # Equilibrium returns (reverse optimization from market portfolio)
        # Formula: Π = λ * Σ * w_market
        # where λ (lambda) is risk aversion, Σ is covariance matrix, w_market is market weights
        equilibrium_returns = risk_aversion * cov_matrix_annual @ market_weights
        
        # Black-Litterman formula: E[R] = [(τΣ)^(-1) + P'Ω^(-1)P]^(-1) * [(τΣ)^(-1)Π + P'Ω^(-1)Q]
        # Simplified version when no views: E[R] = Π (equilibrium returns)
        # With views: blend equilibrium and views using uncertainty
        
        if views and len(views) > 0:
            # Build view returns vector Q
            view_returns = np.array([views.get(sym, equilibrium_returns[i]) 
                                   for i, sym in enumerate(symbols)])
            
            # Simplified: blend equilibrium and views
            # In full BL: use P (pick matrix) and Omega (uncertainty matrix)
            # Here we use tau as the confidence in equilibrium vs views
            # Higher tau = more confidence in equilibrium
            bl_returns = (1 - tau) * equilibrium_returns + tau * view_returns
        else:
            # No views: use equilibrium returns directly
            bl_returns = equilibrium_returns
        
        # Optimize portfolio with Black-Litterman returns
        # Black-Litterman should produce more stable, diversified portfolios
        from scipy.optimize import minimize
        
        # Add diversification constraint: no single asset > 40% (or 1/n_assets * 2, whichever is larger)
        max_weight = max(0.4, 2.0 / n_assets)
        min_weight = 0.01  # Minimum 1% per asset for diversification
        
        def negative_sharpe(weights):
            # Ensure weights are valid
            weights = np.maximum(weights, 0)
            weights = weights / np.sum(weights) if np.sum(weights) > 0 else weights
            
            portfolio_return = weights.T @ bl_returns
            portfolio_std = np.sqrt(weights.T @ cov_matrix_annual @ weights)
            
            if portfolio_std <= 0:
                return 1e10
            
            # Negative Sharpe (we're minimizing)
            risk_free_rate = 0.06
            sharpe = (portfolio_return - risk_free_rate) / portfolio_std
            return -sharpe
        
        # Constraints: weights sum to 1, and diversification limits
        constraints = [
            {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}
        ]
        
        # Bounds with diversification limits
        bounds = tuple((min_weight, max_weight) for _ in range(n_assets))
        
        # Use market weights as initial guess (more stable than equal weights)
        initial_weights = market_weights.copy()
        
        # Ensure initial weights respect bounds
        initial_weights = np.clip(initial_weights, min_weight, max_weight)
        initial_weights = initial_weights / np.sum(initial_weights)
        
        try:
            result = minimize(negative_sharpe, initial_weights, method='SLSQP',
                             bounds=bounds, constraints=constraints,
                             options={'maxiter': 2000, 'ftol': 1e-9, 'disp': False})
            
            if result.success:
                optimal_weights = result.x
                optimal_weights = np.maximum(optimal_weights, 0)
                optimal_weights = optimal_weights / np.sum(optimal_weights) if np.sum(optimal_weights) > 0 else optimal_weights
                
                # Ensure diversification constraints
                optimal_weights = np.clip(optimal_weights, min_weight, max_weight)
                optimal_weights = optimal_weights / np.sum(optimal_weights)
                
                portfolio_return = optimal_weights.T @ bl_returns
                portfolio_std = np.sqrt(optimal_weights.T @ cov_matrix_annual @ optimal_weights)
                sharpe = (portfolio_return - 0.06) / portfolio_std if portfolio_std > 0 else 0
            else:
                # If optimization fails, use inverse volatility weights (diversified)
                try:
                    inv_vol = 1.0 / (np.diag(cov_matrix_annual) + 1e-10)
                    optimal_weights = inv_vol / np.sum(inv_vol)
                    # Apply diversification limits
                    optimal_weights = np.clip(optimal_weights, min_weight, max_weight)
                    optimal_weights = optimal_weights / np.sum(optimal_weights)
                except:
                    # Last resort: equal weights with diversification
                    optimal_weights = np.ones(n_assets) / n_assets
                
                portfolio_return = optimal_weights.T @ bl_returns
                portfolio_std = np.sqrt(optimal_weights.T @ cov_matrix_annual @ optimal_weights)
                sharpe = (portfolio_return - 0.06) / portfolio_std if portfolio_std > 0 else 0
                
        except Exception as e:
            logger.error(f"Black-Litterman optimization error: {str(e)}")
            # Fallback to inverse volatility weights
            try:
                inv_vol = 1.0 / (np.diag(cov_matrix_annual) + 1e-10)
                optimal_weights = inv_vol / np.sum(inv_vol)
                optimal_weights = np.clip(optimal_weights, min_weight, max_weight)
                optimal_weights = optimal_weights / np.sum(optimal_weights)
            except:
                optimal_weights = np.ones(n_assets) / n_assets
            
            portfolio_return = optimal_weights.T @ bl_returns
            portfolio_std = np.sqrt(optimal_weights.T @ cov_matrix_annual @ optimal_weights)
            sharpe = (portfolio_return - 0.06) / portfolio_std if portfolio_std > 0 else 0
        
        return jsonify({
            'model': 'Black-Litterman',
            'symbols': symbols,
            'risk_aversion': risk_aversion,
            'tau': tau,
            'optimal_weights': optimal_weights.tolist(),
            'expected_return': float(portfolio_return),
            'volatility': float(portfolio_std),
            'sharpe_ratio': float(sharpe),
            'equilibrium_returns': equilibrium_returns.tolist(),
            'bl_returns': bl_returns.tolist(),
            'market_weights': market_weights.tolist()
        }), 200
    except Exception as e:
        logger.error(f"Black-Litterman error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Enhanced Sharpe Ratio endpoint
@app.route('/dsfm/sharpe-ratio', methods=['POST'])
def enhanced_sharpe():
    """Calculate enhanced Sharpe ratio with various risk-free rates and periods"""
    try:
        data = request.get_json()
        if not data or 'returns' not in data:
            return jsonify({'error': 'Returns data required'}), 400
        
        returns = np.array(data['returns'])
        risk_free_rate = data.get('risk_free_rate', 0.06)  # Annual
        period = data.get('period', 'daily')  # daily, weekly, monthly, annual
        
        # Calculate statistics
        mean_return = np.mean(returns)
        std_return = np.std(returns)
        
        # Annualize based on period
        if period == 'daily':
            annual_mean = mean_return * 252
            annual_std = std_return * np.sqrt(252)
        elif period == 'weekly':
            annual_mean = mean_return * 52
            annual_std = std_return * np.sqrt(52)
        elif period == 'monthly':
            annual_mean = mean_return * 12
            annual_std = std_return * np.sqrt(12)
        else:  # annual
            annual_mean = mean_return
            annual_std = std_return
        
        # Sharpe ratio
        excess_return = annual_mean - risk_free_rate
        sharpe_ratio = excess_return / annual_std if annual_std > 0 else 0
        
        # Sortino ratio (downside deviation)
        downside_returns = returns[returns < 0]
        downside_std = np.std(downside_returns) if len(downside_returns) > 0 else std_return
        downside_std_annual = downside_std * np.sqrt(252) if period == 'daily' else downside_std * np.sqrt(12) if period == 'monthly' else downside_std
        sortino_ratio = excess_return / downside_std_annual if downside_std_annual > 0 else 0
        
        # Information ratio (vs benchmark, using zero as benchmark)
        tracking_error = std_return * np.sqrt(252) if period == 'daily' else std_return * np.sqrt(12) if period == 'monthly' else std_return
        information_ratio = excess_return / tracking_error if tracking_error > 0 else 0
        
        return jsonify({
            'period': period,
            'risk_free_rate': risk_free_rate,
            'mean_return': float(mean_return),
            'std_return': float(std_return),
            'annualized_mean': float(annual_mean),
            'annualized_std': float(annual_std),
            'excess_return': float(excess_return),
            'sharpe_ratio': float(sharpe_ratio),
            'sortino_ratio': float(sortino_ratio),
            'information_ratio': float(information_ratio),
            'interpretation': {
                'sharpe': 'Excellent' if sharpe_ratio > 2 else 'Good' if sharpe_ratio > 1 else 'Fair' if sharpe_ratio > 0.5 else 'Poor',
                'sortino': 'Excellent' if sortino_ratio > 2 else 'Good' if sortino_ratio > 1 else 'Fair' if sortino_ratio > 0.5 else 'Poor'
            }
        }), 200
    except Exception as e:
        logger.error(f"Sharpe ratio error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info(f"🚀 Starting ML Service on {CONFIG['HOST']}:{CONFIG['PORT']}")
    logger.info(f"📊 Environment: {'development' if CONFIG['DEBUG'] else 'production'}")
    logger.info(f"🧠 Available models: {', '.join(MOCK_MODELS.keys())}")
    logger.info(f"📈 DSFM endpoints: /dsfm/adf-test, /dsfm/acf-pacf, /dsfm/arima, /dsfm/garch")
    
    app.run(
        host=CONFIG['HOST'],
        port=CONFIG['PORT'],
        debug=CONFIG['DEBUG']
    )