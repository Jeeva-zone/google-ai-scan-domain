"""
Concurrent DNS resolution module using Python standard library socket.getaddrinfo.
Resolves discovered hostnames to IPv4 (A) and IPv6 (AAAA) addresses.
"""
import concurrent.futures
import ipaddress
import logging
import socket
from typing import Dict, List, Set, Tuple
from backend.config import DNS_CONCURRENCY

logger = logging.getLogger("orange_test.dns_resolver")


def resolve_hostname(hostname: str, timeout_seconds: float = 4.0) -> List[str]:
    """
    Resolves a single hostname to unique IPv4 and IPv6 addresses using standard socket.getaddrinfo.
    Returns list of IP strings.
    """
    resolved_ips: Set[str] = set()

    # socket.getaddrinfo handles both AF_INET and AF_INET6
    # socket default timeout for blocking socket operations
    old_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(timeout_seconds)
        # Port 80 as arbitrary dummy port to resolve sockaddr
        addr_info = socket.getaddrinfo(hostname, 80, proto=socket.IPPROTO_TCP)
        for entry in addr_info:
            sockaddr = entry[4]
            if not sockaddr:
                continue
            ip_str = sockaddr[0]
            # Validate IP format
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                # Skip loopback / link-local / unspecified
                if not ip_obj.is_loopback and not ip_obj.is_unspecified:
                    resolved_ips.add(str(ip_obj))
            except ValueError:
                continue
    except (socket.gaierror, socket.herror, socket.timeout, OSError) as err:
        # Unresolved hostname or timeout - as required, skip silently
        logger.debug("DNS resolution skipped for %s: %s", hostname, err)
    finally:
        socket.setdefaulttimeout(old_timeout)

    return sorted(list(resolved_ips))


def resolve_hostnames_concurrently(
    hostnames: List[str],
    concurrency: int = DNS_CONCURRENCY,
    timeout_per_host: float = 4.0
) -> List[Tuple[str, str]]:
    """
    Concurrently resolves a list of hostnames to IP addresses.
    Returns list of (hostname, ip) pairs for all successfully resolved unique host-IP bindings.
    """
    if not hostnames:
        return []

    results: List[Tuple[str, str]] = []
    seen_pairs: Set[Tuple[str, str]] = set()

    max_workers = max(1, min(concurrency, len(hostnames), 50))

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_host = {
            executor.submit(resolve_hostname, host, timeout_per_host): host
            for host in hostnames
        }

        for future in concurrent.futures.as_completed(future_to_host):
            host = future_to_host[future]
            try:
                ips = future.result()
                for ip in ips:
                    pair = (host, ip)
                    if pair not in seen_pairs:
                        seen_pairs.add(pair)
                        results.append(pair)
            except Exception as e:
                logger.debug("Resolution thread error for %s: %s", host, e)

    # Sort results for deterministic ordering
    results.sort(key=lambda x: (x[0], x[1]))
    return results
