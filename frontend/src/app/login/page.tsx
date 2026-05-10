"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .setupStatus()
      .then((s) => setFirstRun(s.setupRequired))
      .catch(() => setFirstRun(false));
  }, []);

  const isSignUp = firstRun === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { token } = await api.setupInit(email, password, name || undefined);
        setToken(token);
      } else {
        const { token } = await api.login(email, password);
        setToken(token);
      }
      router.push("/raids");
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#1a1810]" onClick={() => router.push("/")}>
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fighters/flag.svg" alt="" className="w-8 h-8" />
          </Link>
          <h1 className="text-2xl mt-4 lowercase" style={{ fontFamily: "var(--font-display), system-ui", color: "#ede4d3" }}>
            {firstRun === null
              ? "…"
              : isSignUp
              ? "forge the first operator"
              : "welcome back"}
          </h1>
          <p className="text-sm mt-2 lowercase" style={{ color: "#8b7a6b" }}>
            {firstRun === null
              ? " "
              : isSignUp
              ? "first run — claim the admin seat"
              : "sign in to your operator account"}
          </p>
        </div>

        {/* Form card */}
        <div className="parchment rough-border p-8" style={{ borderRadius: "4px" }} onClick={(e) => e.stopPropagation()}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div>
                <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                  callsign
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="enter your callsign"
                  className="w-full px-4 py-3 bg-white/40 rough-border-light text-sm placeholder:text-[#b0a08e] focus:outline-none transition-all lowercase"
                  style={{ borderRadius: "4px", color: "#3d2e1f" }}
                />
              </div>
            )}

            <div>
              <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="operator@sentinel.io"
                className="w-full px-4 py-3 bg-white/40 rough-border-light text-sm placeholder:text-[#b0a08e] focus:outline-none transition-all lowercase"
                style={{ borderRadius: "4px", color: "#3d2e1f" }}
              />
            </div>

            <div>
              <label className="block ink-faded text-[10px] uppercase tracking-wider mb-2">
                password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="enter your password"
                className="w-full px-4 py-3 bg-white/40 rough-border-light text-sm placeholder:text-[#b0a08e] focus:outline-none transition-all lowercase"
                style={{ borderRadius: "4px", color: "#3d2e1f" }}
              />
            </div>

            {error && (
              <div className="text-xs text-red-800 lowercase">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rough-border bg-[#3d2e1f] hover:bg-[#4d3a2a] transition-colors text-[#ede4d3] font-bold text-lg lowercase tracking-wide disabled:opacity-60"
              style={{ borderRadius: "4px", fontFamily: "var(--font-display), system-ui" }}
            >
              {submitting
                ? isSignUp
                  ? "forging…"
                  : "signing in…"
                : isSignUp
                ? "claim the seat"
                : "enter the arena"}
            </button>
          </form>

          {isSignUp && (
            <p className="mt-5 text-center ink-faded text-[10px] lowercase leading-relaxed">
              this is the first run of your sentinel server. the account you
              create will be the admin.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
