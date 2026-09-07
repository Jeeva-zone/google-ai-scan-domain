"""
Main scanner module and CLI interface for Orange Test.
Provides safe execution wrapper, error handling, and JSON serialization.
"""
import json
import logging
import sys
from typing import Any, Dict, Tuple

from backend.validation import normalize_and_validate_domain
from backend.discovery import DiscoveryUnavailableError
from backend.cloudflare_ranges import CloudflareRangesError
from backend.features.orange_test.service import OrangeTestService

logger = logging.getLogger("orange_test.scanner")


def run_scan(raw_domain: str) -> Tuple[int, Dict[str, Any]]:
    """
    Executes an Orange Test scan and returns (http_status_code, response_dict).
    Guarantees no stack trace leaks to client.
    """
    # Quick validation check
    try:
        normalize_and_validate_domain(raw_domain)
    except ValueError as e:
        return 400, {
            "success": False,
            "error": {
                "code": "INVALID_DOMAIN",
                "message": str(e),
            },
        }

    service = OrangeTestService()

    try:
        data = service.scan(raw_domain)
        return 200, data

    except ValueError as e:
        return 400, {
            "success": False,
            "error": {
                "code": "INVALID_DOMAIN",
                "message": str(e),
            },
        }

    except DiscoveryUnavailableError as e:
        logger.warning("Discovery error: %s", e)
        return 503, {
            "success": False,
            "error": {
                "code": "DISCOVERY_UNAVAILABLE",
                "message": "Subdomain discovery is temporarily unavailable. Please try again later.",
            },
        }

    except CloudflareRangesError as e:
        logger.warning("Cloudflare range error: %s", e)
        return 502, {
            "success": False,
            "error": {
                "code": "CLOUDFLARE_UNAVAILABLE",
                "message": "Cloudflare verification is temporarily unavailable. Please try again later.",
            },
        }

    except Exception as e:
        logger.error("Unexpected error in run_scan: %s", e)
        return 500, {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred while processing the scan request.",
            },
        }


def main():
    """CLI runner: accepts JSON input or domain argument and prints JSON result."""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": {"code": "INVALID_DOMAIN", "message": "Domain parameter is required."}}))
        sys.exit(1)

    arg = sys.argv[1]
    domain = arg
    # Check if argument is JSON string
    if arg.strip().startswith("{"):
        try:
            payload = json.loads(arg)
            domain = payload.get("domain", "")
        except Exception:
            pass

    status_code, response = run_scan(domain)
    print(json.dumps(response), flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
