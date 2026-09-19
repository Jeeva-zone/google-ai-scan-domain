import React, { useState, useRef, useEffect } from "react";
import { DomainForm } from "./components/DomainForm";
import { ScanStagesCard } from "./components/ScanStagesCard";
import { QuickHelpCard } from "./components/QuickHelpCard";
import { ResultsTable } from "./components/ResultsTable";
import { EmptyState } from "./components/EmptyState";
import { HelpPanel } from "./components/HelpPanel";
import { SettingsModal } from "./components/SettingsModal";
import {
  ScanResultItem,
  ScanStage,
  ScanResponse,
  ScanSuccessResponse,
} from "./types";
import { ClientScanError, runClientScan } from "./lib/clientScanner";
import { Search, HelpCircle, Download, Radio, Sliders } from "lucide-react";

type ScanEngine = "server" | "browser";

type ServerScanOutcome =
  | { kind: "success"; data: ScanSuccessResponse }
  | { kind: "api-error"; message: string }
  | { kind: "unavailable" };

/**
 * Attempts a scan against the server API.
 *
 * Returns `unavailable` when the app is served statically (no backend):
 * static hosts answer unknown routes with the SPA HTML, or reject POSTs with
 * 405, so the caller can fall back to the in-browser engine.
 */
async function tryServerScan(
  domain: string,
  signal: AbortSignal
): Promise<ServerScanOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    return { kind: "unavailable" };
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return { kind: "unavailable" };

  let data: ScanResponse;
  try {
    data = (await response.json()) as ScanResponse;
  } catch {
    return { kind: "unavailable" };
  }

  if (response.ok && data.success) {
    return { kind: "success", data: data as ScanSuccessResponse };
  }

  if (data && data.success === false && data.error) {
    const fallback =
      response.status === 429
        ? "Rate limit exceeded. Please wait a minute before scanning again."
        : response.status === 502 || response.status === 503
        ? "Subdomain discovery is temporarily unavailable. Please try again later."
        : "Please enter a valid domain, for example: speedtest.net";
    return { kind: "api-error", message: data.error.message || fallback };
  }

  return { kind: "unavailable" };
}

export default function App() {
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [stage, setStage] = useState<ScanStage>("ready");
  const [results, setResults] = useState<ScanResultItem[]>([]);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [discoverySource, setDiscoverySource] = useState<string>("crt.sh");
  const [note, setNote] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The stage that was active when the scan failed (for failure highlighting)
  const [failedStage, setFailedStage] = useState<ScanStage | null>(null);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  // Which engine performed the scan: the server API or the in-browser engine
  const [scanEngine, setScanEngine] = useState<ScanEngine | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const stageTimerRef = useRef<NodeJS.Timeout[]>([]);
  // Bumped whenever a scan is cleared/canceled so stale async handlers
  // (e.g. an AbortError from a superseded scan) can't clobber new state.
  const scanGenerationRef = useRef<number>(0);
  // Mirrors the current stage for async closures (state reads inside
  // handleStartScan would be stale after awaits).
  const stageRef = useRef<ScanStage>("ready");

  const updateStage = (next: ScanStage) => {
    stageRef.current = next;
    setStage(next);
  };

  // Clear simulated stage animation timers
  const clearStageTimers = () => {
    stageTimerRef.current.forEach(clearTimeout);
    stageTimerRef.current = [];
  };

  // Cleanup abort controller and timers on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearStageTimers();
    };
  }, []);

  // Probe the API once so the UI can label which engine is active. A static
  // deployment answers /api/health with the SPA HTML instead of JSON.
  useEffect(() => {
    let isMounted = true;
    fetch("/api/health", { headers: { accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) return null;
        const type = res.headers.get("content-type") || "";
        return type.includes("application/json") ? res.json() : null;
      })
      .then((data) => {
        if (!isMounted) return;
        setScanEngine((current) => current ?? (data?.status === "ok" ? "server" : "browser"));
      })
      .catch(() => {
        if (isMounted) setScanEngine((current) => current ?? "browser");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const applyScanSuccess = (
    data: ScanSuccessResponse,
    controller: AbortController,
    generation: number
  ) => {
    updateStage("formatting");
    // Track the formatting delay so Cancel/Restart can reliably clear it
    const t4 = setTimeout(() => {
      if (controller.signal.aborted || generation !== scanGenerationRef.current) return;
      setResults(data.results || []);
      setDurationMs(data.duration_ms || 0);
      setDiscoverySource(data.discovery_source || "crt.sh");
      setNote(data.note || "");
      updateStage("complete");
    }, 300);
    stageTimerRef.current = [...stageTimerRef.current, t4];
  };

  const handleStartScan = async (domain: string) => {
    // Reset previous scan state
    clearStageTimers();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const generation = ++scanGenerationRef.current;

    setCurrentDomain(domain);
    setResults([]);
    setErrorMessage(null);
    setFailedStage(null);
    setHasScanned(true);

    // Initial stage: validating domain
    updateStage("validating");

    // Progression through honest stages while backend performs discovery and DNS resolution
    const t1 = setTimeout(() => {
      if (!controller.signal.aborted) updateStage("discovering");
    }, 400);

    const t2 = setTimeout(() => {
      if (!controller.signal.aborted) updateStage("resolving");
    }, 2400);

    const t3 = setTimeout(() => {
      if (!controller.signal.aborted) updateStage("filtering");
    }, 4500);

    stageTimerRef.current = [t1, t2, t3];

    try {
      const outcome = await tryServerScan(domain, controller.signal);

      // A newer scan/clear superseded this one — drop the result.
      if (generation !== scanGenerationRef.current) return;

      if (outcome.kind === "success") {
        setScanEngine("server");
        clearStageTimers();
        applyScanSuccess(outcome.data, controller, generation);
        return;
      }

      if (outcome.kind === "api-error") {
        setScanEngine("server");
        clearStageTimers();
        setErrorMessage(outcome.message);
        setFailedStage(stageRef.current);
        updateStage("error");
        return;
      }

      // No backend reachable (static deployment) — scan from the browser.
      setScanEngine("browser");
      clearStageTimers();
      const data = await runClientScan({
        domain,
        signal: controller.signal,
        onStage: (next) => {
          if (generation === scanGenerationRef.current && !controller.signal.aborted) {
            updateStage(next);
          }
        },
      });

      if (generation === scanGenerationRef.current) {
        applyScanSuccess(data, controller, generation);
      }
    } catch (err: any) {
      clearStageTimers();
      if (generation !== scanGenerationRef.current) return;

      if (err?.name === "AbortError") {
        // Only surface "canceled" if this scan is still the active one;
        // a cleared/restarted scan resets to "ready" instead.
        updateStage("canceled");
      } else if (err instanceof ClientScanError && err.code === "CANCELED") {
        updateStage("canceled");
      } else {
        setErrorMessage(
          err instanceof ClientScanError
            ? err.message
            : "Subdomain discovery is temporarily unavailable. Please try again later."
        );
        setFailedStage(stageRef.current);
        updateStage("error");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelScan = () => {
    clearStageTimers();
    scanGenerationRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    updateStage("canceled");
  };

  const handleClearResults = () => {
    clearStageTimers();
    // Invalidate any in-flight scan callbacks before aborting
    scanGenerationRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCurrentDomain("");
    setResults([]);
    setErrorMessage(null);
    setFailedStage(null);
    setHasScanned(false);
    updateStage("ready");
  };

  const isScanning =
    stage === "validating" ||
    stage === "discovering" ||
    stage === "resolving" ||
    stage === "filtering" ||
    stage === "formatting";

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#f5f7fa] font-sans flex flex-col md:flex-row border-0 md:border-8 border-[#181b24] box-border overflow-x-hidden">
      {/* Side Rail for Desktop / Top Bar for Mobile */}
      <aside className="w-full md:w-20 border-b md:border-b-0 md:border-r border-[#181b24] flex flex-row md:flex-col items-center justify-between md:justify-start py-3 px-4 md:py-8 md:px-0 gap-4 md:gap-8 bg-[#0c0e14] shrink-0 z-20">
        <button
          type="button"
          onClick={handleClearResults}
          title="Orange Test Home"
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#181b24] flex items-center justify-center border border-[#ff8a00] shadow-lg shadow-[#ff8a00]/20 hover:scale-105 transition-all cursor-pointer"
        >
          <span className="text-xl sm:text-2xl" aria-hidden="true">🟠</span>
        </button>

        <nav className="flex flex-row md:flex-col items-center gap-3 sm:gap-6">
          <button
            type="button"
            onClick={handleClearResults}
            className="w-9 h-9 rounded-xl bg-[#ff8a00]/15 text-[#ff8a00] border border-[#ff8a00]/30 flex items-center justify-center transition-colors cursor-pointer"
            title="Scan Workspace"
          >
            <Radio className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-[#aab2c0] hover:text-[#f5f7fa] border border-white/5 flex items-center justify-center transition-colors cursor-pointer"
            title="Documentation & Ethics"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <a
            href="/orange-test.zip"
            download="orange-test.zip"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-[#aab2c0] hover:text-[#f5f7fa] border border-white/5 flex items-center justify-center transition-colors"
            title="Download ZIP archive"
          >
            <Download className="w-4 h-4" />
          </a>
        </nav>

        <div
          className="mt-auto opacity-25 text-[10px] font-mono uppercase tracking-widest md:rotate-180 hidden md:block select-none"
          style={{ writingMode: "vertical-rl" }}
        >
          v1.0.4-stable
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative grid-pattern min-w-0">
        {/* Animated Scanner line when scanning */}
        {isScanning && <div className="scanner-line animate-pulse" />}

        {/* Accessible screen-reader announcement */}
        <div id="scan-status-area" role="status" aria-live="polite" className="sr-only">
          Status: {stage}
        </div>

        {/* Workstation Header */}
        <header className="p-4 sm:p-6 lg:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter uppercase italic text-[#f5f7fa]"
              style={{ fontFamily: "Arial Black, sans-serif" }}
            >
              Orange <span className="text-[#ff8a00]">Test</span>
            </h1>
            <p className="text-[#aab2c0] font-medium tracking-wide mt-1 text-xs sm:text-sm">
              Find Cloudflare-hosted subdomains
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2.5">
            <div className="flex items-center sm:justify-end gap-2 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  isScanning
                    ? "bg-[#ff8a00] animate-ping"
                    : stage === "complete"
                    ? "bg-[#35d07f]"
                    : stage === "error"
                    ? "bg-[#ff5f56]"
                    : stage === "canceled"
                    ? "bg-[#aab2c0]"
                    : "bg-[#35d07f]"
                }`}
              />
              <span
                className={`uppercase font-bold tracking-wider text-xs ${
                  stage === "complete"
                    ? "text-[#35d07f]"
                    : stage === "error"
                    ? "text-[#ff5f56]"
                    : isScanning
                    ? "text-[#ff8a00]"
                    : "text-[#35d07f]"
                }`}
              >
                Status: {stage === "ready" ? "Ready" : stage === "canceled" ? "Idle" : stage}
              </span>
              <span className="text-[#aab2c0]/40 font-mono text-xs">•</span>
              <span className="text-[#aab2c0] text-[10px] uppercase tracking-tighter font-mono">
                {stage === "complete"
                  ? `Duration: ${(durationMs / 1000).toFixed(2)}s`
                  : scanEngine === "browser"
                  ? "Engine: Browser (CT + DoH)"
                  : scanEngine === "server"
                  ? "Engine: Server (CT + CIDR)"
                  : "Engine: Passive CT & CIDR"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="header-variable-settings-button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#f5f7fa] bg-[#181b24] hover:bg-[#202430] border border-[#262a36] hover:border-[#ff8a00]/40 transition-colors cursor-pointer"
                title="Configure variables & scan limits"
              >
                <Sliders className="w-3.5 h-3.5 text-[#ff8a00]" />
                <span>Variable Settings</span>
              </button>

              <button
                type="button"
                id="header-help-button"
                onClick={() => setIsHelpOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#aab2c0] hover:text-[#f5f7fa] bg-[#181b24] hover:bg-[#202430] border border-[#262a36] transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Docs</span>
              </button>

              <a
                id="header-download-zip"
                href="/orange-test.zip"
                download="orange-test.zip"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#aab2c0] hover:text-[#f5f7fa] bg-[#181b24] hover:bg-[#202430] border border-[#262a36] transition-colors"
                title="Download full project ZIP archive"
              >
                <Download className="w-3.5 h-3.5 text-[#ff8a00]" />
                <span>Download ZIP</span>
              </a>
            </div>
          </div>
        </header>

        {/* Domain Form Input Card */}
        <section className="px-4 sm:px-6 lg:px-8 mb-6">
          <DomainForm
            onScan={handleStartScan}
            onCancel={handleCancelScan}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isScanning={isScanning}
          />
        </section>

        {/* 2-Column Workstation Dashboard */}
        <section className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 flex flex-col lg:flex-row gap-6 min-h-0">
          {/* Primary View (Results / In-flight Status / Empty State) */}
          <div className="flex-1 lg:flex-[2] flex flex-col min-h-0 min-w-0">
            {stage === "complete" && results.length > 0 && (
              <ResultsTable
                results={results}
                domain={currentDomain}
                durationMs={durationMs}
                discoverySource={discoverySource}
                note={note}
                onClear={handleClearResults}
              />
            )}

            {stage === "complete" && results.length === 0 && (
              <EmptyState type="no_results" domain={currentDomain} />
            )}

            {stage === "error" && (
              <EmptyState
                type={
                  errorMessage?.toLowerCase().includes("rate limit")
                    ? "rate_limited"
                    : errorMessage?.includes("valid domain")
                    ? "invalid_domain"
                    : "discovery_failed"
                }
                customMessage={errorMessage || undefined}
                domain={currentDomain}
                onRetry={async () => {
                  try {
                    await fetch("/api/reset-rate-limit", { method: "POST" });
                  } catch {
                    // Ignore network reset errors
                  }
                  handleStartScan(currentDomain || "speedtest.net");
                }}
              />
            )}

            {isScanning && (
              <div className="w-full bg-[#181b24] rounded-2xl border border-white/5 p-8 sm:p-12 text-center space-y-4 shadow-xl relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-[#ff8a00]/15 border border-[#ff8a00]/30 text-[#ff8a00] flex items-center justify-center mx-auto text-2xl animate-pulse">
                  🟠
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#f5f7fa] uppercase tracking-wider">
                    Analyzing <span className="text-[#ff8a00] font-mono">{currentDomain}</span>
                  </h3>
                  <p className="text-xs text-[#aab2c0] max-w-md mx-auto">
                    Actively progressing through Certificate Transparency logs and verifying Cloudflare IP network ranges...
                  </p>
                </div>
                <div className="w-48 h-1.5 bg-white/5 rounded-full mx-auto overflow-hidden">
                  <div className="h-full pill-gradient rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            )}

            {!isScanning && stage !== "complete" && stage !== "error" && (
              <EmptyState type="idle" />
            )}
          </div>

          {/* Secondary Column (Stages Card & Quick Help Card) */}
          <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
            <ScanStagesCard
              stage={stage}
              errorMessage={errorMessage}
              failedStage={failedStage}
            />
            <QuickHelpCard
              onOpenHelp={() => setIsHelpOpen(true)}
              onClearSession={handleClearResults}
              hasActiveData={hasScanned || results.length > 0}
            />
          </div>
        </section>
      </main>

      {/* Help Modal */}
      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Variable Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        browserMode={scanEngine === "browser"}
      />
    </div>
  );
}
