"""
Netlify Function: GET /.netlify/functions/sample_domains (rewritten from /api/sample-domains)
Returns sample domains parsed from sample-domains.txt in the repo root.
Edit sample-domains.txt (one domain per line, # comments allowed) to
change the example chips shown in the web UI.
"""
import json
import os

SAMPLE_DOMAINS_FILENAME = "sample-domains.txt"

# Fallback list if sample-domains.txt is unavailable in the deployed bundle
DEFAULT_DOMAINS = [
    "speedtest.net",
    "cloudflare.com",
    "opensignal.com",
    "useinsider.com",
    "codecademy.com",
]


def load_sample_domains():
    # Netlify runs Python functions with the repo root as the working directory
    path = os.path.join(os.getcwd(), SAMPLE_DOMAINS_FILENAME)
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
    except OSError:
        return list(DEFAULT_DOMAINS)

    domains = []
    seen = set()
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        domain = trimmed.split("#", 1)[0].strip()
        if not domain or domain in seen:
            continue
        seen.add(domain)
        domains.append(domain)
    return domains if domains else list(DEFAULT_DOMAINS)


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": "",
        }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
        "body": json.dumps({"success": True, "domains": load_sample_domains()}),
    }
