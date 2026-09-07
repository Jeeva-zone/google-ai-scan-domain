import React, { useState } from "react";
import {
  Copy,
  Check,
  Download,
  Trash2,
  Filter,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { ScanResultItem } from "../types";

interface ResultsTableProps {
  results: ScanResultItem[];
  domain: string;
  durationMs: number;
  discoverySource: string;
  note: string;
  onClear: () => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  domain,
  durationMs,
  discoverySource,
  note,
  onClear,
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Filtered list based on user search
  const filteredResults = results.filter((item) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return item.hostname.toLowerCase().includes(q) || item.ip.toLowerCase().includes(q);
  });

  // Copy plain text format: 🟠 hostname — ip
  const handleCopyAll = async () => {
    const textToCopy = results
      .map((item) => `🟠 ${item.hostname} — ${item.ip}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  // Copy single row
  const handleCopySingle = async (item: ScanResultItem, index: number) => {
    const text = `🟠 ${item.hostname} — ${item.ip}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    }
  };

  // Download RFC 4180 CSV
  const handleDownloadCsv = () => {
    // Header
    const rows = [["hostname", "ip", "cloudflare"]];
    // Data rows
    results.forEach((item) => {
      rows.push([item.hostname, item.ip, "true"]);
    });

    const csvContent = rows
      .map((e) =>
        e
          .map((field) => {
            const str = String(field);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orange-test-${domain}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="results-card"
      className="w-full bg-[#181b24] rounded-2xl border border-white/5 flex flex-col min-h-0 relative overflow-hidden shadow-2xl"
    >
      {/* Header bar with count and actions */}
      <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🟠</span>
            <h2 className="font-bold text-sm uppercase tracking-widest text-[#f5f7fa]">
              Results List
            </h2>
          </div>
          <span
            id="result-count-badge"
            className="bg-[#ff8a00]/20 text-[#ff8a00] text-[10px] px-2.5 py-0.5 rounded font-bold font-mono tracking-wider"
          >
            {results.length} FOUND
          </span>
          <div className="hidden md:flex items-center gap-2 text-xs text-[#aab2c0]">
            <span>•</span>
            <span>Target: <strong className="text-[#f5f7fa] font-mono">{domain}</strong></span>
            <span>•</span>
            <span id="scan-duration-text">Time: <strong className="text-[#35d07f] font-mono">{(durationMs / 1000).toFixed(2)}s</strong></span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="copy-results-button"
            type="button"
            onClick={handleCopyAll}
            className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-[11px] uppercase font-bold tracking-tight text-[#f5f7fa] border border-white/5 hover:border-white/15 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy all results in '🟠 hostname — ip' format"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#35d07f]" />
                <span className="text-[#35d07f]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#ff8a00]" />
                <span>Copy Results</span>
              </>
            )}
          </button>

          <button
            id="download-csv-button"
            type="button"
            onClick={handleDownloadCsv}
            className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-[11px] uppercase font-bold tracking-tight text-[#f5f7fa] border border-white/5 hover:border-white/15 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Download CSV containing hostname, ip, cloudflare"
          >
            <Download className="w-3.5 h-3.5 text-[#ff8a00]" />
            <span>Download CSV</span>
          </button>

          <button
            id="clear-results-button"
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 rounded bg-white/5 hover:bg-[#ff5f56]/20 text-[11px] uppercase font-bold tracking-tight text-[#aab2c0] hover:text-[#ff5f56] border border-white/5 hover:border-[#ff5f56]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Clear current scan results"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter / Search bar if more than 3 results */}
      {results.length > 3 && (
        <div className="px-4 py-2.5 border-b border-white/5 bg-[#0f1117]/50">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#aab2c0]">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={`Filter ${results.length} results by hostname or IP...`}
              className="w-full pl-8 pr-4 py-1.5 bg-[#181b24] border border-white/10 rounded-xl text-xs text-[#f5f7fa] placeholder-[#aab2c0]/40 font-mono outline-none focus:border-[#ff8a00]"
            />
          </div>
        </div>
      )}

      {/* Results item list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 max-h-[480px]">
        {filteredResults.map((item, idx) => {
          const isIpv6 = item.ip.includes(":");
          const isCopied = copiedIndex === idx;

          return (
            <div
              key={`${item.hostname}-${item.ip}-${idx}`}
              className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all gap-3 group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <span className="text-lg sm:text-xl select-none shrink-0" title="Verified Cloudflare Network IP">
                  🟠
                </span>
                <span className="font-mono font-bold tracking-tight text-xs sm:text-sm text-[#f5f7fa] truncate">
                  {item.hostname}
                </span>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#aab2c0] group-hover:text-[#f5f7fa] font-mono text-xs sm:text-sm transition-colors">
                    {item.ip}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                      isIpv6
                        ? "bg-purple-900/40 text-purple-300 border border-purple-700/40"
                        : "bg-white/10 text-[#aab2c0]"
                    }`}
                  >
                    {isIpv6 ? "IPv6" : "IPv4"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopySingle(item, idx)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#aab2c0] hover:text-[#f5f7fa] border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                  title="Copy this result in 🟠 hostname — ip format"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-[#35d07f]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#ff8a00]" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer information */}
      <div className="p-4 border-t border-white/5 bg-[#0f1117]/30 text-[10px] text-[#aab2c0]/50 flex flex-col sm:flex-row justify-between gap-1 uppercase font-mono italic">
        <span>Source: Certificate Transparency ({discoverySource})</span>
        <span>Filter: Official Cloudflare Ranges</span>
      </div>
    </div>
  );
};
