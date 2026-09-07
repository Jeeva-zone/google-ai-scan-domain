import React, { useState } from "react";
import { XCircle, AlertCircle, ShieldCheck, Sliders } from "lucide-react";

interface DomainFormProps {
  onScan: (domain: string) => void;
  onCancel: () => void;
  onOpenSettings?: () => void;
  isScanning: boolean;
  disabled?: boolean;
}

export const DomainForm: React.FC<DomainFormProps> = ({
  onScan,
  onCancel,
  onOpenSettings,
  isScanning,
  disabled = false,
}) => {
  const [domainInput, setDomainInput] = useState<string>("speedtest.net");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Clean domain helper
  const cleanInput = (raw: string): string => {
    let clean = raw.trim().toLowerCase();
    if (clean.startsWith("http://")) clean = clean.slice(7);
    if (clean.startsWith("https://")) clean = clean.slice(8);
    if (clean.includes("/")) clean = clean.split("/")[0];
    if (clean.includes("?")) clean = clean.split("?")[0];
    if (clean.includes("#")) clean = clean.split("#")[0];
    if (clean.includes(":")) clean = clean.split(":")[0];
    if (clean.endsWith(".")) clean = clean.slice(0, -1);
    return clean;
  };

  const validateDomain = (domain: string): string | null => {
    if (!domain) {
      return "Please enter a valid domain, for example: speedtest.net";
    }

    // Reject IP addresses
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) || domain.includes(":");
    if (isIp) {
      return "Please enter a domain name, not an IP address (for example: speedtest.net)";
    }

    if (!domain.includes(".")) {
      return "Please enter a valid domain with an extension, for example: speedtest.net";
    }

    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(domain) || domain.length > 253) {
      return "Please enter a valid domain, for example: speedtest.net";
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanInput(domainInput);
    const error = validateDomain(cleaned);

    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    onScan(cleaned);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomainInput(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleExampleClick = (example: string) => {
    setDomainInput(example);
    setValidationError(null);
    if (!isScanning) {
      onScan(example);
    }
  };

  return (
    <div className="w-full">
      <form
        id="orange-test-form"
        onSubmit={handleSubmit}
        className="w-full"
      >
        <div className="bg-[#181b24] p-2 sm:p-2.5 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center shadow-2xl gap-2 transition-all focus-within:border-white/15">
          <div className="flex-1 flex items-center px-4 relative">
            <input
              id="domain-input"
              type="text"
              value={domainInput}
              onChange={handleInputChange}
              disabled={isScanning || disabled}
              placeholder="Enter a domain, for example speedtest.net"
              aria-describedby={validationError ? "domain-error-message" : undefined}
              aria-invalid={validationError ? "true" : "false"}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              className="bg-transparent flex-1 py-3 outline-none text-base sm:text-lg font-medium text-[#f5f7fa] placeholder-[#aab2c0]/30 font-mono"
            />

            {domainInput && !isScanning && (
              <button
                type="button"
                onClick={() => {
                  setDomainInput("");
                  setValidationError(null);
                }}
                className="text-[#aab2c0] hover:text-[#f5f7fa] p-1 transition-colors"
                aria-label="Clear input field"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {!isScanning ? (
            <button
              id="start-scan-button"
              type="submit"
              disabled={disabled || !domainInput.trim()}
              className="pill-gradient px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 text-[#0f1117] transition-all cursor-pointer shadow-lg shadow-[#ff8a00]/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <span className="text-lg leading-none" aria-hidden="true">🟠</span>
              <span>Start Orange Test</span>
            </button>
          ) : (
            <button
              id="cancel-scan-button"
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-[#ff5f56]/15 text-[#ff5f56] border border-[#ff5f56]/30 hover:bg-[#ff5f56]/25 transition-all cursor-pointer shrink-0"
            >
              <XCircle className="w-4 h-4 text-[#ff5f56]" />
              <span>Cancel Scan</span>
            </button>
          )}
        </div>

        {/* Validation error */}
        {validationError && (
          <div
            id="domain-error-message"
            role="alert"
            className="mt-3 flex items-center gap-2 text-xs text-[#ff5f56] bg-[#ff5f56]/10 border border-[#ff5f56]/20 px-4 py-2.5 rounded-xl"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Authorization Note + Quick test examples */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <p className="text-[11px] text-[#aab2c0]/60 flex items-center gap-2 italic">
            <ShieldCheck className="w-3.5 h-3.5 text-[#35d07f] shrink-0" />
            <span>Use this tool only on domains you own or are authorized to assess.</span>
          </p>

          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="text-[#aab2c0]/40 uppercase font-mono text-[10px]">Examples:</span>
            {["speedtest.net", "cloudflare.com", "opensignal.com", "useinsider.com", "codecademy.com"].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => handleExampleClick(ex)}
                disabled={isScanning}
                className="text-[11px] font-mono text-[#aab2c0] hover:text-[#ff8a00] bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/5 transition-all disabled:opacity-40 cursor-pointer"
              >
                {ex}
              </button>
            ))}

            {onOpenSettings && (
              <button
                type="button"
                id="form-variable-settings-button"
                onClick={onOpenSettings}
                className="text-[11px] font-medium text-[#ff8a00] hover:text-[#ff9f24] bg-[#ff8a00]/10 hover:bg-[#ff8a00]/15 px-2.5 py-1 rounded-lg border border-[#ff8a00]/25 transition-all flex items-center gap-1 cursor-pointer"
                title="Configure scan variables"
              >
                <Sliders className="w-3 h-3" />
                <span>Tune Variables</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
