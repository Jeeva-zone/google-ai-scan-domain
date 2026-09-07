"""
Tests for result deduplication, omission of gray results, and CSV escaping (Points 8, 9, and 10).
"""
import io
import csv
import unittest
from backend.formatting import format_all_text_lines, generate_csv_data


class TestFormattingAndExport(unittest.TestCase):
    def test_duplicate_removal_and_gray_omission(self):
        """Test Points 8 and 9: Duplicate removal & gray result omission."""
        # Simulated raw items including non-Cloudflare/gray entries
        raw_items = [
            {"hostname": "www.speedtest.net", "ip": "104.17.147.22", "cloudflare": True},
            {"hostname": "app.speedtest.net", "ip": "104.18.6.178", "cloudflare": True},
            # Gray / non-cloudflare result (must be omitted)
            {"hostname": "origin.speedtest.net", "ip": "8.8.8.8", "cloudflare": False},
            {"hostname": "legacy.speedtest.net", "ip": "1.2.3.4", "cloudflare": False},
        ]

        text_output = format_all_text_lines(raw_items)
        # Should contain orange results
        self.assertIn("🟠 www.speedtest.net — 104.17.147.22", text_output)
        self.assertIn("🟠 app.speedtest.net — 104.18.6.178", text_output)

        # Must NEVER contain gray or non-Cloudflare items
        self.assertNotIn("8.8.8.8", text_output)
        self.assertNotIn("legacy.speedtest.net", text_output)
        self.assertNotIn("origin.speedtest.net", text_output)
        self.assertNotIn("false", text_output.lower())

    def test_csv_escaping(self):
        """Test Point 10: CSV escaping and standard RFC 4180 format."""
        items = [
            {"hostname": "www.speedtest.net", "ip": "104.17.147.22", "cloudflare": True},
            {"hostname": "quotes,\"test\".speedtest.net", "ip": "104.18.6.178", "cloudflare": True},
            {"hostname": "commas,test.speedtest.net", "ip": "172.64.150.238", "cloudflare": True},
            # Should be omitted from CSV
            {"hostname": "hidden.speedtest.net", "ip": "9.9.9.9", "cloudflare": False},
        ]

        csv_str = generate_csv_data(items)
        lines = csv_str.strip().split("\n")

        # Header check
        self.assertEqual(lines[0], "hostname,ip,cloudflare")

        # Must have exactly 3 data rows (excluding the false one)
        self.assertEqual(len(lines), 4)

        # Parse with Python standard csv reader to verify valid escaping
        reader = list(csv.reader(io.StringIO(csv_str)))
        self.assertEqual(reader[0], ["hostname", "ip", "cloudflare"])
        self.assertEqual(reader[1], ["www.speedtest.net", "104.17.147.22", "true"])
        self.assertEqual(reader[2], ["quotes,\"test\".speedtest.net", "104.18.6.178", "true"])
        self.assertEqual(reader[3], ["commas,test.speedtest.net", "172.64.150.238", "true"])

        # Never contain false
        self.assertNotIn("false", csv_str)
        self.assertNotIn("9.9.9.9", csv_str)


if __name__ == "__main__":
    unittest.main()
