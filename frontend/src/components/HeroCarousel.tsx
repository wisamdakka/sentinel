"use client";

import { useState, useMemo } from "react";
import { fighters } from "@/lib/fighters";
import FighterAvatar from "@/components/FighterAvatar";
import FighterModal from "@/components/FighterModal";

const VISIBLE = 7;

export default function HeroCarousel() {
  const [centerIndex, setCenterIndex] = useState(Math.floor(fighters.length / 2));
  const [modalFighter, setModalFighter] = useState<typeof fighters[0] | null>(null);

  const visibleFighters = useMemo(() => {
    const half = Math.floor(VISIBLE / 2);
    const result = [];
    for (let i = -half; i <= half; i++) {
      const idx = ((centerIndex + i) % fighters.length + fighters.length) % fighters.length;
      result.push({ fighter: fighters[idx], originalIndex: idx, offset: i });
    }
    return result;
  }, [centerIndex]);

  const handleClick = (originalIndex: number, offset: number) => {
    if (offset === 0) {
      setModalFighter(fighters[originalIndex]);
    } else {
      setCenterIndex(originalIndex);
    }
  };

  return (
    <div
      className="relative mt-16 pb-8"
      style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}
    >
      <div className="flex items-start justify-center gap-14">
        {visibleFighters.map(({ fighter, originalIndex, offset }) => {
          const dist = Math.abs(offset);
          const isCenter = dist === 0;
          const isAdj = dist === 1;

          const avatarSize = isCenter ? 230 : isAdj ? 195 : 165;
          const topPush = dist * 95;

          const avgStat = Math.round(
            Object.values(fighter.stats).reduce((a, b) => a + b, 0) / 5
          );

          return (
            <button
              key={`${originalIndex}-${offset}`}
              onClick={() => handleClick(originalIndex, offset)}
              className="flex-shrink-0 w-[260px] flex flex-col items-center group"
              style={{
                marginTop: topPush,
                transition: "margin-top 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <div
                className="relative z-10 group-hover:-translate-y-3"
                style={{
                  marginBottom: -110,
                  transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <FighterAvatar
                  fighterId={fighter.id}
                  color={fighter.color}
                  size={avatarSize}
                />
              </div>

              <div
                className="relative w-full h-[280px] px-5 flex flex-col justify-end pb-5 text-center"
                style={{
                  background: isCenter
                    ? "linear-gradient(180deg, rgba(237,228,211,0.12) 0%, rgba(61,46,31,0.7) 60%)"
                    : "linear-gradient(180deg, rgba(237,228,211,0.06) 0%, rgba(61,46,31,0.5) 60%)",
                  border: `${isCenter ? "2px" : "1.5px"} solid rgba(139,115,85,${isCenter ? "0.5" : "0.25"})`,
                  borderRadius: "4px",
                  boxShadow: isCenter
                    ? "2px 3px 0 rgba(0,0,0,0.2)"
                    : "1px 2px 0 rgba(0,0,0,0.1)",
                  transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <div className="text-left">
                  <h3
                    className="font-bold text-[#ede4d3] lowercase"
                    style={{
                      fontFamily: "var(--font-display), system-ui",
                      fontSize: isCenter ? 22 : 17,
                      letterSpacing: "0.02em",
                      transition: "font-size 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {fighter.name}
                  </h3>
                  <span className="text-[12px] text-[#8b7a6b] lowercase">
                    {fighter.domain}
                  </span>
                </div>

                <div
                  className="absolute bottom-4 right-4 flex items-center gap-2"
                  style={{
                    opacity: isCenter ? 1 : 0.3,
                    transition: "opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <span
                    className="font-bold text-[#8b7a6b]"
                    style={{
                      fontFamily: "var(--font-display), system-ui",
                      fontSize: isCenter ? 12 : 10,
                      transition: "font-size 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    PWR {(avgStat / 20).toFixed(1)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {modalFighter && (
        <FighterModal
          fighter={modalFighter}
          onClose={() => setModalFighter(null)}
          onNavigate={(f) => {
            setModalFighter(f);
            setCenterIndex(fighters.findIndex((x) => x.id === f.id));
          }}
        />
      )}
    </div>
  );
}
