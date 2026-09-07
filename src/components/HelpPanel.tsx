import React from "react";
import {
  Shield,
  HelpCircle,
  AlertTriangle,
  Code2,
  Lock,
  Layers,
  Sparkles,
  Download,
} from "lucide-react";

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="help-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="help-modal-content"
        className="bg-[#181b24] border border-white/10 rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 text-[#f5f7fa] my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ff8a00]/15 border border-[#ff8a00]/30 flex items-center justify-center text-base">
              🟠
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide">
                About Orange <span className="text-[#ff8a00]">Test</span>
              </h2>
              <p className="text-xs text-[#aab2c0]">
                Passive subdomain discovery and Cloudflare IP classification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#aab2c0] hover:text-[#f5f7fa] px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors uppercase font-mono font-bold"
          >
            Close
          </button>
        </div>

        {/* Authorization Disclaimer */}
        <div className="p-3.5 rounded-xl bg-[#ff5f56]/10 border border-[#ff5f56]/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#ff5f56] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-[#ff5f56] uppercase tracking-wide">
              Authorization Disclaimer & Responsible Use
            </p>
            <p className="text-[#e2e6ef] leading-relaxed">
              Use this tool only on domains you own or are authorized to assess.
              Orange Test operates strictly passively: it never performs port scanning,
              vulnerability probing, exploitation, brute-forcing, or stealth bypass.
            </p>
          </div>
        </div>

        {/* Technical Explanations */}
        <div className="space-y-3.5 text-xs text-[#aab2c0]">
          {/* Certificate Transparency */}
          <div className="p-3.5 rounded-xl bg-[#0f1117] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-[#f5f7fa]">
              <Layers className="w-4 h-4 text-[#ff8a00]" />
              <span>Certificate Transparency (crt.sh) Mechanism & Limitations</span>
            </div>
            <p className="leading-relaxed">
              Subdomains are discovered passively by querying publicly audited TLS certificate logs.
              <strong className="text-[#f5f7fa]"> Important limitation:</strong> Certificate
              Transparency logs record domains for which SSL/TLS certificates were issued, but do
              not guarantee discovery of unencrypted internal hostnames, recently deleted DNS records,
              or subdomains that have never requested a public certificate.
            </p>
          </div>

          {/* Cloudflare IP Classification */}
          <div className="p-3.5 rounded-xl bg-[#0f1117] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-[#f5f7fa]">
              <Shield className="w-4 h-4 text-[#35d07f]" />
              <span>Official Cloudflare CIDR Verification</span>
            </div>
            <p className="leading-relaxed">
              Every discovered hostname is resolved to IPv4 (A) and IPv6 (AAAA) records server-side.
              Each IP is mathematically checked against Cloudflare's published CIDR blocks
              (<span className="font-mono text-[#f5f7fa]">https://www.cloudflare.com/ips-v4</span> and{" "}
              <span className="font-mono text-[#f5f7fa]">ips-v6</span>). Only genuine matches are
              displayed with an orange circle indicator (<span className="text-sm">🟠</span>).
              Non-Cloudflare and unresolved entries are never displayed.
            </p>
          </div>

          {/* API Access */}
          <div className="p-3.5 rounded-xl bg-[#0f1117] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-[#f5f7fa]">
              <Code2 className="w-4 h-4 text-[#aab2c0]" />
              <span>REST API Usage</span>
            </div>
            <pre className="p-2.5 rounded-lg bg-[#141720] border border-white/5 font-mono text-[11px] text-[#ff8a00] overflow-x-auto">
              {`curl -X POST http://localhost:3000/api/scan \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"speedtest.net"}'`}
            </pre>
            <p className="text-[11px] text-[#6c7484]">
              Rate-limited by default to 1 request per client IP per 60 seconds.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-white/5">
          <a
            href="/orange-test.zip"
            download="orange-test.zip"
            className="pill-gradient inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-[#0f1117] hover:opacity-90 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Project ZIP</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-[#f5f7fa] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
