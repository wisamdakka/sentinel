import HeroCarousel from "@/components/HeroCarousel";
import LiveStatsCard from "@/components/LiveStatsCard";

export default function Home() {
  return (
    <div className="relative">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1a1810]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] rounded-full bg-[#2a3a20]/30 blur-[200px] -translate-y-1/3" />

        <div className="relative z-10">
          <div className="text-center pt-32 px-6">
            <h1
              className="text-7xl sm:text-8xl lg:text-[7rem] text-[#ede4d3] leading-[0.95] tracking-wide lowercase"
              style={{ fontFamily: "var(--font-display), system-ui" }}
            >
              raid
              <br />
              your agents
            </h1>

            <p className="text-base sm:text-lg text-[#8b7a6b] mt-6 max-w-lg mx-auto font-medium lowercase tracking-wide">
              choose your fighter. break some guardrails.
            </p>
          </div>

          <HeroCarousel />
        </div>
      </section>

      {/* ============ PROBLEM vs SOLUTION ============ */}
      <section className="relative py-28 bg-[#1a1810]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-0 items-stretch">

            {/* LEFT — The Problem */}
            <div className="parchment rough-border p-8 sm:p-10" style={{ borderRadius: "4px 0 0 4px", borderRight: "none" }}>
              <span className="ink-faded text-[10px] uppercase tracking-[0.2em] mb-4 block">the problem</span>
              <h2 className="ink-heading text-2xl sm:text-3xl leading-tight mb-5">
                your ai agent passed qa.
                <br />
                <span className="text-red-800">then a user broke it.</span>
              </h2>
              <p className="ink-faded text-sm leading-relaxed mb-6 lowercase">
                static prompt testing misses what real adversaries find. the
                creative multi-turn attacks, the social engineering, the edge
                cases that only emerge in live conversation.
              </p>

              <div className="space-y-3 mb-6">
                {[
                  "a chatbot approved a prescription change without a doctor",
                  "a banking agent processed a $50k transfer with no verification",
                  "an hr bot leaked salary data through indirect questioning",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-800 mt-2 flex-shrink-0" />
                    <span className="ink-faded text-sm lowercase">{item}</span>
                  </div>
                ))}
              </div>

              <LiveStatsCard />
            </div>

            {/* CENTER — VS divider */}
            <div className="hidden lg:flex flex-col items-center justify-center px-0 parchment" style={{ borderTop: "2px solid #8b7355", borderBottom: "2px solid #8b7355" }}>
              <div className="bg-[#3d2e1f] rough-border w-16 h-16 flex items-center justify-center -mx-4 z-10" style={{ borderRadius: "50%" }}>
                <span className="text-[#ede4d3] text-xs font-bold tracking-widest" style={{ fontFamily: "var(--font-display), system-ui" }}>vs</span>
              </div>
            </div>

            {/* Mobile VS */}
            <div className="flex lg:hidden items-center justify-center py-6">
              <div className="bg-[#3d2e1f] rough-border w-14 h-14 flex items-center justify-center" style={{ borderRadius: "50%" }}>
                <span className="text-[#ede4d3] text-xs font-bold tracking-widest" style={{ fontFamily: "var(--font-display), system-ui" }}>vs</span>
              </div>
            </div>

            {/* RIGHT — How It Works */}
            <div className="parchment rough-border p-8 sm:p-10" style={{ borderRadius: "0 4px 4px 0", borderLeft: "none" }}>
              <span className="ink-faded text-[10px] uppercase tracking-[0.2em] mb-4 block">the fix</span>
              <h2 className="ink-heading text-2xl sm:text-3xl leading-tight mb-5">
                send a fighter.
                <br />
                <span className="text-green-800">find it first.</span>
              </h2>
              <p className="ink-faded text-sm leading-relaxed mb-6 lowercase">
                sentinel runs adaptive, multi-turn adversarial raids against your
                agent before real users do. social engineering, edge cases, trick
                prompts — all in live conversation.
              </p>

              <div className="space-y-0 mb-8">
                {[
                  {
                    num: "1",
                    title: "choose your fighter",
                    desc: "each one specializes in a domain — healthcare, finance, legal, privacy, support.",
                  },
                  {
                    num: "2",
                    title: "set your scenario",
                    desc: "connect via api, chat, or mcp. add rules your agent must follow.",
                  },
                  {
                    num: "3",
                    title: "launch the raid",
                    desc: "adaptive multi-turn attacks. full report with transcripts and severity ratings.",
                  },
                ].map((step, i) => (
                  <div key={step.num}>
                    {i > 0 && <hr className="ink-rule" />}
                    <div className="flex gap-4 items-start py-2">
                      <span className="ink-heading text-3xl opacity-20 shrink-0 w-8">{step.num}</span>
                      <div>
                        <h3 className="ink-heading text-sm mb-1">{step.title}</h3>
                        <p className="ink-faded text-xs leading-relaxed lowercase">{step.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Storybook ending */}
              <div className="flex flex-col items-center mt-auto pt-8 -mb-2">
                <span className="ink-faded text-sm lowercase tracking-[0.3em] opacity-40 mb-4" style={{ fontFamily: "var(--font-display), system-ui" }}>
                  the end
                </span>
                <div className="flex items-end justify-center gap-4 opacity-25">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/fighters/crown.svg" alt="" className="w-14 h-14 -rotate-12" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/fighters/helmet.svg" alt="" className="w-16 h-16" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/fighters/potion.svg" alt="" className="w-14 h-14 rotate-12" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
