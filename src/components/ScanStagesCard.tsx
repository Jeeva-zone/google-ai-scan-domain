import React from "react";
import { ScanStage } from "../types";
import { Check, Loader2 } from "lucide-react";

interface ScanStagesCardProps {
  stage: ScanStage;
  errorMessage?: string | null;
}

interface StageStep {
  id: ScanStage;
  label: string;
}

const STAGES: StageStep[] = [
  { id: "validating", label: "Validating domain" },
  { id: "discovering", label: "Discovering subdomains" },
  { id: "resolving", label: "Resolving DNS" },
  { id: "filtering", label: "Filtering Cloudflare IPs" },
  { id: "formatting", label: "Formatting results" },
];

const STAGE_ORDER: Record<ScanStage, number> = {
  ready: 0,
  validating: 1,
  discovering: 2,
  resolving: 3,
  filtering: 4,
  formatting: 5,
  complete: 6,
  error: -1,
  canceled: -1,
};

export const ScanStagesCard: React.FC<ScanStagesCardProps> = ({
  stage,
  errorMessage,
}) => {
  const currentStepNum = STAGE_ORDER[stage] ?? 0;

  return (
    <div className="bg-[#181b24] p-5 sm:p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden">
      {/* Decorative scanner line accent */}
      {stage !== "ready" && stage !== "complete" && stage !== "error" && stage !== "canceled" && (
        <div className="scanner-line animate-pulse" />
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#aab2c0]">
          Scan Stages
        </h3>
        {stage !== "ready" && (
          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
              stage === "complete"
                ? "bg-[#35d07f]/20 text-[#35d07f]"
                : stage === "error"
                ? "bg-[#ff5f56]/20 text-[#ff5f56]"
                : stage === "canceled"
                ? "bg-[#aab2c0]/20 text-[#aab2c0]"
                : "bg-[#ff8a00]/20 text-[#ff8a00]"
            }`}
          >
            {stage}
          </span>
        )}
      </div>

      <div className="space-y-3.5">
        {STAGES.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = currentStepNum > stepNum || stage === "complete";
          const isActive = currentStepNum === stepNum;
          const isFailed = stage === "error" && currentStepNum === stepNum;
          const isPending = !isDone && !isActive;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 transition-opacity ${
                isPending ? "opacity-30" : "opacity-100"
              }`}
            >
              {isDone ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#35d07f] flex items-center justify-center p-0.5 shrink-0">
                  <div className="w-full h-full bg-[#35d07f] rounded-full" />
                </div>
              ) : isActive ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#ff8a00] flex items-center justify-center p-0.5 shrink-0 animate-pulse">
                  <div className="w-full h-full bg-[#ff8a00] rounded-full" />
                </div>
              ) : isFailed ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#ff5f56] flex items-center justify-center p-0.5 shrink-0">
                  <div className="w-full h-full bg-[#ff5f56] rounded-full" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-white/20 shrink-0" />
              )}

              <span
                className={`text-xs ${
                  isActive
                    ? "font-bold text-[#f5f7fa]"
                    : isDone
                    ? "text-[#f5f7fa]"
                    : "text-[#aab2c0]"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {errorMessage && stage === "error" && (
        <div className="mt-4 p-2.5 rounded-xl bg-[#ff5f56]/10 border border-[#ff5f56]/20 text-[11px] text-[#ff5f56]">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
