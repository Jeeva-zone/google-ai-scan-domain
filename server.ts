import express from "express";
import path from "path";
import fs from "fs";
import type { Server } from "http";
import { execFile } from "child_process";

const app = express();
// Respect the PORT injected by the hosting environment (Freebuff/Heroku/etc.);
// fall back to 3000 for local development.
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: "1mb" }));

// In-memory rate limiting map for Node server
const rateLimitMap = new Map<string, number>();

// Helper to extract client IP from headers
function getClientIp(req: express.Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ status: "ok" });
});

// Sample domains served from sample-domains.txt in the repo root.
// Edit that file (one domain per line) to change the example chips in the web UI.
const SAMPLE_DOMAINS_PATH = path.join(process.cwd(), "sample-domains.txt");

function parseSampleDomains(raw: string): string[] {
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const domain = trimmed.split("#")[0].trim();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }
  return domains;
}

app.get("/api/sample-domains", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const raw = fs.readFileSync(SAMPLE_DOMAINS_PATH, "utf-8");
    res.json({ success: true, domains: parseSampleDomains(raw) });
  } catch (err) {
    console.error("Failed to read sample-domains.txt:", err);
    res.json({ success: true, domains: [] });
  }
});

// Configuration variables endpoint (GET current, POST update)
app.get("/api/config", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({
    MAX_CANDIDATES: parseInt(process.env.MAX_CANDIDATES || "1000", 10),
    DNS_CONCURRENCY: parseInt(process.env.DNS_CONCURRENCY || "25", 10),
    REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || "30", 10),
    MAX_RESULTS: parseInt(process.env.MAX_RESULTS || "500", 10),
    RATE_LIMIT_SECONDS: parseInt(process.env.RATE_LIMIT_SECONDS || "0", 10),
    CF_CACHE_TTL_SECONDS: parseInt(process.env.CF_CACHE_TTL_SECONDS || "3600", 10),
  });
});

app.post("/api/config", (req, res) => {
  const updates = req.body || {};
  const validKeys = [
    "MAX_CANDIDATES",
    "DNS_CONCURRENCY",
    "REQUEST_TIMEOUT",
    "MAX_RESULTS",
    "RATE_LIMIT_SECONDS",
    "CF_CACHE_TTL_SECONDS",
  ];

  for (const key of validKeys) {
    if (updates[key] !== undefined && updates[key] !== null) {
      const num = parseInt(String(updates[key]), 10);
      if (!isNaN(num) && num >= 0) {
        process.env[key] = String(num);
      }
    }
  }

  // Persist to .env file so changes are durable
  try {
    const envLines = [
      "# Orange Test Environment Configuration",
      `MAX_CANDIDATES=${process.env.MAX_CANDIDATES || "1000"}`,
      `DNS_CONCURRENCY=${process.env.DNS_CONCURRENCY || "25"}`,
      `REQUEST_TIMEOUT=${process.env.REQUEST_TIMEOUT || "30"}`,
      `MAX_RESULTS=${process.env.MAX_RESULTS || "500"}`,
      `RATE_LIMIT_SECONDS=${process.env.RATE_LIMIT_SECONDS || "0"}`,
      `CF_CACHE_TTL_SECONDS=${process.env.CF_CACHE_TTL_SECONDS || "3600"}`,
      "",
    ];
    fs.writeFileSync(path.join(process.cwd(), ".env"), envLines.join("\n"), "utf-8");
  } catch (err) {
    console.error("Failed to write .env file:", err);
  }

  const current = {
    MAX_CANDIDATES: parseInt(process.env.MAX_CANDIDATES || "1000", 10),
    DNS_CONCURRENCY: parseInt(process.env.DNS_CONCURRENCY || "25", 10),
    REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || "30", 10),
    MAX_RESULTS: parseInt(process.env.MAX_RESULTS || "500", 10),
    RATE_LIMIT_SECONDS: parseInt(process.env.RATE_LIMIT_SECONDS || "0", 10),
    CF_CACHE_TTL_SECONDS: parseInt(process.env.CF_CACHE_TTL_SECONDS || "3600", 10),
  };

  res.json({
    success: true,
    message: "Variables saved successfully.",
    config: current,
  });
});

// Reset rate limit endpoint
app.post("/api/reset-rate-limit", (req, res) => {
  rateLimitMap.clear();
  res.json({ success: true, message: "Rate limit tracker reset." });
});

// Scan endpoint
app.post("/api/scan", (req, res) => {
  const clientIp = getClientIp(req);
  const now = Date.now();
  const currentRateLimit = parseInt(process.env.RATE_LIMIT_SECONDS || "0", 10);

  // Clean old rate limit entries
  for (const [ip, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > 600000) {
      rateLimitMap.delete(ip);
    }
  }

  // Check rate limit only if explicitly enabled
  if (currentRateLimit > 0) {
    const lastScan = rateLimitMap.get(clientIp);
    if (lastScan) {
      const elapsed = Math.floor((now - lastScan) / 1000);
      if (elapsed < currentRateLimit) {
        const remaining = currentRateLimit - elapsed;
        res.setHeader("Retry-After", remaining.toString());
        return res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded. Please wait ${remaining} seconds before scanning again.`,
          },
        });
      }
    }
  }

  const { domain } = req.body || {};
  if (!domain || typeof domain !== "string" || !domain.trim()) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DOMAIN",
        message: "Please enter a valid domain, for example: speedtest.net",
      },
    });
  }

  // Record timestamp before launching scan if rate limiting enabled
  if (currentRateLimit > 0) {
    rateLimitMap.set(clientIp, now);
  }

  const payload = JSON.stringify({ domain: domain.trim() });
  const child = execFile(
    "python3",
    ["-m", "backend.scanner", payload],
    {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      maxBuffer: 10 * 1024 * 1024,
    },
    (error, stdout, stderr) => {
      if (res.headersSent) return;

      const raw = (stdout || "").trim();
      try {
        const jsonStart = raw.indexOf("{");
        const jsonEnd = raw.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error(`No JSON block found in scanner output. Raw: ${raw} Stderr: ${stderr}`);
        }

        const jsonStr = raw.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);

        if (parsed.success) {
          return res.status(200).json(parsed);
        } else {
          const errorCode = parsed.error?.code;
          let statusCode = 400;
          if (errorCode === "DISCOVERY_UNAVAILABLE") statusCode = 503;
          else if (errorCode === "CLOUDFLARE_UNAVAILABLE") statusCode = 502;
          else if (errorCode === "INTERNAL_ERROR") statusCode = 500;
          return res.status(statusCode).json(parsed);
        }
      } catch (parseErr) {
        console.error("Scanner execution parse error:", parseErr, "STDOUT:", raw, "STDERR:", stderr);
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while processing scan results.",
          },
        });
      }
    }
  );

  res.on("close", () => {
    if (!res.writableEnded && !child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
  });
});

async function startServer(): Promise<Server> {
  if (process.env.NODE_ENV !== "production") {
    // Lazy-import Vite only in development so the production bundle
    // never requires the dev server toolchain at runtime.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return new Promise((resolve, reject) => {
    const server = app
      .listen(PORT, "0.0.0.0", () => {
        console.log(`Orange Test server running on http://localhost:${PORT}`);
        resolve(server);
      })
      .on("error", reject);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Orange Test server:", err);
  process.exit(1);
});
