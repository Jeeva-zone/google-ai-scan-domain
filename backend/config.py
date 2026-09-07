"""
Configuration settings for Orange Test backend.
Supports configuration via environment variables with safe defaults.
"""
import os

# Maximum number of candidate subdomains extracted from crt.sh
MAX_CANDIDATES = int(os.environ.get("MAX_CANDIDATES", "1000"))

# Maximum concurrent DNS resolution threads
DNS_CONCURRENCY = int(os.environ.get("DNS_CONCURRENCY", "25"))

# Network request timeout in seconds (for crt.sh and Cloudflare IP endpoints)
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "30"))

# Maximum number of matched Cloudflare results returned to client
MAX_RESULTS = int(os.environ.get("MAX_RESULTS", "500"))

# Rate limiting window in seconds per client IP (0 = disabled)
RATE_LIMIT_SECONDS = int(os.environ.get("RATE_LIMIT_SECONDS", "0"))

# Cache TTL for Cloudflare IP ranges in seconds (default: 1 hour)
CF_CACHE_TTL_SECONDS = int(os.environ.get("CF_CACHE_TTL_SECONDS", "3600"))

# Maximum total scan time limit in seconds
SCAN_TIMEOUT = int(os.environ.get("SCAN_TIMEOUT", "90"))

# Allowed origins for CORS (comma-separated or empty for same-origin only)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

# User agent for outbound HTTP requests
USER_AGENT = os.environ.get(
    "USER_AGENT",
    "OrangeTest/1.0 (+https://github.com/security-research/orange-test)",
)

# Optional API Access Key for server-to-server authorization
API_ACCESS_KEY = os.environ.get("API_ACCESS_KEY", "").strip()
