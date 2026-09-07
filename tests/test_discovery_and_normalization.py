"""
Tests for certificate transparency name normalization and domain-suffix filtering (Points 3 and 4).
"""
import unittest
from backend.discovery import normalize_candidate_name


class TestDiscoveryNormalization(unittest.TestCase):
    def test_wildcard_certificate_name_normalization(self):
        """Test Point 3: Wildcard certificate name normalization."""
        target = "speedtest.net"
        
        # Single wildcard
        self.assertEqual(normalize_candidate_name("*.speedtest.net", target), "speedtest.net")
        self.assertEqual(normalize_candidate_name("*.api.speedtest.net", target), "api.speedtest.net")
        
        # Multiple leading wildcards / dots
        self.assertEqual(normalize_candidate_name("*.*.app.speedtest.net", target), "app.speedtest.net")
        
        # Trailing dot with wildcard
        self.assertEqual(normalize_candidate_name("*.www.speedtest.net.", target), "www.speedtest.net")
        
        # Case insensitive normalization
        self.assertEqual(normalize_candidate_name("*.DEV.SPEEDTEST.NET", target), "dev.speedtest.net")

    def test_domain_suffix_filtering(self):
        """Test Point 4: Domain-suffix filtering."""
        target = "speedtest.net"
        
        # Exact root match
        self.assertEqual(normalize_candidate_name("speedtest.net", target), "speedtest.net")
        
        # Valid subdomains
        self.assertEqual(normalize_candidate_name("www.speedtest.net", target), "www.speedtest.net")
        self.assertEqual(normalize_candidate_name("auth.beta.speedtest.net", target), "auth.beta.speedtest.net")
        
        # Different root / partial match (must be rejected)
        self.assertEqual(normalize_candidate_name("notspeedtest.net", target), "")
        self.assertEqual(normalize_candidate_name("speedtest.net.attacker.com", target), "")
        self.assertEqual(normalize_candidate_name("google.com", target), "")
        self.assertEqual(normalize_candidate_name("otherspeedtest.net", target), "")
        
        # Discard blank or invalid values
        self.assertEqual(normalize_candidate_name("", target), "")
        self.assertEqual(normalize_candidate_name("   ", target), "")
        self.assertEqual(normalize_candidate_name("invalid hostname with spaces.speedtest.net", target), "")


if __name__ == "__main__":
    unittest.main()
