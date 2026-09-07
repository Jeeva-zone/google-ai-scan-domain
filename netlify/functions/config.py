import json
import os
import sys
from pathlib import Path

ROOT_DIR = str(Path(__file__).resolve().parent.parent.parent)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.config import (
    MAX_CANDIDATES,
    DNS_CONCURRENCY,
    REQUEST_TIMEOUT,
    MAX_RESULTS,
    RATE_LIMIT_SECONDS,
    CF_CACHE_TTL_SECONDS,
)


def get_current_config():
    return {
        "MAX_CANDIDATES": int(os.environ.get("MAX_CANDIDATES", MAX_CANDIDATES)),
        "DNS_CONCURRENCY": int(os.environ.get("DNS_CONCURRENCY", DNS_CONCURRENCY)),
        "REQUEST_TIMEOUT": int(os.environ.get("REQUEST_TIMEOUT", REQUEST_TIMEOUT)),
        "MAX_RESULTS": int(os.environ.get("MAX_RESULTS", MAX_RESULTS)),
        "RATE_LIMIT_SECONDS": int(os.environ.get("RATE_LIMIT_SECONDS", RATE_LIMIT_SECONDS)),
        "CF_CACHE_TTL_SECONDS": int(os.environ.get("CF_CACHE_TTL_SECONDS", CF_CACHE_TTL_SECONDS)),
    }


def handler(event, context):
    method = event.get("httpMethod", "GET")
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    }

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers, "body": ""}

    if method == "POST":
        body_str = event.get("body", "")
        updates = {}
        try:
            if body_str:
                updates = json.loads(body_str)
        except Exception:
            pass

        for key in [
            "MAX_CANDIDATES",
            "DNS_CONCURRENCY",
            "REQUEST_TIMEOUT",
            "MAX_RESULTS",
            "RATE_LIMIT_SECONDS",
            "CF_CACHE_TTL_SECONDS",
        ]:
            if key in updates and updates[key] is not None:
                try:
                    num = int(updates[key])
                    if num >= 0:
                        os.environ[key] = str(num)
                except Exception:
                    pass

        return {
            "statusCode": 200,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({
                "success": True,
                "message": "Variables updated successfully.",
                "config": get_current_config(),
            }),
        }

    return {
        "statusCode": 200,
        "headers": {
            **cors_headers,
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
        "body": json.dumps(get_current_config()),
    }
