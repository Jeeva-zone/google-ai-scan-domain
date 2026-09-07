"""
Orange Test Service.
Encapsulates domain scanning, subdomain discovery, DNS resolution, and Cloudflare IP filtering.
"""
import logging
import time
from typing import Any, Dict, List, Optional

from backend.config import (
    DNS_CONCURRENCY,
    MAX_CANDIDATES,
    MAX_RESULTS,
)
from backend.validation import normalize_and_validate_domain
from backend.discovery import discover_subdomains, DiscoveryUnavailableError
from backend.dns_resolver import resolve_hostnames_concurrently
from backend.cloudflare_ranges import (
    load_cloudflare_ranges,
    is_ip_cloudflare,
    CloudflareRangesError,
)
from backend.formatting import format_result_item

logger = logging.getLogger("orange_test.service")


class OrangeTestService:
    """Service executing passive Orange Test subdomain and Cloudflare IP scan."""

    def __init__(self, dns_concurrency: int = DNS_CONCURRENCY, max_results: int = MAX_RESULTS):
        self.dns_concurrency = dns_concurrency
        self.max_results = max_results

    def scan(self, raw_domain: str) -> Dict[str, Any]:
        """
        Executes an Orange Test scan for a root domain.
        
        Returns:
            Dictionary matching the Orange Test API specification.
        """
        start_time = time.time()

        # Step 1: Validate domain
        domain = normalize_and_validate_domain(raw_domain)

        # Step 2: Load Cloudflare IP ranges
        cf_networks = load_cloudflare_ranges()

        # Step 3: Discover candidate subdomains via Certificate Transparency
        candidates = discover_subdomains(domain)

        # Step 4: Resolve candidate hostnames to IPv4 and IPv6 concurrently
        resolved_pairs = resolve_hostnames_concurrently(
            candidates, concurrency=self.dns_concurrency
        )

        # Step 5: Filter for Cloudflare IP addresses ONLY
        results: List[Dict[str, Any]] = []
        seen: set = set()

        for hostname, ip in resolved_pairs:
            # Strictly check if IP is within any official Cloudflare CIDR
            if is_ip_cloudflare(ip, cf_networks):
                item_key = (hostname, ip)
                if item_key not in seen:
                    seen.add(item_key)
                    results.append(format_result_item(hostname, ip))
                    if len(results) >= self.max_results:
                        break

        duration_ms = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "domain": domain,
            "results": results,
            "count": len(results),
            "duration_ms": max(duration_ms, 1),
            "discovery_source": "crt.sh",
            "note": "Certificate Transparency discovery may not find every subdomain.",
        }
