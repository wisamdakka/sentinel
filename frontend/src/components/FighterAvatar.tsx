"use client";

interface FighterAvatarProps {
  fighterId: string;
  color: string;
  size?: number;
  className?: string;
}

export default function FighterAvatar({
  fighterId,
  color,
  size = 80,
  className = "",
}: FighterAvatarProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, ${color}50, transparent 70%)`,
          opacity: 0.6,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/fighters/${fighterId}.svg`}
        alt={fighterId}
        className="relative z-10 object-contain"
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 15px ${color}50)`,
        }}
      />
    </div>
  );
}
