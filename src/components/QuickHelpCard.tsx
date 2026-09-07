import React from "react";
import { HelpCircle, RefreshCw, BookOpen } from "lucide-react";

interface QuickHelpCardProps {
  onOpenHelp: () => void;
  onClearSession: () => void;
  hasActiveData: boolean;
}

export const QuickHelpCard: React.FC<QuickHelpCardProps> = ({
  onOpenHelp,
  onClearSession,
  hasActiveData,
}) => {
  return (
    <div className="bg-[#181b24] p-5 sm:p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col flex-1">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#aab2c0] mb-3">
        Quick Help
      </h3>

      <div className="text-[11px] text-[#aab2c0] space-y-3 leading-relaxed">
        <p>
          <span className="text-[#ff8a00] font-bold uppercase tracking-wider">
            Passive Only:
          </span>{" "}
          This scan uses Certificate Transparency logs. It does not perform active
          probing or stealth activity.
        </p>
        <p>
          <span className="text-[#ff8a00] font-bold uppercase tracking-wider">
            Accuracy:
          </span>{" "}
          CT records don't guarantee current DNS state. Some subdomains may exist
          without active certificates.
        </p>
        <p>
          <span className="text-[#35d07f] font-bold uppercase tracking-wider">
            Pure Orange:
          </span>{" "}
          Results strictly contain verified Cloudflare network IPs (<span>🟠</span>). Non-Cloudflare hosts are omitted.
        </p>
      </div>

      <div className="mt-auto pt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onOpenHelp}
          className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-[#f5f7fa] hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#ff8a00]" />
          <span>Ethics & Docs</span>
        </button>

        {hasActiveData && (
          <button
            type="button"
            onClick={onClearSession}
            className="w-full py-2 px-3 bg-transparent hover:bg-white/5 border border-white/5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-[#aab2c0] hover:text-[#ff5f56] transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Clear Session</span>
          </button>
        )}
      </div>
    </div>
  );
};
