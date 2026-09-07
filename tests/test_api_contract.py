"""
Tests for API contract, error responses, mocked scan pipeline, rate limiting, and maximum-result handling.
(Points 11, 12, 13, and 14).
"""
import ipaddress
import unittest
from unittest.mock import patch

from backend.scanner import run_scan
from backend.rate_limit import InMemoryRateLimiter
from backend.features.orange_test.service import OrangeTestService


class TestApiContractAndPipelines(unittest.TestCase):
    def test_api_invalid_input_response(self):
        """Test Point 11: API invalid-input response."""
        status_code, resp = run_scan("not a valid domain")
        self.assertEqual(status_code, 400)
        self.assertFalse(resp["success"])
        self.assertIn("error", resp)
        self.assertEqual(resp["error"]["code"], "INVALID_DOMAIN")
        self.assertIn("Please enter a valid domain", resp["error"]["message"])

        # Also test with empty string
        status_code_empty, resp_empty = run_scan("")
        self.assertEqual(status_code_empty, 400)
        self.assertFalse(resp_empty["success"])

    @patch("backend.features.orange_test.service.load_cloudflare_ranges")
    @patch("backend.features.orange_test.service.discover_subdomains")
    @patch("backend.features.orange_test.service.resolve_hostnames_concurrently")
    def test_api_success_response_schema(self, mock_resolve, mock_discover, mock_cf_ranges):
        """Test Point 12: API success response schema with mocked discovery and resolution."""
        mock_cf_ranges.return_value = [
            ipaddress.ip_network("104.16.0.0/13"),
            ipaddress.ip_network("172.64.0.0/13"),
        ]
        mock_discover.return_value = ["speedtest.net", "app.speedtest.net", "origin.speedtest.net"]
        mock_resolve.return_value = [
            ("app.speedtest.net", "104.18.6.178"),  # In Cloudflare range
            ("origin.speedtest.net", "8.8.8.8"),     # NOT in Cloudflare range
            ("speedtest.net", "172.64.150.238"),    # In Cloudflare range
        ]

        status_code, data = run_scan("speedtest.net")
        self.assertEqual(status_code, 200)
        self.assertTrue(data["success"])
        self.assertEqual(data["domain"], "speedtest.net")
        self.assertEqual(data["discovery_source"], "crt.sh")
        self.assertIn("note", data)
        self.assertIsInstance(data["duration_ms"], int)

        # Ensure ONLY Cloudflare results returned
        results = data["results"]
        self.assertEqual(len(results), 2)
        self.assertEqual(data["count"], 2)

        for item in results:
            self.assertTrue(item["cloudflare"])
            self.assertIn(item["ip"], ["104.18.6.178", "172.64.150.238"])
            # Never return gray records
            self.assertNotEqual(item["ip"], "8.8.8.8")

    def test_rate_limit_response(self):
        """Test Point 13: Rate-limit response and behavior."""
        limiter = InMemoryRateLimiter(limit_seconds=60)
        client_ip = "203.0.113.195"

        # First attempt: allowed
        allowed, remaining = limiter.check_and_record(client_ip)
        self.assertTrue(allowed)
        self.assertEqual(remaining, 0)

        # Immediate second attempt: rejected with remaining time
        allowed_second, remaining_second = limiter.check_and_record(client_ip)
        self.assertFalse(allowed_second)
        self.assertGreater(remaining_second, 0)
        self.assertLessEqual(remaining_second, 60)

        # Different IP: allowed
        allowed_other, _ = limiter.check_and_record("198.51.100.4")
        self.assertTrue(allowed_other)

    @patch("backend.features.orange_test.service.load_cloudflare_ranges")
    @patch("backend.features.orange_test.service.discover_subdomains")
    @patch("backend.features.orange_test.service.resolve_hostnames_concurrently")
    def test_maximum_result_handling(self, mock_resolve, mock_discover, mock_cf_ranges):
        """Test Point 14: Maximum-result handling (capping at max_results)."""
        mock_cf_ranges.return_value = [ipaddress.ip_network("104.16.0.0/13")]
        mock_discover.return_value = [f"sub{i}.speedtest.net" for i in range(50)]
        mock_resolve.return_value = [
            (f"sub{i}.speedtest.net", f"104.16.1.{i % 250}") for i in range(50)
        ]

        # Service configured with max_results=10
        service = OrangeTestService(max_results=10)
        data = service.scan("speedtest.net")
        self.assertEqual(len(data["results"]), 10)
        self.assertEqual(data["count"], 10)


if __name__ == "__main__":
    unittest.main()
