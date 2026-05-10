import Link from "next/link";
import { fighters } from "@/lib/fighters";
import FighterAvatar from "@/components/FighterAvatar";

export default function FightersPage() {
  return (
    <div className="relative min-h-screen bg-[#1a1810]">
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl text-[#ede4d3] lowercase tracking-wide"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            choose your fighter
          </h1>
          <p className="text-[#8b7a6b] mt-3 max-w-lg mx-auto text-sm lowercase">
            each fighter probes a specific domain. pick the one that matches
            your agent's territory.
          </p>
        </div>

        {/* Fighter grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {fighters.map((fighter) => {
            const avgStat = Math.round(
              Object.values(fighter.stats).reduce((a, b) => a + b, 0) / 5
            );

            return (
              <Link
                key={fighter.id}
                href={`/fighters/${fighter.id}`}
                className="parchment rough-border-light p-6 transition-all group hover:shadow-[3px_4px_0_rgba(0,0,0,0.2)]"
                style={{ borderRadius: "4px" }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="mb-3 group-hover:-translate-y-1 transition-transform">
                      <FighterAvatar fighterId={fighter.id} color={fighter.color} size={72} />
                    </div>
                    <h2 className="ink-heading text-xl">{fighter.name}</h2>
                    <span className="ink-faded text-xs lowercase">
                      {fighter.class} / {fighter.domain}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="ink-heading text-2xl opacity-40">{avgStat}</div>
                    <div className="ink-faded text-[10px] uppercase tracking-wider">pwr</div>
                  </div>
                </div>

                {/* Description */}
                <p className="ink-faded text-sm leading-relaxed mb-5 lowercase">
                  {fighter.description}
                </p>

                {/* Stats preview */}
                <div className="space-y-2">
                  {Object.entries(fighter.stats)
                    .slice(0, 3)
                    .map(([stat, value]) => (
                      <div key={stat} className="flex items-center gap-3">
                        <span className="ink-faded text-[10px] uppercase tracking-wider w-20">
                          {stat}
                        </span>
                        <div className="flex-1 stat-bar-track rounded-sm overflow-hidden" style={{ height: "8px" }}>
                          <div
                            className="stat-bar-fill"
                            style={{ width: `${value}%`, height: "100%" }}
                          />
                        </div>
                        <span className="ink-faded text-xs font-mono w-8 text-right">
                          {value}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Abilities preview */}
                <div className="mt-5 flex gap-1.5 flex-wrap">
                  {fighter.abilities.map((ability) => (
                    <span
                      key={ability.name}
                      className="px-2 py-0.5 text-[10px] lowercase ink-faded rough-border-light bg-white/10"
                      style={{ borderRadius: "2px" }}
                    >
                      {ability.name}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
