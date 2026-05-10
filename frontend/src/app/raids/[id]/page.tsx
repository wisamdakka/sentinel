"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  getToken,
  type SentinelActivity,
  type SentinelSession,
} from "@/lib/api";
import { fighterForBusiness } from "@/lib/fighterMap";
import { rollFakeFinding } from "@/lib/demoScorer";
import FighterAvatar from "@/components/FighterAvatar";

type Loaded = {
  session: SentinelSession;
  activities: SentinelActivity[];
};

type ScriptedProbe = {
  id: number;
  title: string;
  question: string;
  risk: string;
  severity: string;
};

function formatClock(iso: string, anchor: number): string {
  const diffMs = new Date(iso).getTime() - anchor;
  const total = Math.max(0, Math.floor(diffMs / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function RaidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plannedProbes, setPlannedProbes] = useState<ScriptedProbe[]>([]);
  const [otherSessions, setOtherSessions] = useState<SentinelSession[]>([]);

  useEffect(() => {
    if (!getToken()) return;
    let stopped = false;
    const load = () =>
      api
        .listSessions()
        .then((res) => {
          if (!stopped) {
            setOtherSessions(
              res.sessions.filter((s) => s.session_id !== decodedId)
            );
          }
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [decodedId]);

  useEffect(() => {
    const stashed = window.sessionStorage.getItem(`raid:${decodedId}:probes`);
    if (stashed) {
      try {
        setPlannedProbes(JSON.parse(stashed));
      } catch {
        /* ignore */
      }
    }
  }, [decodedId]);

  // Demo-mode executor: for manual raids (workspace "manual-raid:..."),
  // roll fake scores for the next queued probe on a timer, POST it as a
  // finding, then refetch. Real external-agent execution replaces this later.
  useEffect(() => {
    if (!data || plannedProbes.length === 0) return;
    if (!data.session.workspace?.startsWith("manual-raid:")) return;
    // Real-target raids are driven by the backend executor — the
    // client-side demo roller must stand down.
    if (window.sessionStorage.getItem(`raid:${decodedId}:mode`) === "real") {
      return;
    }
    const nextIdx = data.activities.length;
    if (nextIdx >= plannedProbes.length) {
      window.sessionStorage.removeItem(`raid:${decodedId}:probes`);
      return;
    }
    let stopped = false;
    const timer = setTimeout(async () => {
      if (stopped) return;
      const probe = plannedProbes[nextIdx];
      const roll = rollFakeFinding(probe.severity);
      try {
        await api.postFinding({
          session_id: decodedId,
          workspace: data.session.workspace,
          business_type: data.session.business_type,
          probe_title: probe.title,
          probe_question: probe.question,
          response: roll.response,
          score: roll.score,
          grade: roll.grade,
          severity: probe.severity,
          assessment: roll.assessment,
        });
        const [sRes, aRes] = await Promise.all([
          api.getSession(decodedId),
          api.getSessionActivity(decodedId),
        ]);
        if (!stopped) {
          setData({ session: sRes.session, activities: aRes.activities });
        }
      } catch {
        /* swallow — polling will retry */
      }
    }, 2500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [data, plannedProbes, decodedId]);

  // Re-check cancellation between renders: if the stash was cleared from
  // the list page (cancel button there), also clear local state so the
  // executor effect stops scheduling.
  useEffect(() => {
    if (plannedProbes.length === 0) return;
    const stashed = window.sessionStorage.getItem(`raid:${decodedId}:probes`);
    if (!stashed) setPlannedProbes([]);
  }, [data, plannedProbes, decodedId]);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    let stopped = false;
    const load = async () => {
      try {
        const [sessionRes, activityRes] = await Promise.all([
          api.getSession(decodedId),
          api.getSessionActivity(decodedId),
        ]);
        if (stopped) return;
        setData({
          session: sessionRes.session,
          activities: activityRes.activities,
        });
        setError(null);
      } catch (err) {
        if (stopped) return;
        setError(err instanceof Error ? err.message : "failed to load raid");
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [decodedId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1810]">
        <div className="parchment rough-border p-8 max-w-md" style={{ borderRadius: "4px" }}>
          <h2 className="ink-heading text-xl mb-2">raid unreachable</h2>
          <p className="ink-faded text-sm lowercase">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1810] text-[#5c4a3a] text-sm lowercase">
        loading raid…
      </div>
    );
  }

  const { session, activities } = data;
  const fighter = fighterForBusiness(session.business_type);
  const anchor = new Date(session.started_at).getTime();

  const scores = activities
    .map((a) => a.data.score)
    .filter((s): s is number => typeof s === "number");
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

  const breaches = activities.filter((a) => (a.data.score ?? 100) < 50);
  const warnings = activities.filter(
    (a) => (a.data.score ?? 100) >= 50 && (a.data.score ?? 100) < 75
  );
  const passed = activities.filter((a) => (a.data.score ?? 0) >= 75);

  // Agent "health" = avg score; player "health" = inverse pressure
  const enemyHealthPct = avgScore ?? 100;
  const playerHealthPct = Math.max(
    20,
    100 - breaches.length * 15 - warnings.length * 5
  );

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="absolute inset-0 battle-scene">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #87CEEB 0%, #a8d8ea 30%, #c4e0f0 50%, #b8d8e8 70%, #7ab8d4 100%)",
          }}
        />
        <div className="absolute top-[8%] left-[15%] w-[400px] h-[200px] rounded-full bg-white/20 blur-[60px]" />
        <div className="absolute top-[12%] right-[20%] w-[300px] h-[150px] rounded-full bg-white/15 blur-[50px]" />
        <div className="absolute bottom-[20%] left-[10%] w-[350px] h-[200px] rounded-full bg-[#6aaa6a]/10 blur-[70px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
            imageRendering: "pixelated",
          }}
        />
      </div>

      {/* Enemy HUD */}
      <div className="absolute top-[25%] left-6 z-20 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fighters/skull.svg"
          alt=""
          className="w-14 h-14"
          style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.3))" }}
        />
        <div>
          <span
            className="text-white/80 text-xs font-bold uppercase tracking-widest block mb-1.5"
            style={{
              fontFamily: "var(--font-display), system-ui",
              textShadow: "1px 1px 0 rgba(0,0,0,0.3)",
            }}
          >
            target agent
          </span>
          <div
            className="w-48 h-4 bg-black/40 border-2 border-white/20"
            style={{ borderRadius: "2px", imageRendering: "pixelated" }}
          >
            <div
              className="h-full health-bar-enemy"
              style={{
                width: `${enemyHealthPct}%`,
                borderRadius: "1px",
                boxShadow: "0 0 8px rgba(74,222,128,0.4)",
              }}
            />
          </div>
          <span
            className="text-white/40 text-[10px] mt-1 block"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            {session.business_type ?? "unknown domain"}
          </span>
        </div>
      </div>

      {/* Player HUD */}
      <div className="absolute bottom-[25%] right-8 z-20 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div>
            <span
              className="text-white/80 text-xs font-bold uppercase tracking-widest block mb-1.5 text-right"
              style={{
                fontFamily: "var(--font-display), system-ui",
                textShadow: "1px 1px 0 rgba(0,0,0,0.3)",
              }}
            >
              {fighter.name.toLowerCase()}
            </span>
            <div
              className="w-48 h-4 bg-black/40 border-2 border-white/20"
              style={{ borderRadius: "2px", imageRendering: "pixelated" }}
            >
              <div
                className="h-full health-bar-player"
                style={{
                  width: `${playerHealthPct}%`,
                  borderRadius: "1px",
                  boxShadow: "0 0 8px rgba(251,191,36,0.4)",
                }}
              />
            </div>
            <span
              className="text-white/40 text-[10px] mt-1 block text-right"
              style={{ fontFamily: "var(--font-display), system-ui" }}
            >
              {session.workspace ?? "unnamed workspace"}
            </span>
          </div>
          <div
            style={{ imageRendering: "pixelated" }}
            className="w-14 h-14 flex items-center justify-center"
          >
            <FighterAvatar
              fighterId={fighter.id}
              color={fighter.color}
              size={50}
            />
          </div>
        </div>
      </div>

      {/* Raid switcher dock */}
      {otherSessions.length > 0 && (
        <div
          className="fixed top-[68px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rough-border-light"
          style={{
            background: "rgba(26,24,16,0.9)",
            backdropFilter: "blur(8px)",
            borderRadius: "4px",
            boxShadow: "2px 3px 0 rgba(0,0,0,0.25)",
          }}
        >
          <span
            className="text-[9px] uppercase tracking-widest text-[#8b7a6b] mr-1"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            other raids
          </span>
          {Array.from(
            otherSessions
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.updated_at).getTime() -
                  new Date(a.updated_at).getTime()
              )
              .reduce((acc, s) => {
                const fid = fighterForBusiness(s.business_type).id;
                if (!acc.has(fid)) acc.set(fid, s);
                return acc;
              }, new Map<string, SentinelSession>())
              .values()
          )
            .slice(0, 8)
            .map((s) => {
              const f = fighterForBusiness(s.business_type);
              return (
                <Link
                  key={s.session_id}
                  href={`/raids/${encodeURIComponent(s.session_id)}`}
                  title={`${f.name} · ${s.business_type ?? "unknown"}`}
                  className="w-9 h-9 flex items-center justify-center rough-border-light transition-transform hover:-translate-y-0.5"
                  style={{
                    background: "rgba(61,46,31,0.6)",
                    borderRadius: "3px",
                  }}
                >
                  <FighterAvatar fighterId={f.id} color={f.color} size={28} />
                </Link>
              );
            })}
          <Link
            href="/raids"
            className="ml-2 px-2 py-1 text-[9px] uppercase tracking-widest text-[#c8b99a] hover:text-[#ede4d3] hover:bg-white/5 rough-border-light"
            style={{
              borderRadius: "3px",
              fontFamily: "var(--font-display), system-ui",
            }}
          >
            all
          </Link>
        </div>
      )}

      {/* Battle log + results */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 h-full flex items-start pt-[150px] pb-6 overflow-y-auto">
        <div
          className="parchment rough-border p-6 sm:p-8 w-full"
          style={{ borderRadius: "4px" }}
        >
          <div
            className="rough-border-light bg-[#3d2e1f] p-5 mb-6"
            style={{ borderRadius: "4px" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span
                className="text-[#c8b99a] text-xs font-bold tracking-wider uppercase"
                style={{ fontFamily: "var(--font-display), system-ui" }}
              >
                live battle log
              </span>
            </div>

            <div className="space-y-2 font-mono text-sm max-h-80 overflow-y-auto">
              {activities.length === 0 && plannedProbes.length === 0 && (
                <div className="text-[#8b7a6b] text-xs lowercase">
                  no probe exchanges yet. waiting for the next round…
                </div>
              )}
              {activities.length === 0 &&
                plannedProbes.map((p) => (
                  <div key={p.id} className="flex gap-3 items-start">
                    <span className="text-[#8b7a6b] w-12 flex-shrink-0">
                      --:--
                    </span>
                    <span className="text-[#c8b99a]">
                      [QUEUED] {p.title} ·{" "}
                      <span className="text-[#8b7a6b]">{p.severity}</span>
                    </span>
                  </div>
                ))}
              {activities.map((a) => {
                const score = a.data.score ?? 100;
                const breach = score < 50;
                const warn = score >= 50 && score < 75;
                const cls = breach
                  ? "text-red-400 font-bold"
                  : warn
                  ? "text-amber-300"
                  : "text-green-400";
                const tag = breach ? "BREACH" : warn ? "STRAIN" : "HELD";
                return (
                  <div key={a.id} className="flex gap-3 items-start">
                    <span className="text-[#8b7a6b] w-12 flex-shrink-0">
                      {formatClock(a.timestamp, anchor)}
                    </span>
                    <span className={cls}>
                      [{tag}] {a.data.probeTitle ?? "probe"} —{" "}
                      {a.data.grade ?? "?"} ({score}/100)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="ink-heading text-xl">raid results</h2>
              <span className="ink-heading text-4xl">
                {avgScore ?? "—"}
                {avgScore !== null && "/100"}
              </span>
            </div>

            <hr className="ink-rule mt-0 mb-4" />

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="field-note text-center py-3">
                <div className="text-2xl font-black text-red-700">
                  {breaches.length}
                </div>
                <div className="ink-faded text-[10px] uppercase tracking-wider mt-1">
                  critical
                </div>
              </div>
              <div className="field-note text-center py-3">
                <div className="text-2xl font-black text-amber-700">
                  {warnings.length}
                </div>
                <div className="ink-faded text-[10px] uppercase tracking-wider mt-1">
                  warning
                </div>
              </div>
              <div className="field-note text-center py-3">
                <div className="text-2xl font-black text-green-800">
                  {passed.length}
                </div>
                <div className="ink-faded text-[10px] uppercase tracking-wider mt-1">
                  passed
                </div>
              </div>
            </div>

            {breaches.length > 0 && (
              <>
                <h3 className="ink-heading text-sm mb-3">critical findings</h3>
                <div className="space-y-3">
                  {breaches.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      className="field-note"
                      style={{ borderLeftColor: "#9b2c2c", borderLeftWidth: 3 }}
                    >
                      <div className="font-bold text-sm text-red-800 mb-1 lowercase">
                        {b.data.probeTitle ?? "unnamed probe"}
                      </div>
                      <div className="ink-faded text-xs lowercase">
                        {b.data.assessment ?? b.data.question ?? ""}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
