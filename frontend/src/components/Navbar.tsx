"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "@/lib/api";

const navItems = [
  { href: "/", label: "home" },
  { href: "/fighters", label: "fighters" },
  { href: "/raids", label: "raids" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
    const onStorage = () => setLoggedIn(!!getToken());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40" style={{ background: "rgba(26,24,16,0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(139,115,85,0.15)" }}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fighters/flag.svg" alt="" className="w-5 h-5" />
          <span
            className="text-sm tracking-wider text-[#8b7a6b] group-hover:text-[#ede4d3] transition-colors lowercase"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            sentinel
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-1.5 text-xs font-bold tracking-wider transition-all lowercase ${
                  isActive
                    ? "text-[#ede4d3]"
                    : "text-[#5c4a3a] hover:text-[#8b7a6b]"
                }`}
                style={{ fontFamily: "var(--font-display), system-ui" }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {loggedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-1.5 text-xs font-bold tracking-wider text-[#5c4a3a] hover:text-[#8b7a6b] transition-all lowercase"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            sign out
          </button>
        ) : (
          <Link
            href="/login"
            className="px-4 py-1.5 text-xs font-bold tracking-wider text-[#5c4a3a] hover:text-[#8b7a6b] transition-all lowercase"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
