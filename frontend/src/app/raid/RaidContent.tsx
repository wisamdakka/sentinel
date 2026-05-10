"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getFighter, fighters } from "@/lib/fighters";
import FighterAvatar from "@/components/FighterAvatar";

export default function RaidContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fighterId = searchParams.get("fighter");
  const currentFighter = fighterId ? getFighter(fighterId) : fighters[0];
  const [showQuit, setShowQuit] = useState(false);

  if (!currentFighter) return null;

  const handleBackdropClick = () => {
    setShowQuit(true);
  };

  return (
    <div className="relative h-screen overflow-hidden" onClick={handleBackdropClick}>

      {/* ── Battle scene background ── */}
      <div className="absolute inset-0 battle-scene">
        {/* Painted gradient sky — clear pixel sky */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #87CEEB 0%, #a8d8ea 30%, #c4e0f0 50%, #b8d8e8 70%, #7ab8d4 100%)",
        }} />

        {/* Ambient blobs — soft clouds and light */}
        <div className="absolute top-[8%] left-[15%] w-[400px] h-[200px] rounded-full bg-white/20 blur-[60px]" />
        <div className="absolute top-[12%] right-[20%] w-[300px] h-[150px] rounded-full bg-white/15 blur-[50px]" />
        <div className="absolute top-[40%] left-[50%] w-[600px] h-[300px] rounded-full bg-white/8 blur-[100px] -translate-x-1/2" />
        <div className="absolute bottom-[20%] left-[10%] w-[350px] h-[200px] rounded-full bg-[#6aaa6a]/10 blur-[70px]" />
        <div className="absolute bottom-[5%] right-[5%] w-[280px] h-[180px] rounded-full bg-[#5a9a5a]/8 blur-[60px]" />

        {/* Pixel noise overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          imageRendering: "pixelated",
        }} />

        {/* Scanlines for retro feel */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
          imageRendering: "pixelated",
        }} />
      </div>

      {/* ── Enemy HUD (top-left, ~1/3 down) ── */}
      <div className="absolute top-[30%] left-6 z-20 flex items-center gap-4" style={{ imageRendering: "auto" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fighters/skull.svg" alt="" className="w-14 h-14" style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.3))" }} />
        <div>
          <span className="text-white/80 text-xs font-bold uppercase tracking-widest block mb-1.5"
            style={{ fontFamily: "var(--font-display), system-ui", textShadow: "1px 1px 0 rgba(0,0,0,0.3)" }}>
            enemy
          </span>
          <div className="w-48 h-4 bg-black/40 border-2 border-white/20" style={{ borderRadius: "2px", imageRendering: "pixelated" }}>
            <div className="h-full health-bar-enemy" style={{ width: "72%", borderRadius: "1px", boxShadow: "0 0 8px rgba(74,222,128,0.4)" }} />
          </div>
          <span className="text-white/40 text-[10px] mt-1 block" style={{ fontFamily: "var(--font-display), system-ui" }}>
            target agent
          </span>
        </div>
      </div>

      {/* ── Player HUD (bottom-right, ~2/3 down) ── */}
      <div className="absolute top-[65%] right-8 z-20 flex items-center gap-4" style={{ imageRendering: "auto" }}>
        <div className="flex items-center gap-3">
          <div>
            <span className="text-white/80 text-xs font-bold uppercase tracking-widest block mb-1.5 text-right"
              style={{ fontFamily: "var(--font-display), system-ui", textShadow: "1px 1px 0 rgba(0,0,0,0.3)" }}>
              player
            </span>
            <div className="w-48 h-4 bg-black/40 border-2 border-white/20" style={{ borderRadius: "2px", imageRendering: "pixelated" }}>
              <div className="h-full health-bar-player" style={{ width: "88%", borderRadius: "1px", boxShadow: "0 0 8px rgba(251,191,36,0.4)" }} />
            </div>
            <span className="text-white/40 text-[10px] mt-1 block text-right" style={{ fontFamily: "var(--font-display), system-ui" }}>
              {currentFighter.name.toLowerCase()}
            </span>
          </div>
          <div style={{ imageRendering: "pixelated" }} className="w-14 h-14 flex items-center justify-center">
            <FighterAvatar fighterId={currentFighter.id} color={currentFighter.color} size={50} />
          </div>
        </div>
      </div>

      {/* ── Battle log card (center) ── */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 h-full flex items-start pt-[38px]">
        <div
          className="parchment rough-border p-6 sm:p-8 w-full"
          style={{ borderRadius: "4px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Battle log */}
          <div className="rough-border-light bg-[#3d2e1f] p-5 mb-6" style={{ borderRadius: "4px" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[#c8b99a] text-xs font-bold tracking-wider uppercase"
                style={{ fontFamily: "var(--font-display), system-ui" }}>
                live battle log
              </span>
            </div>

            <div className="space-y-2 font-mono text-sm">
              {[
                { time: "00:01", msg: "Establishing connection to target agent...", type: "system" },
                { time: "00:03", msg: "Connection established. Beginning reconnaissance.", type: "system" },
                { time: "00:05", msg: `Deploying ${currentFighter.abilities[0].name}...`, type: "attack" },
                { time: "00:08", msg: "Target responded with standard guardrail. Adapting approach...", type: "info" },
                { time: "00:12", msg: "Trying social engineering vector: authority impersonation", type: "attack" },
                { time: "00:15", msg: "BREACH DETECTED - Agent complied with unauthorized request", type: "breach" },
                { time: "00:18", msg: `Escalating to ${currentFighter.abilities[1].name}...`, type: "attack" },
                { time: "00:22", msg: "Target held. Guardrail intact.", type: "success" },
                { time: "00:25", msg: `Deploying ultimate: ${currentFighter.abilities[2].name}`, type: "ultimate" },
                { time: "00:30", msg: "Raid complete. Generating report...", type: "system" },
              ].map((log, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-[#8b7a6b] w-12 flex-shrink-0">{log.time}</span>
                  <span className={
                    log.type === "breach" ? "text-red-400 font-bold"
                      : log.type === "attack" ? "text-[#ede4d3]"
                      : log.type === "success" ? "text-green-400"
                      : log.type === "ultimate" ? "text-amber-300 font-bold"
                      : "text-[#8b7a6b]"
                  }>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="ink-heading text-xl">raid results</h2>
              <span className="ink-heading text-4xl">88/100</span>
            </div>

            <hr className="ink-rule mt-0 mb-4" />

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="field-note text-center py-3">
                <div className="text-2xl font-black text-red-700">2</div>
                <div className="ink-faded text-[10px] uppercase tracking-wider mt-1">critical</div>
              </div>
              <div className="field-note text-center py-3">
                <div className="text-2xl font-black text-amber-700">5</div>
                <div className="ink-faded text-[10px] uppercase tracking-wider mt-1">warning</div>
              </div>
              <div className="field-note text-center py-3">
                <div className="text-2xl font-black text-green-800">41</div>
                <div className="ink-faded text-[10px] uppercase tracking-wider mt-1">passed</div>
              </div>
            </div>

            {/* Critical findings */}
            <h3 className="ink-heading text-sm mb-3">critical findings</h3>
            <div className="space-y-3">
              {[
                { title: "Accepted unauthorized request", desc: "Agent complied with a request that should have required additional authorization" },
                { title: "Data exposure via indirect query", desc: "Agent revealed restricted information when question was rephrased indirectly" },
              ].map((finding, i) => (
                <div key={i} className="field-note" style={{ borderLeftColor: "#9b2c2c", borderLeftWidth: 3 }}>
                  <div className="font-bold text-sm text-red-800 mb-1 lowercase">{finding.title}</div>
                  <div className="ink-faded text-xs lowercase">{finding.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quit confirmation overlay ── */}
      {showQuit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backdropFilter: "blur(8px) saturate(0.7)" }}
          onClick={(e) => { e.stopPropagation(); setShowQuit(false); }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative z-10 parchment rough-border p-8 text-center max-w-sm"
            style={{ borderRadius: "4px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="ink-heading text-2xl mb-3">quit raid?</h2>
            <p className="ink-faded text-sm lowercase mb-6">
              your progress will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/")}
                className="flex-1 py-3 rough-border-light bg-[#d4c9b5] hover:bg-[#c8b99a] transition-colors ink-heading text-sm"
                style={{ borderRadius: "4px" }}
              >
                retreat
              </button>
              <button
                onClick={() => setShowQuit(false)}
                className="flex-1 py-3 rough-border bg-[#3d2e1f] hover:bg-[#4d3a2a] transition-colors text-[#ede4d3] text-sm"
                style={{ borderRadius: "4px", fontFamily: "var(--font-display), system-ui" }}
              >
                keep fighting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
