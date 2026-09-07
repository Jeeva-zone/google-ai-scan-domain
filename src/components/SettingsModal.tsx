import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  RotateCcw,
  Check,
  Save,
  Zap,
  Layers,
  Clock,
  Shield,
  Server,
  Sparkles,
  Info,
} from "lucide-react";

export interface ScanConfig {
  MAX_CANDIDATES: number;
  DNS_CONCURRENCY: number;
  REQUEST_TIMEOUT: number;
  MAX_RESULTS: number;
  RATE_LIMIT_SECONDS: number;
  CF_CACHE_TTL_SECONDS: number;
}

export const DEFAULT_CONFIG: ScanConfig = {
  MAX_CANDIDATES: 1000,
  DNS_CONCURRENCY: 25,
  REQUEST_TIMEOUT: 30,
  MAX_RESULTS: 500,
  RATE_LIMIT_SECONDS: 0,
  CF_CACHE_TTL_SECONDS: 3600,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: ScanConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load current configuration from server on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    fetch("/api/config")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load configuration");
        return res.json();
      })
      .then((data) => {
        if (isMounted && data) {
          setConfig({
            MAX_CANDIDATES: data.MAX_CANDIDATES ?? DEFAULT_CONFIG.MAX_CANDIDATES,
            DNS_CONCURRENCY: data.DNS_CONCURRENCY ?? DEFAULT_CONFIG.DNS_CONCURRENCY,
            REQUEST_TIMEOUT: data.REQUEST_TIMEOUT ?? DEFAULT_CONFIG.REQUEST_TIMEOUT,
            MAX_RESULTS: data.MAX_RESULTS ?? DEFAULT_CONFIG.MAX_RESULTS,
            RATE_LIMIT_SECONDS: data.RATE_LIMIT_SECONDS ?? DEFAULT_CONFIG.RATE_LIMIT_SECONDS,
            CF_CACHE_TTL_SECONDS: data.CF_CACHE_TTL_SECONDS ?? DEFAULT_CONFIG.CF_CACHE_TTL_SECONDS,
          });
        }
      })
      .catch(() => {
        // Use defaults if fetch fails
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof ScanConfig, value: number) => {
    setConfig((prev) => ({
      ...prev,
      [key]: isNaN(value) ? 0 : Math.max(0, value),
    }));
    setSaveSuccess(false);
  };

  const handleApplyPreset = (preset: Partial<ScanConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...preset,
    }));
    setSaveSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || "Failed to save settings");
      }

      setSaveSuccess(true);
      if (onConfigSaved) {
        onConfigSaved(config);
      }

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to save configuration variables.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="settings-modal-card"
        className="bg-[#12151e] border border-[#262a36] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262a36] bg-[#181b24]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff8a00]/15 border border-[#ff8a00]/30 text-[#ff8a00] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f5f7fa] tracking-tight">
                Variable Settings & Tuning
              </h2>
              <p className="text-xs text-[#aab2c0]">
                Configure scanning limits, DNS concurrency, and timeouts
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-settings-button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#aab2c0] hover:text-[#f5f7fa] hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#aab2c0] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#ff8a00]" />
              <span>Quick Presets</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset(DEFAULT_CONFIG)}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#181b24] hover:bg-[#202430] border border-[#262a36] hover:border-[#ff8a00]/40 text-[#f5f7fa] transition-colors flex flex-col items-start gap-0.5 cursor-pointer text-left"
              >
                <span className="text-[#ff8a00] font-bold">Standard</span>
                <span className="text-[10px] text-[#aab2c0]">1000 cands / 25 threads</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApplyPreset({
                    MAX_CANDIDATES: 250,
                    DNS_CONCURRENCY: 40,
                    REQUEST_TIMEOUT: 15,
                    MAX_RESULTS: 200,
                    RATE_LIMIT_SECONDS: 0,
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#181b24] hover:bg-[#202430] border border-[#262a36] hover:border-[#ff8a00]/40 text-[#f5f7fa] transition-colors flex flex-col items-start gap-0.5 cursor-pointer text-left"
              >
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Fast Scan
                </span>
                <span className="text-[10px] text-[#aab2c0]">250 cands / 40 threads</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApplyPreset({
                    MAX_CANDIDATES: 3000,
                    DNS_CONCURRENCY: 35,
                    REQUEST_TIMEOUT: 60,
                    MAX_RESULTS: 1000,
                    RATE_LIMIT_SECONDS: 0,
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#181b24] hover:bg-[#202430] border border-[#262a36] hover:border-[#ff8a00]/40 text-[#f5f7fa] transition-colors flex flex-col items-start gap-0.5 cursor-pointer text-left"
              >
                <span className="text-cyan-400 font-bold flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Deep Scan
                </span>
                <span className="text-[10px] text-[#aab2c0]">3000 cands / 60s timeout</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApplyPreset({
                    RATE_LIMIT_SECONDS: 60,
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#181b24] hover:bg-[#202430] border border-[#262a36] hover:border-[#ff8a00]/40 text-[#f5f7fa] transition-colors flex flex-col items-start gap-0.5 cursor-pointer text-left"
              >
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Strict 60s
                </span>
                <span className="text-[10px] text-[#aab2c0]">Rate limit active</span>
              </button>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* MAX_CANDIDATES */}
            <div className="bg-[#181b24] p-4 rounded-xl border border-[#262a36] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-max-candidates"
                  className="text-xs font-bold text-[#f5f7fa] flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-[#ff8a00]" />
                  <span>MAX_CANDIDATES</span>
                </label>
                <span className="text-[11px] font-mono text-[#ff8a00]">
                  {config.MAX_CANDIDATES}
                </span>
              </div>
              <input
                type="number"
                id="input-max-candidates"
                min={10}
                max={10000}
                step={50}
                value={config.MAX_CANDIDATES}
                onChange={(e) => handleChange("MAX_CANDIDATES", parseInt(e.target.value, 10))}
                className="w-full bg-[#12151e] border border-[#262a36] focus:border-[#ff8a00] rounded-lg px-3 py-2 text-sm font-mono text-[#f5f7fa] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#aab2c0] leading-normal">
                Maximum candidate subdomains parsed from crt.sh Certificate Transparency logs.
              </p>
            </div>

            {/* DNS_CONCURRENCY */}
            <div className="bg-[#181b24] p-4 rounded-xl border border-[#262a36] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-dns-concurrency"
                  className="text-xs font-bold text-[#f5f7fa] flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-[#ff8a00]" />
                  <span>DNS_CONCURRENCY</span>
                </label>
                <span className="text-[11px] font-mono text-[#ff8a00]">
                  {config.DNS_CONCURRENCY}
                </span>
              </div>
              <input
                type="number"
                id="input-dns-concurrency"
                min={1}
                max={100}
                step={5}
                value={config.DNS_CONCURRENCY}
                onChange={(e) => handleChange("DNS_CONCURRENCY", parseInt(e.target.value, 10))}
                className="w-full bg-[#12151e] border border-[#262a36] focus:border-[#ff8a00] rounded-lg px-3 py-2 text-sm font-mono text-[#f5f7fa] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#aab2c0] leading-normal">
                Parallel thread pool worker count for simultaneous IPv4 &amp; IPv6 lookups.
              </p>
            </div>

            {/* REQUEST_TIMEOUT */}
            <div className="bg-[#181b24] p-4 rounded-xl border border-[#262a36] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-request-timeout"
                  className="text-xs font-bold text-[#f5f7fa] flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-[#ff8a00]" />
                  <span>REQUEST_TIMEOUT (sec)</span>
                </label>
                <span className="text-[11px] font-mono text-[#ff8a00]">
                  {config.REQUEST_TIMEOUT}s
                </span>
              </div>
              <input
                type="number"
                id="input-request-timeout"
                min={5}
                max={180}
                step={5}
                value={config.REQUEST_TIMEOUT}
                onChange={(e) => handleChange("REQUEST_TIMEOUT", parseInt(e.target.value, 10))}
                className="w-full bg-[#12151e] border border-[#262a36] focus:border-[#ff8a00] rounded-lg px-3 py-2 text-sm font-mono text-[#f5f7fa] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#aab2c0] leading-normal">
                Timeout limit for outbound HTTP calls to crt.sh and Cloudflare range endpoints.
              </p>
            </div>

            {/* MAX_RESULTS */}
            <div className="bg-[#181b24] p-4 rounded-xl border border-[#262a36] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-max-results"
                  className="text-xs font-bold text-[#f5f7fa] flex items-center gap-1.5"
                >
                  <Server className="w-3.5 h-3.5 text-[#ff8a00]" />
                  <span>MAX_RESULTS</span>
                </label>
                <span className="text-[11px] font-mono text-[#ff8a00]">
                  {config.MAX_RESULTS}
                </span>
              </div>
              <input
                type="number"
                id="input-max-results"
                min={10}
                max={5000}
                step={50}
                value={config.MAX_RESULTS}
                onChange={(e) => handleChange("MAX_RESULTS", parseInt(e.target.value, 10))}
                className="w-full bg-[#12151e] border border-[#262a36] focus:border-[#ff8a00] rounded-lg px-3 py-2 text-sm font-mono text-[#f5f7fa] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#aab2c0] leading-normal">
                Maximum number of verified Cloudflare host-IP entries returned in results.
              </p>
            </div>

            {/* RATE_LIMIT_SECONDS */}
            <div className="bg-[#181b24] p-4 rounded-xl border border-[#262a36] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-rate-limit-seconds"
                  className="text-xs font-bold text-[#f5f7fa] flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-[#ff8a00]" />
                  <span>RATE_LIMIT_SECONDS</span>
                </label>
                <span className="text-[11px] font-mono text-[#ff8a00]">
                  {config.RATE_LIMIT_SECONDS === 0 ? "0 (Disabled)" : `${config.RATE_LIMIT_SECONDS}s`}
                </span>
              </div>
              <input
                type="number"
                id="input-rate-limit-seconds"
                min={0}
                max={300}
                step={5}
                value={config.RATE_LIMIT_SECONDS}
                onChange={(e) => handleChange("RATE_LIMIT_SECONDS", parseInt(e.target.value, 10))}
                className="w-full bg-[#12151e] border border-[#262a36] focus:border-[#ff8a00] rounded-lg px-3 py-2 text-sm font-mono text-[#f5f7fa] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#aab2c0] leading-normal">
                Scan cooldown between requests per client IP. Set to <strong>0</strong> to disable.
              </p>
            </div>

            {/* CF_CACHE_TTL_SECONDS */}
            <div className="bg-[#181b24] p-4 rounded-xl border border-[#262a36] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-cf-cache-ttl"
                  className="text-xs font-bold text-[#f5f7fa] flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-[#ff8a00]" />
                  <span>CF_CACHE_TTL_SECONDS</span>
                </label>
                <span className="text-[11px] font-mono text-[#ff8a00]">
                  {config.CF_CACHE_TTL_SECONDS}s
                </span>
              </div>
              <input
                type="number"
                id="input-cf-cache-ttl"
                min={60}
                max={86400}
                step={300}
                value={config.CF_CACHE_TTL_SECONDS}
                onChange={(e) => handleChange("CF_CACHE_TTL_SECONDS", parseInt(e.target.value, 10))}
                className="w-full bg-[#12151e] border border-[#262a36] focus:border-[#ff8a00] rounded-lg px-3 py-2 text-sm font-mono text-[#f5f7fa] outline-none transition-colors"
              />
              <p className="text-[11px] text-[#aab2c0] leading-normal">
                Duration to cache Cloudflare&apos;s published IPv4/IPv6 CIDR ranges in memory.
              </p>
            </div>
          </div>

          {/* Feedback messages */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Variables successfully saved and applied to active server &amp; .env!</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#262a36]">
            <button
              type="button"
              onClick={() => handleApplyPreset(DEFAULT_CONFIG)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-[#aab2c0] hover:text-[#f5f7fa] bg-[#181b24] hover:bg-[#202430] border border-[#262a36] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-medium text-[#aab2c0] hover:text-[#f5f7fa] hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-initial pill-gradient px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-[#0f1117] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-[#ff8a00]/20 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#0f1117] border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Variables</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
