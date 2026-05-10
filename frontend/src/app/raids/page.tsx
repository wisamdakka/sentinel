"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getToken, type SentinelSession } from "@/lib/api";
import { fighterForBusiness } from "@/lib/fighterMap";
import FighterAvatar from "@/components/FighterAvatar";

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export default function RaidsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SentinelSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped whenever we need to re-derive status from sessionStorage (e.g.
  // after cancelling a raid). The stash itself isn't reactive.
  const [stashVersion, setStashVersion] = useState(0);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    const load = () =>
      api
        .listSessions()
        .then((res) => {
          if (!cancelled) {
            setSessions(res.sessions);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
    load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  const now = Date.now();

  return (
    <div className="relative min-h-screen bg-[#1a1810]">
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1
              className="text-4xl sm:text-5xl text-[#ede4d3] lowercase tracking-wide"
              style={{ fontFamily: "var(--font-display), system-ui" }}
            >
              the raids
            </h1>
            <p className="text-[#8b7a6b] mt-3 text-sm lowercase max-w-lg">
              every claude code session under watch. live battles unfold here
              in real time.
            </p>
          </div>

          <Link
            href="/raids/new"
            className="px-5 py-3 rough-border bg-[#3d2e1f] hover:bg-[#4d3a2a] text-[#ede4d3] text-xs lowercase tracking-wider transition-colors"
            style={{
              borderRadius: "4px",
              fontFamily: "var(--font-display), system-ui",
            }}
          >
            + new raid
          </Link>
        </div>

        {error && (
          <div className="parchment rough-border p-6 mb-6" style={{ borderRadius: "4px" }}>
            <div className="ink-heading text-sm mb-1">couldn&apos;t reach the backend</div>
            <div className="ink-faded text-xs lowercase">{error}</div>
          </div>
        )}

        {!error && sessions === null && (
          <div className="text-[#5c4a3a] text-sm lowercase">loading raids…</div>
        )}

        {sessions && sessions.length === 0 && (
          <div className="parchment rough-border p-10 text-center" style={{ borderRadius: "4px" }}>
            <h2 className="ink-heading text-xl mb-2">no raids yet</h2>
            <p className="ink-faded text-sm lowercase">
              once a claude code session starts reporting, it&apos;ll appear here.
            </p>
          </div>
        )}

        {sessions && sessions.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((s) => {
              const fighter = fighterForBusiness(s.business_type);
              const isManual =
                s.workspace?.startsWith("manual-raid:") ?? false;
              const hasStash =
                typeof window !== "undefined" &&
                window.sessionStorage.getItem(`raid:${s.session_id}:probes`) !==
                  null;
              const running = isManual && hasStash;
              // Referenced so eslint doesn't prune the stash re-read dep.
              void stashVersion;

              const status: "running" | "complete" | "idle" = running
                ? "running"
                : isManual
                ? "complete"
                : now - new Date(s.updated_at).getTime() < ACTIVE_WINDOW_MS
                ? "idle"
                : "idle";

              const dotColor =
                status === "running"
                  ? "bg-red-500 animate-pulse"
                  : status === "complete"
                  ? "bg-green-600"
                  : "bg-[#8b7a6b]";
              const dotLabelClass =
                status === "running"
                  ? "text-red-700"
                  : status === "complete"
                  ? "text-green-800"
                  : "ink-faded";

              return (
                <div
                  key={s.session_id}
                  className="parchment rough-border-light p-6 transition-all group hover:shadow-[3px_4px_0_rgba(0,0,0,0.2)] relative"
                  style={{ borderRadius: "4px" }}
                >
                  <Link
                    href={`/raids/${encodeURIComponent(s.session_id)}`}
                    className="block"
                  >
                    <div className="mb-4 group-hover:-translate-y-1 transition-transform">
                      <FighterAvatar
                        fighterId={fighter.id}
                        color={fighter.color}
                        size={64}
                      />
                    </div>

                    <h2 className="ink-heading text-lg mb-1">{fighter.name}</h2>
                    <span className="ink-faded text-xs lowercase block mb-3">
                      {s.business_type ?? "unknown domain"} ·{" "}
                      {s.workspace ?? "unnamed workspace"}
                    </span>

                    <hr className="ink-rule my-3" />

                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="ink-faded text-[10px] uppercase tracking-wider">
                          session
                        </div>
                        <div className="ink-heading text-xs font-mono truncate">
                          {s.session_id}
                        </div>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider shrink-0 ${dotLabelClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                        />
                        {status}
                      </div>
                    </div>
                  </Link>

                  {running && (
                    <button
                      type="button"
                      title="cancel raid"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.sessionStorage.removeItem(
                          `raid:${s.session_id}:probes`
                        );
                        setStashVersion((v) => v + 1);
                      }}
                      className="absolute top-4 right-4 text-[10px] tracking-wider text-[#8b7a6b] hover:text-red-700 transition-colors lowercase"
                      style={{ fontFamily: "var(--font-display), system-ui" }}
                    >
                      cancel
                    </button>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
