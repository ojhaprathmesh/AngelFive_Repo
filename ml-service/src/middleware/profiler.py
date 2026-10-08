import time
import psutil
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class ComputeProfilerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        
        # Memory before
        process = psutil.Process()
        mem_before = process.memory_info().rss
        
        response = await call_next(request)
        
        end_time = time.perf_counter()
        mem_after = process.memory_info().rss
        
        duration_ms = (end_time - start_time) * 1000
        mem_diff_mb = (mem_after - mem_before) / (1024 * 1024)
        
        # Classify workload according to Phase 1 spec
        workload_class = "Lightweight"
        if duration_ms >= 2000:
            workload_class = "Heavy"
        elif duration_ms >= 200:
            workload_class = "Medium"
            
        if request.url.path not in ("/health", "/docs", "/openapi.json"):
            logger.info(
                f"[PROFILER] {request.method} {request.url.path} - "
                f"Class: {workload_class} | Duration: {duration_ms:.2f}ms | "
                f"MemDiff: {mem_diff_mb:.2f}MB"
            )
        
        # Optionally attach custom headers for downstream tracing
        response.headers["X-Compute-Class"] = workload_class
        response.headers["X-Compute-Duration"] = f"{duration_ms:.2f}ms"
        
        return response
