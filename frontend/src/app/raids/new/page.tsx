"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { BUSINESS_TYPES, fighterForBusiness } from "@/lib/fighterMap";
import FighterAvatar from "@/components/FighterAvatar";

type Mode = "demo" | "real";

export default function NewRaidPage() {
  const router = useRouter();
  const [businessType, setBusinessType] = useState("fintech");
  const [probeCount, setProbeCount] = useState(6);
  const [mode, setMode] = useState<Mode>("demo");
  const [endpoint, setEndpoint] = useState(
    "https://api.openai.com/v1/chat/completions"
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, [router]);

  const fighter = fighterForBusiness(businessType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const target =
        mode === "real"
          ? {
              type: "openai_compatible" as const,
              endpoint,
              api_key: apiKey,
              model,
              system_prompt: systemPrompt.trim() || null,
            }
          : null;
      const res = await api.launchRaid({
        business_type: businessType,
        probe_count: probeCount,
        target,
      });
      // Stash the scripted probes so the detail page can render them
      // before any findings are written.
      window.sessionStorage.setItem(
        `raid:${res.session_id}:probes`,
        JSON.stringify(res.probes)
      );
      // Marker: in real mode the backend writes findings, so the
      // client-side demo executor must stand down.
      window.sessionStorage.setItem(
        `raid:${res.session_id}:mode`,
        mode
      );
      router.push(`/raids/${encodeURIComponent(res.session_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to launch raid");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#1a1810]">
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-20">
        <div className="mb-10">
          <h1
            className="text-4xl sm:text-5xl text-[#ede4d3] lowercase tracking-wide"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            raid
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="parchment rough-border p-8"
          style={{ borderRadius: "4px" }}
        >
          {/* Fighter preview */}
          <div className="flex items-center gap-5 mb-8 pb-6" style={{ borderBottom: "1px solid rgba(139,115,85,0.25)" }}>
            <FighterAvatar
              fighterId={fighter.id}
              color={fighter.color}
              size={72}
            />
            <div>
              <div className="ink-faded text-[10px] uppercase tracking-wider">
                summoned fighter
              </div>
              <h2 className="ink-heading text-2xl">{fighter.name}</h2>
              <p className="ink-faded text-xs lowercase mt-0.5">
                {fighter.class} / {fighter.domain}
              </p>
            </div>
          </div>

          {/* Business type */}
          <label className="block ink-faded text-[10px] uppercase tracking-wider mb-3">
            domain
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
            {BUSINESS_TYPES.map((bt) => {
              const active = bt.id === businessType;
              return (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() => setBusinessType(bt.id)}
                  className={`text-left px-3 py-2.5 rough-border-light transition-colors ${
                    active
                      ? "bg-[#3d2e1f] text-[#ede4d3]"
                      : "bg-white/20 hover:bg-white/40 text-[#3d2e1f]"
                  }`}
                  style={{ borderRadius: "3px" }}
                >
                  <div className="text-sm lowercase font-bold">{bt.label}</div>
                  <div
                    className={`text-[10px] lowercase mt-0.5 ${
                      active ? "text-[#c8b99a]" : "ink-faded"
                    }`}
                  >
                    {bt.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Probe count */}
          <label className="block ink-faded text-[10px] uppercase tracking-wider mb-3">
            probe count · {probeCount}
          </label>
          <input
            type="range"
            min={1}
            max={12}
            value={probeCount}
            onChange={(e) => setProbeCount(Number(e.target.value))}
            className="parchment-range mb-8"
          />

          {/* Mode toggle */}
          <label className="block ink-faded text-[10px] uppercase tracking-wider mb-3">
            target
          </label>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {(
              [
                { id: "demo", label: "demo", desc: "rolled scores" },
                { id: "real", label: "real agent", desc: "openai-compatible" },
              ] as { id: Mode; label: string; desc: string }[]
            ).map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`text-left px-3 py-2.5 rough-border-light transition-colors ${
                    active
                      ? "bg-[#3d2e1f] text-[#ede4d3]"
                      : "bg-white/20 hover:bg-white/40 text-[#3d2e1f]"
                  }`}
                  style={{ borderRadius: "3px" }}
                >
                  <div className="text-sm lowercase font-bold">{m.label}</div>
                  <div
                    className={`text-[10px] lowercase mt-0.5 ${
                      active ? "text-[#c8b99a]" : "ink-faded"
                    }`}
                  >
                    {m.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {mode === "real" && (
            <div className="space-y-4 mb-8">
              <div>
                <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                  endpoint
                </label>
                <input
                  type="url"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  required
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className="w-full px-3 py-2 bg-white/40 rough-border-light text-sm focus:outline-none"
                  style={{ borderRadius: "3px", color: "#3d2e1f" }}
                />
              </div>
              <div>
                <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                  api key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-white/40 rough-border-light text-sm focus:outline-none font-mono"
                  style={{ borderRadius: "3px", color: "#3d2e1f" }}
                />
                <p className="ink-faded text-[10px] mt-1 lowercase">
                  sent once to your sentinel server. never stored.
                </p>
              </div>
              <div>
                <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                  model
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 bg-white/40 rough-border-light text-sm focus:outline-none font-mono"
                  style={{ borderRadius: "3px", color: "#3d2e1f" }}
                />
              </div>
              <div>
                <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                  system prompt (optional)
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  placeholder="you are a fintech support agent..."
                  className="w-full px-3 py-2 bg-white/40 rough-border-light text-sm focus:outline-none resize-none"
                  style={{ borderRadius: "3px", color: "#3d2e1f" }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-800 lowercase mb-4">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rough-border bg-[#3d2e1f] hover:bg-[#4d3a2a] transition-colors text-[#ede4d3] font-bold text-lg lowercase tracking-wide disabled:opacity-60"
            style={{
              borderRadius: "4px",
              fontFamily: "var(--font-display), system-ui",
            }}
          >
            {submitting ? "summoning…" : "launch the raid"}
          </button>
        </form>
      </div>
    </div>
  );
}
