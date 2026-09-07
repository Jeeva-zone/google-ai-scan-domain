"""
Rate limiting module for Orange Test.
Default: 1 scan per client IP every 60 seconds (configurable via RATE_LIMIT_SECONDS).
Provides an in-memory store suitable for single-instance / local runs,
with a clean interface designed to plug in Redis or Upstash for distributed serverless environments.
"""
import time
import threading
from typing import Dict, Optional, Tuple
from backend.config import RATE_LIMIT_SECONDS


class InMemoryRateLimiter:
    """Thread-safe in-memory rate limiter tracking the last scan timestamp per client IP."""

    def __init__(self, limit_seconds: int = RATE_LIMIT_SECONDS):
        self.limit_seconds = limit_seconds
        self._last_access: Dict[str, float] = {}
        self._lock = threading.Lock()

    def check_and_record(self, client_ip: str) -> Tuple[bool, int]:
        """
        Checks if client IP is allowed to initiate a new scan.
        If allowed, records the current timestamp and returns (True, 0).
        If rate limited, returns (False, remaining_seconds).
        """
        if self.limit_seconds <= 0:
            return True, 0

        now = time.time()
        with self._lock:
            # Clean up old records older than 10 minutes to prevent memory leak
            stale_threshold = now - 600
            for ip, ts in list(self._last_access.items()):
                if ts < stale_threshold:
                    del self._last_access[ip]

            last_time = self._last_access.get(client_ip)
            if last_time is not None:
                elapsed = now - last_time
                if elapsed < self.limit_seconds:
                    remaining = int(self.limit_seconds - elapsed) + 1
                    return False, remaining

            # Allow and update timestamp
            self._last_access[client_ip] = now
            return True, 0

    def reset_for_testing(self) -> None:
        """Resets the rate limiter table."""
        with self._lock:
            self._last_access.clear()


# Default global singleton rate limiter instance
_global_limiter = InMemoryRateLimiter()


def check_rate_limit(client_ip: str) -> Tuple[bool, int]:
    """Public helper to evaluate rate limit for client IP."""
    safe_ip = (client_ip or "127.0.0.1").strip()
    return _global_limiter.check_and_record(safe_ip)


def reset_rate_limit() -> None:
    """Public helper to clear rate limit tracker."""
    _global_limiter.reset_for_testing()


def extract_client_ip(headers: Dict[str, str], remote_addr: Optional[str] = None) -> str:
    """
    Extracts the client IP from proxy headers (x-forwarded-for, x-real-ip) or remote address.
    """
    normalized_headers = {k.lower(): v for k, v in headers.items()}
    
    # Check X-Forwarded-For (client is first IP in list)
    xff = normalized_headers.get("x-forwarded-for")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[0]

    # Check X-Real-IP
    x_real = normalized_headers.get("x-real-ip")
    if x_real:
        return x_real.strip()

    return remote_addr or "127.0.0.1"
