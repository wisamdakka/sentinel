"use client";

import { useState, useEffect } from "react";
import { Fighter, fighters } from "@/lib/fighters";
import FighterAvatar from "@/components/FighterAvatar";

const tabs = [
  { key: "story", label: "lore" },
  { key: "abilities", label: "abilities" },
  { key: "stats", label: "stats" },
  { key: "specs", label: "scenario" },
];

interface FighterModalProps {
  fighter: Fighter;
  onClose: () => void;
  onNavigate?: (fighter: Fighter) => void;
}

export default function FighterModal({ fighter, onClose, onNavigate }: FighterModalProps) {
  const [activeTab, setActiveTab] = useState("story");
  const [customRules, setCustomRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState("");
  const [targetType, setTargetType] = useState<"api" | "chat" | "mcp">("api");
  const [targetUrl, setTargetUrl] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const currentIndex = fighters.findIndex((f) => f.id === fighter.id);

  const goPrev = () => {
    const prevIndex = (currentIndex - 1 + fighters.length) % fighters.length;
    onNavigate?.(fighters[prevIndex]);
  };

  const goNext = () => {
    const nextIndex = (currentIndex + 1) % fighters.length;
    onNavigate?.(fighters[nextIndex]);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const addRule = () => {
    if (newRule.trim()) {
      setCustomRules([...customRules, newRule.trim()]);
      setNewRule("");
    }
  };

  const removeRule = (index: number) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
  };

  const avgStat = Math.round(
    Object.values(fighter.stats).reduce((a, b) => a + b, 0) / 5
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Nav arrows */}
      {onNavigate && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-sm rough-border bg-[#3d2e1f] hover:bg-[#4d3a2a] transition-colors"
            style={{ borderRadius: "4px" }}
          >
            <span className="text-[#ede4d3] text-xl font-bold">&larr;</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-sm rough-border bg-[#3d2e1f] hover:bg-[#4d3a2a] transition-colors"
            style={{ borderRadius: "4px" }}
          >
            <span className="text-[#ede4d3] text-xl font-bold">&rarr;</span>
          </button>
        </>
      )}

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto parchment rough-border transition-all duration-300"
        style={{
          borderRadius: "4px",
          transform: visible ? "translateY(0)" : "translateY(100px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 sm:p-10">
          <div className="grid md:grid-cols-[300px_1fr] gap-10 items-start">
            {/* Left — portrait */}
            <div className="flex flex-col items-center">
              <div className="rough-border-light rounded-sm p-4 bg-white/20">
                <FighterAvatar
                  fighterId={fighter.id}
                  color={fighter.color}
                  size={240}
                />
              </div>

              <h1 className="ink-heading text-3xl mt-5 text-center">
                {fighter.name}
              </h1>
              <span className="ink-faded text-sm mt-1 lowercase">
                class: {fighter.domain}
              </span>

              <div className="flex items-center gap-2 mt-3">
                <span className="ink-faded text-sm">PWR</span>
                <span className="ink-heading text-xl">
                  {(avgStat / 20).toFixed(1)}
                </span>
              </div>

              {/* Launch raid */}
              <a
                href={`/raid?fighter=${fighter.id}`}
                className="flex items-center justify-center gap-3 w-full mt-8 py-4 rough-border bg-[#3d2e1f] hover:bg-[#4d3a2a] transition-colors group"
                style={{ borderRadius: "4px" }}
              >
                <span className="text-[#ede4d3] font-bold text-lg lowercase"
                  style={{ fontFamily: "var(--font-display), system-ui" }}>
                  launch raid
                </span>
              </a>
            </div>

            {/* Right — tabbed bestiary */}
            <div>
              {/* Tabs */}
              <div className="flex items-end gap-0.5 pl-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="bestiary-tab"
                    data-active={activeTab === tab.key}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content panel */}
              <div className="bestiary-panel p-6 sm:p-8 min-h-[350px]">
                {/* Lore */}
                {activeTab === "story" && (
                  <div>
                    <h2 className="ink-heading text-xl mb-4">field notes</h2>
                    <hr className="ink-rule mt-0 mb-5" />

                    <p className="ink-body text-sm mb-6 lowercase">
                      {fighter.lore}
                    </p>

                    <div className="field-note mb-5">
                      <h3 className="ink-heading text-sm mb-2">behavior</h3>
                      <p className="ink-faded text-sm leading-relaxed lowercase">
                        specializes in {fighter.domain.toLowerCase()}. opens with
                        friendly recon, then escalates — probing guardrails with
                        social engineering, edge cases, and multi-turn pressure.
                        adapts in real time based on agent responses.
                      </p>
                    </div>

                    <div className="field-note">
                      <h3 className="ink-heading text-sm mb-2">raid sequence</h3>
                      <ol className="space-y-2 list-none">
                        {[
                          "connect via api endpoint, chat url, or mcp",
                          "recon phase — map the agent's boundaries",
                          "attack phase — domain-specific exploits, trick prompts",
                          "escalation — multi-turn adaptive pressure",
                          "debrief — full transcript, severity ratings, breach log",
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="ink-heading text-xs mt-0.5 shrink-0">{i + 1}.</span>
                            <span className="ink-faded text-sm lowercase">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}

                {/* Abilities */}
                {activeTab === "abilities" && (
                  <div>
                    <h2 className="ink-heading text-xl mb-4">abilities</h2>
                    <hr className="ink-rule mt-0 mb-5" />

                    <div className="space-y-4">
                      {fighter.abilities.map((ability) => {
                        const typeLabel = ability.type === "ultimate" ? "ultimate" : ability.type === "active" ? "active" : "passive";
                        return (
                          <div
                            key={ability.name}
                            className="field-note"
                            style={ability.type === "ultimate" ? { borderLeftColor: "#3d2e1f", borderLeftWidth: 4 } : {}}
                          >
                            <div className="flex items-baseline gap-3 mb-1">
                              <h3 className="ink-heading text-sm">{ability.name}</h3>
                              <span className="ink-faded text-[10px] uppercase tracking-wider">[{typeLabel}]</span>
                            </div>
                            <p className="ink-faded text-sm lowercase leading-relaxed">
                              {ability.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stats */}
                {activeTab === "stats" && (
                  <div>
                    <h2 className="ink-heading text-xl mb-4">combat stats</h2>
                    <hr className="ink-rule mt-0 mb-5" />

                    <div className="field-note mb-6 flex items-baseline gap-3">
                      <span className="ink-faded text-sm uppercase tracking-wider">power rating</span>
                      <span className="ink-heading text-3xl">{avgStat}</span>
                    </div>

                    <div className="space-y-4">
                      {Object.entries(fighter.stats).map(([stat, value]) => (
                        <div key={stat} className="flex items-center gap-4">
                          <span className="ink-faded text-sm lowercase w-24">{stat}</span>
                          <div className="flex-1 stat-bar-track rounded-sm overflow-hidden">
                            <div
                              className="stat-bar-fill"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                          <span className="ink-heading text-sm w-8 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scenario */}
                {activeTab === "specs" && (
                  <div>
                    <h2 className="ink-heading text-xl mb-4">scenario</h2>
                    <hr className="ink-rule mt-0 mb-5" />

                    {/* Target agent connection */}
                    <h3 className="ink-heading text-sm mb-3">target agent</h3>
                    <div className="flex gap-1 mb-4">
                      {(["api", "chat", "mcp"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setTargetType(type)}
                          className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase transition-all ${
                            targetType === type
                              ? "bg-[#3d2e1f] text-[#ede4d3] rough-border"
                              : "ink-faded hover:bg-white/10 rough-border-light"
                          }`}
                          style={{ borderRadius: "4px", fontFamily: "var(--font-display), system-ui" }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <div className="mb-4">
                      <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                        {targetType === "api" ? "api endpoint" : targetType === "chat" ? "chat url" : "mcp server url"}
                      </label>
                      <input
                        type="text"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder={
                          targetType === "api"
                            ? "https://api.example.com/v1/chat"
                            : targetType === "chat"
                              ? "https://chat.example.com"
                              : "mcp://server.example.com"
                        }
                        className="w-full px-4 py-3 bg-white/40 rough-border-light text-sm font-mono placeholder:text-[#b0a08e] focus:outline-none transition-all lowercase"
                        style={{ borderRadius: "4px", color: "#3d2e1f" }}
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                        system prompt (optional)
                      </label>
                      <textarea
                        rows={3}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="paste the agent's system prompt for deeper analysis..."
                        className="w-full px-4 py-3 bg-white/40 rough-border-light text-sm placeholder:text-[#b0a08e] focus:outline-none transition-all resize-none lowercase"
                        style={{ borderRadius: "4px", color: "#3d2e1f" }}
                      />
                    </div>

                    <hr className="ink-rule" />

                    {/* Custom rules */}
                    <h3 className="ink-heading text-sm mb-3">custom rules</h3>
                    <p className="ink-faded text-sm lowercase mb-4">
                      rules your agent must follow. {fighter.name.toLowerCase()} will
                      try to break every one.
                    </p>

                    <div className="flex gap-3 mb-4">
                      <input
                        type="text"
                        value={newRule}
                        onChange={(e) => setNewRule(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addRule()}
                        placeholder="never approve a prescription change without a doctor"
                        className="flex-1 px-4 py-3 bg-white/40 rough-border-light text-sm placeholder:text-[#b0a08e] focus:outline-none transition-all lowercase"
                        style={{ borderRadius: "4px", color: "#3d2e1f" }}
                      />
                      <button
                        onClick={addRule}
                        className="px-5 py-3 rough-border-light bg-[#d4c9b5] hover:bg-[#c8b99a] text-sm font-bold transition-all lowercase ink-heading"
                        style={{ borderRadius: "4px" }}
                      >
                        add
                      </button>
                    </div>

                    {customRules.length > 0 && (
                      <div className="space-y-2">
                        {customRules.map((rule, index) => (
                          <div key={index} className="flex items-center gap-3 px-4 py-3 field-note group">
                            <span className="ink-faded text-sm flex-1 lowercase">{rule}</span>
                            <button
                              onClick={() => removeRule(index)}
                              className="opacity-0 group-hover:opacity-100 ink-faded hover:text-[#3d2e1f] text-sm transition-all"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
