"""
Results formatting, plain text line generator, and CSV export module.
Only formats and includes Cloudflare records (orange results).
"""
import csv
import io
from typing import Any, Dict, List


def format_result_item(hostname: str, ip: str) -> Dict[str, Any]:
    """Formats a validated Cloudflare host-IP pair into the standardized result schema."""
    return {
        "hostname": hostname.strip().lower(),
        "ip": ip.strip(),
        "cloudflare": True,
    }


def format_text_line(hostname: str, ip: str) -> str:
    """Formats a single record with orange circle emoji for display/clipboard copying."""
    return f"🟠 {hostname.strip().lower()} — {ip.strip()}"


def format_all_text_lines(results: List[Dict[str, Any]]) -> str:
    """Formats multiple Cloudflare records into newline-separated text lines."""
    lines = [
        format_text_line(item["hostname"], item["ip"])
        for item in results
        if item.get("cloudflare") is True
    ]
    return "\n".join(lines)


def generate_csv_data(results: List[Dict[str, Any]]) -> str:
    """
    Generates standard RFC 4180 CSV with header:
    hostname,ip,cloudflare
    
    Escapes quotes, commas, and special characters properly using Python's standard csv writer.
    Only includes verified Cloudflare items.
    """
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["hostname", "ip", "cloudflare"])

    for item in results:
        if item.get("cloudflare") is True:
            writer.writerow([item["hostname"], item["ip"], "true"])

    return output.getvalue()
