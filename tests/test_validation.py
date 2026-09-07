"""
Tests for domain validation and normalization (Points 1 and 2).
"""
import unittest
from backend.validation import normalize_and_validate_domain


class TestDomainValidation(unittest.TestCase):
    def test_valid_domain_normalization(self):
        """Test Point 1: Valid domain normalization."""
        # Simple domain
        self.assertEqual(normalize_and_validate_domain("speedtest.net"), "speedtest.net")
        # Mixed case and whitespace
        self.assertEqual(normalize_and_validate_domain("  SPEEDTEST.NET  "), "speedtest.net")
        # Trailing dot
        self.assertEqual(normalize_and_validate_domain("speedtest.net."), "speedtest.net")
        # With scheme
        self.assertEqual(normalize_and_validate_domain("https://speedtest.net"), "speedtest.net")
        self.assertEqual(normalize_and_validate_domain("http://speedtest.net"), "speedtest.net")
        # With path and port
        self.assertEqual(normalize_and_validate_domain("https://sub.speedtest.net:8443/scan?test=1#anchor"), "sub.speedtest.net")
        # Multilevel subdomain
        self.assertEqual(normalize_and_validate_domain("deep.level.speedtest.net"), "deep.level.speedtest.net")

    def test_invalid_domain_rejection(self):
        """Test Point 2: Invalid domain rejection."""
        invalid_domains = [
            "",
            "   ",
            "localhost",
            "speedtest",  # missing TLD
            "104.18.6.178",  # IP address not domain
            "2606:4700::6812:6b2",  # IPv6 not domain
            "*.speedtest.net",  # wildcard in input domain
            "speedtest..net",  # consecutive dots
            "-speedtest.net",  # leading dash
            "speedtest-.net",  # trailing dash in label
            "speed test.net",  # space
            "speedtest.net;rm -rf /",  # command injection chars
            "speedtest.net<script>",
            "http://",
        ]
        for invalid in invalid_domains:
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    normalize_and_validate_domain(invalid)


if __name__ == "__main__":
    unittest.main()
