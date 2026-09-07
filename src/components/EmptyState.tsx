import React from "react";
import { AlertCircle, ShieldAlert, Clock, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  type: "no_results" | "discovery_failed" | "invalid_domain" | "rate_limited" | "idle";
  domain?: string;
  customMessage?: string;
  onRetry?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  domain,
  customMessage,
  onRetry,
}) => {
  if (type === "rate_limited") {
    return (
      <div
        id="empty-state-rate-limited"
        className="w-full bg-[#181b24] border border-[#ff8a00]/30 rounded-2xl p-8 sm:p-12 text-center space-y-4 bg-gradient-to-b from-[#ff8a00]/5 to-transparent shadow-xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#ff8a00]/15 border border-[#ff8a00]/30 text-[#ff8a00] flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[#f5f7fa] uppercase tracking-wide">
            Rate Limit Active
          </h3>
          <p className="text-xs text-[#aab2c0] max-w-md mx-auto leading-relaxed">
            {customMessage || "Please wait a moment before launching another scan."}
          </p>
        </div>
        {onRetry && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="pill-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-[#0f1117] hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-[#ff8a00]/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Cooldown & Scan Now</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (type === "no_results") {
    return (
      <div
        id="empty-state-no-results"
        className="w-full bg-[#181b24] border border-white/5 rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#ff8a00]/10 border border-[#ff8a00]/30 text-[#ff8a00] flex items-center justify-center mx-auto text-2xl">
          🟠
        </div>
        <h3 className="text-base font-semibold text-[#f5f7fa]">
          No 🟠 Cloudflare subdomains were found for {domain || "this domain"}.
        </h3>
        <p className="text-xs text-[#aab2c0] max-w-md mx-auto leading-relaxed">
          The subdomains discovered for this host either resolve to non-Cloudflare IP
          addresses, or have no public DNS records at this time.
        </p>
      </div>
    );
  }

  if (type === "discovery_failed") {
    return (
      <div
        id="empty-state-discovery-failed"
        className="w-full bg-[#181b24] border border-[#ff5f56]/30 rounded-2xl p-8 sm:p-12 text-center space-y-3 bg-gradient-to-b from-[#ff5f56]/5 to-transparent shadow-xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#ff5f56]/15 border border-[#ff5f56]/30 text-[#ff5f56] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-[#f5f7fa]">
          {customMessage ||
            "Subdomain discovery is temporarily unavailable. Please try again later."}
        </h3>
        <p className="text-xs text-[#aab2c0] max-w-md mx-auto leading-relaxed">
          External Certificate Transparency data sources may be experiencing high
          traffic or rate limits. Please wait a moment and try again.
        </p>
      </div>
    );
  }

  if (type === "invalid_domain") {
    return (
      <div
        id="empty-state-invalid-domain"
        className="w-full bg-[#181b24] border border-[#ff5f56]/20 rounded-2xl p-6 text-center space-y-2 shadow-xl"
      >
        <div className="w-10 h-10 rounded-xl bg-[#ff5f56]/15 text-[#ff5f56] flex items-center justify-center mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-[#f5f7fa]">
          Please enter a valid domain, for example:
        </h3>
        <p className="font-mono text-xs text-[#ff8a00]">speedtest.net</p>
      </div>
    );
  }

  // Idle state
  return (
    <div
      id="empty-state-idle"
      className="w-full bg-[#181b24] border border-white/5 rounded-2xl p-8 sm:p-10 text-center space-y-5 shadow-xl"
    >
      <div className="w-12 h-12 rounded-2xl bg-[#181b24] border border-[#ff8a00] text-[#ff8a00] flex items-center justify-center mx-auto text-2xl shadow-lg shadow-[#ff8a00]/10">
        🟠
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-[#f5f7fa] uppercase tracking-wide">
          Passive Cloudflare Subdomain Discovery
        </h3>
        <p className="text-xs text-[#aab2c0] max-w-lg mx-auto leading-relaxed">
          Enter a domain above to passively aggregate subdomains from public
          Certificate Transparency logs, resolve DNS records, and filter for
          official Cloudflare edge networks.
        </p>
      </div>

      <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left">
        <div className="p-3.5 rounded-xl bg-[#0f1117] border border-white/5">
          <div className="text-[11px] font-bold text-[#ff8a00] mb-1 uppercase tracking-wider">
            1. Passive Discovery
          </div>
          <div className="text-[11px] text-[#aab2c0] leading-relaxed">
            Queries public Certificate Transparency (crt.sh) logs without touching the target.
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0f1117] border border-white/5">
          <div className="text-[11px] font-bold text-[#ff8a00] mb-1 uppercase tracking-wider">
            2. Dual DNS Resolution
          </div>
          <div className="text-[11px] text-[#aab2c0] leading-relaxed">
            Resolves hostnames to both IPv4 and IPv6 addresses concurrently.
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0f1117] border border-white/5">
          <div className="text-[11px] font-bold text-[#ff8a00] mb-1 uppercase tracking-wider">
            3. Pure Orange Results
          </div>
          <div className="text-[11px] text-[#aab2c0] leading-relaxed">
            Strictly filters against official Cloudflare CIDRs. Never shows gray dots.
          </div>
        </div>
      </div>
    </div>
  );
};

