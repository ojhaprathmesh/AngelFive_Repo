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