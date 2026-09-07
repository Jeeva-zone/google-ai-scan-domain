"""
Cloudflare IP range retrieval and CIDR matching module.
Fetches official ranges from https://www.cloudflare.com/ips-v4 and ips-v6,
caches them in memory with TTL, and performs CIDR checks using ipaddress.
"""
import ipaddress
import logging
import time
import urllib.request
import urllib.error
from typing import List, Optional, Union
from backend.config import CF_CACHE_TTL_SECONDS, REQUEST_TIMEOUT, USER_AGENT

logger = logging.getLogger("orange_test.cloudflare_ranges")

CF_IPV4_URL = "https://www.cloudflare.com/ips-v4"
CF_IPV6_URL = "https://www.cloudflare.com/ips-v6"

# In-memory cache storage
_cached_networks: Optional[List[Union[ipaddress.IPv4Network, ipaddress.IPv6Network]]] = None
_cache_timestamp: float = 0.0


class CloudflareRangesError(Exception):
    """Raised when Cloudflare IP ranges cannot be retrieved."""
    pass


def _fetch_url_lines(url: str) -> List[str]:
    """Fetch text lines from an HTTP/HTTPS URL with custom User-Agent and timeout."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/plain"}
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as response:
        if response.status != 200:
            raise CloudflareRangesError(f"HTTP {response.status} from {url}")
        content = response.read().decode("utf-8")
        return [line.strip() for line in content.splitlines() if line.strip() and not line.startswith("#")]


def load_cloudflare_ranges(force_refresh: bool = False) -> List[Union[ipaddress.IPv4Network, ipaddress.IPv6Network]]:
    """
    Loads and parses Cloudflare CIDR networks from memory cache or official URLs.
    
    Raises:
        CloudflareRangesError: If the live retrieval fails and cache is empty.
    """
    global _cached_networks, _cache_timestamp

    now = time.time()
    if not force_refresh and _cached_networks is not None and (now - _cache_timestamp) < CF_CACHE_TTL_SECONDS:
        return _cached_networks

    try:
        ipv4_lines = _fetch_url_lines(CF_IPV4_URL)
        ipv6_lines = _fetch_url_lines(CF_IPV6_URL)

        networks: List[Union[ipaddress.IPv4Network, ipaddress.IPv6Network]] = []
        for line in ipv4_lines + ipv6_lines:
            try:
                net = ipaddress.ip_network(line, strict=False)
                networks.append(net)
            except ValueError as e:
                logger.warning("Ignoring invalid CIDR line '%s': %s", line, e)

        if not networks:
            raise CloudflareRangesError("No valid Cloudflare IP ranges could be parsed.")

        _cached_networks = networks
        _cache_timestamp = now
        logger.info("Successfully loaded %d Cloudflare IP networks into cache.", len(networks))
        return _cached_networks

    except Exception as e:
        logger.error("Failed to retrieve Cloudflare IP ranges: %s", e)
        # If previous cache exists even if expired, we can gracefully use it rather than failing
        if _cached_networks is not None and len(_cached_networks) > 0:
            logger.warning("Using stale Cloudflare range cache as fallback.")
            return _cached_networks
        raise CloudflareRangesError("Cloudflare verification is temporarily unavailable. Please try again later.") from e


def is_ip_cloudflare(ip_str: str, networks: Optional[List[Union[ipaddress.IPv4Network, ipaddress.IPv6Network]]] = None) -> bool:
    """
    Checks if a given IP address string belongs to any Cloudflare CIDR network.
    
    Returns:
        True if the IP is Cloudflare-owned, False otherwise.
    """
    if not ip_str:
        return False

    try:
        ip_obj = ipaddress.ip_address(ip_str.strip())
    except ValueError:
        return False

    if networks is None:
        networks = load_cloudflare_ranges()

    for net in networks:
        if ip_obj in net:
            return True

    return False


def set_cached_ranges_for_testing(networks: List[Union[ipaddress.IPv4Network, ipaddress.IPv6Network]]) -> None:
    """Helper to mock/inject cached networks during testing."""
    global _cached_networks, _cache_timestamp
    _cached_networks = networks
    _cache_timestamp = time.time()


def clear_cache() -> None:
    """Clears in-memory range cache."""
    global _cached_networks, _cache_timestamp
    _cached_networks = None
    _cache_timestamp = 0.0
