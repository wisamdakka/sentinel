"use client";

interface RadarChartProps {
  stats: Record<string, number>;
  color: string;
  size?: number;
}

export default function RadarChart({
  stats,
  color,
  size = 200,
}: RadarChartProps) {
  const entries = Object.entries(stats);
  const count = entries.length;
  const center = size / 2;
  const radius = size * 0.38;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radius + 24;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Grid rings
  const rings = [25, 50, 75, 100];

  // Data polygon
  const dataPoints = entries.map((_, i) => getPoint(i, entries[i][1]));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {rings.map((ring) => {
        const points = entries
          .map((_, i) => getPoint(i, ring))
          .map((p) => `${p.x},${p.y}`)
          .join(" ");
        return (
          <polygon
            key={ring}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}

      {/* Axis lines */}
      {entries.map((_, i) => {
        const p = getPoint(i, 100);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data area */}
      <path d={dataPath} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
      ))}

      {/* Labels */}
      {entries.map(([label, value], i) => {
        const p = getLabelPoint(i);
        return (
          <text
            key={label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] uppercase tracking-wider"
            fill="rgba(255,255,255,0.5)"
          >
            {label} ({value})
          </text>
        );
      })}
    </svg>
  );
}
