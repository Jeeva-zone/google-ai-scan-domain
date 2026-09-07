"""
Tests for Cloudflare CIDR matching and non-Cloudflare rejection (Points 5, 6, and 7).
"""
import ipaddress
import unittest
from backend.cloudflare_ranges import is_ip_cloudflare, set_cached_ranges_for_testing


class TestCloudflareRanges(unittest.TestCase):
    def setUp(self):
        # Sample official Cloudflare CIDR ranges for testing
        self.sample_networks = [
            ipaddress.ip_network("104.16.0.0/13"),
            ipaddress.ip_network("104.24.0.0/14"),
            ipaddress.ip_network("172.64.0.0/13"),
            ipaddress.ip_network("108.162.192.0/18"),
            ipaddress.ip_network("2606:4700::/32"),
            ipaddress.ip_network("2400:cb00::/32"),
        ]
        set_cached_ranges_for_testing(self.sample_networks)

    def test_cloudflare_ipv4_cidr_matching(self):
        """Test Point 5: Cloudflare IPv4 CIDR matching."""
        # 104.17.147.22 is in 104.16.0.0/13
        self.assertTrue(is_ip_cloudflare("104.17.147.22", self.sample_networks))
        # 104.18.6.178 is in 104.16.0.0/13
        self.assertTrue(is_ip_cloudflare("104.18.6.178", self.sample_networks))
        # 172.64.150.238 is in 172.64.0.0/13
        self.assertTrue(is_ip_cloudflare("172.64.150.238", self.sample_networks))
        # 108.162.193.5 is in 108.162.192.0/18
        self.assertTrue(is_ip_cloudflare("108.162.193.5", self.sample_networks))

    def test_cloudflare_ipv6_cidr_matching(self):
        """Test Point 6: Cloudflare IPv6 CIDR matching."""
        # 2606:4700:3037::6815:452e is in 2606:4700::/32
        self.assertTrue(is_ip_cloudflare("2606:4700:3037::6815:452e", self.sample_networks))
        # 2400:cb00:2048:1::c629:d7a2 is in 2400:cb00::/32
        self.assertTrue(is_ip_cloudflare("2400:cb00:2048:1::c629:d7a2", self.sample_networks))

    def test_non_cloudflare_ip_rejection(self):
        """Test Point 7: Non-Cloudflare IP rejection."""
        non_cf_ips = [
            "8.8.8.8",  # Google DNS
            "1.1.1.1",  # While Cloudflare operates 1.1.1.1 DNS, its origin/proxy ranges are 104.16/13 etc. Not in tested proxy CIDR
            "142.250.190.46",  # Google
            "151.101.1.69",  # Fastly
            "13.107.42.14",  # Microsoft / Azure
            "192.168.1.1",  # Private RFC 1918
            "127.0.0.1",  # Loopback
            "2001:4860:4860::8888",  # Google IPv6
            "not-an-ip",  # Malformed
            "",
        ]
        for ip in non_cf_ips:
            with self.subTest(ip=ip):
                self.assertFalse(is_ip_cloudflare(ip, self.sample_networks))


if __name__ == "__main__":
    unittest.main()
