"""
Passive subdomain discovery module using Certificate Transparency logs from crt.sh.
"""
import json
import logging
import urllib.parse
import urllib.request
import urllib.error
from typing import List, Set
from backend.config import MAX_CANDIDATES, REQUEST_TIMEOUT, USER_AGENT

logger = logging.getLogger("orange_test.discovery")

CRT_SH_URL_TEMPLATE = "https://crt.sh/?q=%25.{domain}&output=json"


class DiscoveryUnavailableError(Exception):
    """Raised when Certificate Transparency discovery cannot be reached or returns an error."""
    pass


def normalize_candidate_name(raw_name: str, target_domain: str) -> str:
    """
    Normalizes a discovered hostname candidate:
    - Lowercase
    - Strip whitespace
    - Strip leading wildcard (*. or *)
    - Strip trailing dot (.)
    - Verifies it matches target domain or ends with .{target_domain}
    
    Returns normalized hostname string, or empty string if invalid.
    """
    if not raw_name:
        return ""

    name = raw_name.strip().lower()

    # Remove wildcards e.g. *.example.com or *..example.com
    while name.startswith("*.") or name.startswith("*"):
        name = name.lstrip("*").lstrip(".")

    # Remove trailing dot
    if name.endswith("."):
        name = name[:-1]

    name = name.strip()

    if not name:
        return ""

    # Filter out entries that contain non-hostname characters or spaces
    if any(ch in name for ch in (" ", "\t", "\r", "\n", "/", "\\", "@", ":")):
        return ""

    # Must be either exactly target_domain or a subdomain ending with .{target_domain}
    if name == target_domain or name.endswith("." + target_domain):
        return name

    return ""


def discover_subdomains(domain: str) -> List[str]:
    """
    Discovers candidate subdomains for the given domain using crt.sh Certificate Transparency logs.
    Always includes the root domain itself.
    
    Returns:
        List of unique candidate hostnames up to MAX_CANDIDATES.
        
    Raises:
        DiscoveryUnavailableError: If crt.sh is unreachable, rate limited, or fails.
    """
    normalized_target = domain.strip().lower()
    encoded_domain = urllib.parse.quote(normalized_target)
    url = f"https://crt.sh/?q=%25.{encoded_domain}&output=json"

    candidates: Set[str] = {normalized_target}  # Always include root domain

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            status = resp.status
            if status != 200:
                raise DiscoveryUnavailableError(f"crt.sh returned HTTP status {status}")

            raw_bytes = resp.read()
            if not raw_bytes or not raw_bytes.strip():
                # Empty response from crt.sh still returns at least root domain
                return sorted(list(candidates))

            try:
                data = json.loads(raw_bytes.decode("utf-8", errors="replace"))
            except (ValueError, UnicodeDecodeError) as err:
                # crt.sh occasionally returns HTML error page (e.g. 504 gateway timeout / rate limit)
                logger.warning("crt.sh response was not valid JSON: %s", err)
                raise DiscoveryUnavailableError("Subdomain discovery is temporarily unavailable. Please try again later.") from err

            if not isinstance(data, list):
                logger.warning("Unexpected crt.sh JSON format: not a list")
                return sorted(list(candidates))

            for entry in data:
                if not isinstance(entry, dict):
                    continue
                name_value = entry.get("name_value")
                if not name_value or not isinstance(name_value, str):
                    continue

                # name_value can contain multiple lines
                for raw_line in name_value.splitlines():
                    cleaned = normalize_candidate_name(raw_line, normalized_target)
                    if cleaned:
                        candidates.add(cleaned)
                        if len(candidates) >= MAX_CANDIDATES:
                            break

                if len(candidates) >= MAX_CANDIDATES:
                    break

    except urllib.error.HTTPError as http_err:
        logger.error("HTTP error fetching crt.sh: %s", http_err)
        raise DiscoveryUnavailableError("Subdomain discovery is temporarily unavailable. Please try again later.") from http_err
    except (urllib.error.URLError, TimeoutError, OSError) as net_err:
        logger.error("Network error fetching crt.sh: %s", net_err)
        raise DiscoveryUnavailableError("Subdomain discovery is temporarily unavailable. Please try again later.") from net_err

    # Return sorted list capped at MAX_CANDIDATES
    result_list = sorted(list(candidates))
    return result_list[:MAX_CANDIDATES]
