"""
Domain validation and normalization module.
"""
import re
import ipaddress
from typing import Tuple

# Regex pattern for valid domain labels (RFC 1035 / RFC 1123)
LABEL_REGEX = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$", re.IGNORECASE)


def is_ip_address(val: str) -> bool:
    """Check if the given string is an IPv4 or IPv6 address."""
    try:
        ipaddress.ip_address(val)
        return True
    except ValueError:
        return False


def normalize_and_validate_domain(raw_input: str) -> str:
    """
    Normalizes and validates a domain name input.
    
    Steps:
    1. Strip leading/trailing whitespace.
    2. Convert to lowercase.
    3. Strip scheme prefixes (http://, https://).
    4. Strip port and path components if present.
    5. Strip trailing dot if present.
    6. Validate length, labels, and characters.
    7. Reject IP addresses and invalid formats.
    
    Raises:
        ValueError: If domain is empty or invalid.
    """
    if not raw_input or not isinstance(raw_input, str):
        raise ValueError("Please enter a valid domain, for example: speedtest.net")

    domain = raw_input.strip().lower()

    # Remove http:// or https:// if pasted by user
    if domain.startswith("http://"):
        domain = domain[7:]
    elif domain.startswith("https://"):
        domain = domain[8:]

    # Remove paths or query strings or fragments
    if "/" in domain:
        domain = domain.split("/")[0].strip()
    if "?" in domain:
        domain = domain.split("?")[0].strip()
    if "#" in domain:
        domain = domain.split("#")[0].strip()

    # Remove port if present (e.g., domain.com:8080)
    if ":" in domain:
        domain = domain.split(":")[0].strip()

    # Strip trailing dot if present
    if domain.endswith("."):
        domain = domain[:-1]

    # Validate overall length
    if not domain or len(domain) > 253:
        raise ValueError("Please enter a valid domain, for example: speedtest.net")

    # Reject if it is an IP address
    if is_ip_address(domain):
        raise ValueError("Please enter a valid domain name, not an IP address (for example: speedtest.net)")

    # Must contain at least one period separating labels (e.g., example.com)
    if "." not in domain:
        raise ValueError("Please enter a valid domain with a TLD, for example: speedtest.net")

    labels = domain.split(".")
    if len(labels) < 2:
        raise ValueError("Please enter a valid domain, for example: speedtest.net")

    # TLD must be at least 2 characters and not all digits
    tld = labels[-1]
    if len(tld) < 2 or tld.isdigit():
        raise ValueError("Please enter a valid domain, for example: speedtest.net")

    for label in labels:
        if not label or len(label) > 63:
            raise ValueError("Please enter a valid domain, for example: speedtest.net")
        if not LABEL_REGEX.match(label):
            raise ValueError("Please enter a valid domain, for example: speedtest.net")

    return domain
