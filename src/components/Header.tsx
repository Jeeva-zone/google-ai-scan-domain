import React from "react";
import { Shield, Sparkles, Download, Terminal, ExternalLink, Sliders } from "lucide-react";

interface HeaderProps {
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenHelp, onOpenSettings }) => {
  return (
    <header className="border-b border-[#262a36] bg-[#12151e]/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#d46500] flex items-center justify-center shadow-lg shadow-[#ff8a00]/20 ring-1 ring-[#ff8a00]/30">
              <span className="text-xl select-none" aria-hidden="true">🟠</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-[#f5f7fa]">
                  Orange Test
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase bg-[#ff8a00]/15 text-[#ff8a00] border border-[#ff8a00]/30 rounded-full">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-[#aab2c0]">
                Find Cloudflare-hosted subdomains
              </p>
            </div>
          </div>

          {/* Mobile action buttons */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              type="button"
              id="mobile-settings-button"
              onClick={onOpenSettings}
              className="text-xs text-[#aab2c0] hover:text-[#f5f7fa] px-2.5 py-1.5 rounded-lg border border-[#262a36] bg-[#181b24] flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#ff8a00]" />
              <span>Vars</span>
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              className="text-xs text-[#aab2c0] hover:text-[#f5f7fa] px-2.5 py-1.5 rounded-lg border border-[#262a36] bg-[#181b24]"
            >
              Docs
            </button>
          </div>
        </div>

        {/* Feature Registry & Future Tools */}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#181b24] border border-[#262a36] text-xs">
            <span
              id="feature-active-pill"
              className="px-2.5 py-1 rounded-lg bg-[#ff8a00]/20 text-[#ff8a00] font-medium flex items-center gap-1.5 border border-[#ff8a00]/40"
            >
              <span>🟠</span> Orange Test
            </span>
            <span
              id="feature-future-pill"
              className="px-2.5 py-1 rounded-lg text-[#6c7484] font-normal flex items-center gap-1.5 cursor-not-allowed select-none"
              title="DNS, HTTP status, SSL certs & WHOIS lookups coming soon"
            >
              <Sparkles className="w-3 h-3 text-[#ff8a00]/50" />
              More tools coming soon
            </span>
          </div>

          {/* Variable Settings Button */}
          <button
            type="button"
            id="open-settings-button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#f5f7fa] bg-[#181b24] hover:bg-[#202430] border border-[#262a36] hover:border-[#ff8a00]/40 rounded-xl transition-colors cursor-pointer"
            title="Configure variables & scan limits"
          >
            <Sliders className="w-3.5 h-3.5 text-[#ff8a00]" />
            <span>Variables</span>
          </button>

          <a
            id="download-project-zip"
            href="/orange-test.zip"
            download="orange-test.zip"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#f5f7fa] bg-[#181b24] hover:bg-[#202430] border border-[#262a36] hover:border-[#3b4152] rounded-xl transition-colors"
            title="Download full project ZIP archive for GitHub / Vercel deployment"
          >
            <Download className="w-3.5 h-3.5 text-[#ff8a00]" />
            <span>Download ZIP</span>
          </a>
        </div>
      </div>
    </header>
  );
};
