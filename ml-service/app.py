#!/usr/bin/env python3
"""ML service entrypoint using FastAPI application factory pattern."""

from src import create_app

app = create_app()
