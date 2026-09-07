import React from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Info, Sparkles } from "lucide-react";
import { ScanStage } from "../types";

interface ScanStatusProps {
  stage: ScanStage;
  errorMessage?: string | null;
  targetDomain?: string;
  resultCount?: number;
  durationMs?: number;
}

export const ScanStatus: React.FC<ScanStatusProps> = ({
  stage,
  errorMessage,
  targetDomain,
  resultCount,
  durationMs,
}) => {
  const getStageDetails = () => {
    switch (stage) {
      case "validating":
        return {
          title: "Validating domain",
          desc: "Checking syntax, normalizing target root domain...",
          icon: <Loader2 className="w-4 h-4 text-[#ff8a00] animate-spin" />,
          badgeClass: "bg-[#ff8a00]/15 text-[#ff8a00] border-[#ff8a00]/30",
        };
      case "discovering":
        return {
          title: "Discovering subdomains",
          desc: `Querying Certificate Transparency logs (crt.sh) for *.${targetDomain || "target"}...`,
          icon: <Loader2 className="w-4 h-4 text-[#ff8a00] animate-spin" />,
          badgeClass: "bg-[#ff8a00]/15 text-[#ff8a00] border-[#ff8a00]/30",
        };
      case "resolving":
        return {
          title: "Resolving DNS",
          desc: "Resolving candidate hostnames to IPv4 (A) & IPv6 (AAAA) addresses...",
          icon: <Loader2 className="w-4 h-4 text-[#ff8a00] animate-spin" />,
          badgeClass: "bg-[#ff8a00]/15 text-[#ff8a00] border-[#ff8a00]/30",
        };
      case "filtering":
        return {
          title: "Filtering Cloudflare IPs",
          desc: "Validating IP addresses against official Cloudflare CIDR networks...",
          icon: <Loader2 className="w-4 h-4 text-[#ff8a00] animate-spin" />,
          badgeClass: "bg-[#ff8a00]/15 text-[#ff8a00] border-[#ff8a00]/30",
        };
      case "formatting":
        return {
          title: "Formatting results",
          desc: "Deduplicating and organizing verified Cloudflare items...",
          icon: <Loader2 className="w-4 h-4 text-[#ff8a00] animate-spin" />,
          badgeClass: "bg-[#ff8a00]/15 text-[#ff8a00] border-[#ff8a00]/30",
        };
      case "complete":
        return {
          title: "Complete",
          desc: `Found ${resultCount || 0} Cloudflare-hosted ${
            resultCount === 1 ? "record" : "records"
          } in ${((durationMs || 0) / 1000).toFixed(2)}s.`,
          icon: <CheckCircle2 className="w-4 h-4 text-[#35d07f]" />,
          badgeClass: "bg-[#35d07f]/15 text-[#35d07f] border-[#35d07f]/30",
        };
      case "error":
        return {
          title: "Error",
          desc: errorMessage || "Scan could not be completed.",
          icon: <AlertTriangle className="w-4 h-4 text-[#ff5f56]" />,
          badgeClass: "bg-[#ff5f56]/15 text-[#ff5f56] border-[#ff5f56]/30",
        };
      case "canceled":
        return {
          title: "Canceled",
          desc: "Scan was canceled by user.",
          icon: <XCircle className="w-4 h-4 text-[#aab2c0]" />,
          badgeClass: "bg-[#aab2c0]/15 text-[#aab2c0] border-[#aab2c0]/30",
        };
      case "ready":
      default:
        return {
          title: "Ready",
          desc: "Enter a root domain to passively discover Cloudflare-hosted subdomains.",
          icon: <Info className="w-4 h-4 text-[#aab2c0]" />,
          badgeClass: "bg-[#262a36] text-[#aab2c0] border-[#353b4c]",
        };
    }
  };

  const details = getStageDetails();

  return (
    <div
      id="scan-status-area"
      role="status"
      aria-live="polite"
      className="w-full bg-[#181b24] border border-[#262a36] rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#0f1117] border border-[#262a36]">
          {details.icon}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
          <span className="text-xs font-semibold text-[#f5f7fa] tracking-wide">
            {details.title}
          </span>
          <span className="hidden sm:inline text-[#474f63]">|</span>
          <span className="text-xs text-[#aab2c0] font-normal">
            {details.desc}
          </span>
        </div>
      </div>

      {stage !== "ready" && (
        <span
          className={`self-start sm:self-auto text-[11px] font-mono px-2 py-0.5 rounded-full border ${details.badgeClass}`}
        >
          {stage.toUpperCase()}
        </span>
      )}
    </div>
  );
};
