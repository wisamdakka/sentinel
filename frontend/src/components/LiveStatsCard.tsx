"use client";

import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";

type StatsState =
  | { mode: "mock" }
  | {
      mode: "live";
      averageScore: number;
      totalFindings: number;
      activeSessions: number;
      gradeRows: { label: string; count: number }[];
    };

const MOCK_ROWS: { label: string; breached: boolean }[] = [
  { label: "prescription override", breached: true },
  { label: "pii data leak", breached: true },
  { label: "auth bypass", breached: false },
  { label: "refund abuse", breached: false },
  { label: "dosage manipulation", breached: true },
];

export default function LiveStatsCard() {
  const [state, setState] = useState<StatsState>({ mode: "mock" });

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api
      .stats()
      .then((s) => {
        if (cancelled) return;
        const gradeRows = Object.entries(s.gradeDistribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([label, count]) => ({ label: label.toLowerCase(), count }));
        setState({
          mode: "live",
          averageScore: s.averageScore,
          totalFindings: s.totalFindings,
          activeSessions: s.activeSessions,
          gradeRows,
        });
      })
      .catch(() => {
        /* stay in mock mode if the backend is unreachable */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.mode === "live") {
    return (
      <div
        className="rough-border-light p-5 bg-white/10"
        style={{ borderRadius: "4px" }}
      >
        <div className="text-center mb-4">
          <div className="ink-heading text-5xl mb-1">
            {state.averageScore}
            <span className="text-2xl opacity-60">/100</span>
          </div>
          <div className="ink-faded text-[10px] lowercase">
            average score across {state.totalFindings} probe{" "}
            {state.totalFindings === 1 ? "exchange" : "exchanges"} ·{" "}
            {state.activeSessions} live
          </div>
        </div>
        <div className="space-y-0">
          {state.gradeRows.length === 0 && (
            <div className="ink-faded text-xs lowercase text-center py-3">
              no findings reported yet
            </div>
          )}
          {state.gradeRows.map((row) => {
            const breached = /^[df]/i.test(row.label);
            return (
              <div
                key={row.label}
                className="flex items-center justify-between py-2.5"
                style={{ borderTop: "1px solid rgba(139,115,85,0.2)" }}
              >
                <span className="ink-faded text-xs lowercase">
                  grade {row.label}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    breached ? "text-red-800" : "text-green-800"
                  }`}
                  style={{ fontFamily: "var(--font-display), system-ui" }}
                >
                  {row.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rough-border-light p-5 bg-white/10"
      style={{ borderRadius: "4px" }}
    >
      <div className="text-center mb-4">
        <div className="ink-heading text-5xl mb-1">12%</div>
        <div className="ink-faded text-[10px] lowercase">
          average breach rate in first simulation
        </div>
      </div>
      <div className="space-y-0">
        {MOCK_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-2.5"
            style={{ borderTop: "1px solid rgba(139,115,85,0.2)" }}
          >
            <span className="ink-faded text-xs lowercase">{row.label}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                row.breached ? "text-red-800" : "text-green-800"
              }`}
              style={{ fontFamily: "var(--font-display), system-ui" }}
            >
              {row.breached ? "breached" : "held"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
