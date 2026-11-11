// Ilustraciones abstractas animadas para cada servicio (SVG + CSS, sin imágenes).
import { cn } from "@/lib/utils";

export function ServiceVisual({ kind, className, accent }: { kind: string; className?: string; accent?: string }) {
  const a = accent || "var(--nv-primary)";
  const common = "absolute inset-0 size-full";
  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden rounded-md", className)} style={{ background: `radial-gradient(120% 90% at 80% 10%, color-mix(in oklab, ${a} 55%, transparent), transparent 60%), linear-gradient(160deg, var(--nv-navy), var(--nv-bg-dark))` }} aria-hidden>
      <div className="grid-lines absolute inset-0 opacity-30" style={{ ["--tone-line" as string]: "rgba(255,255,255,.08)" }} />
      <svg viewBox="0 0 400 300" className={common}>
        <defs>
          <linearGradient id={`sv-${kind}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--nv-lavender)" />
            <stop offset="1" stopColor="var(--nv-secondary)" />
          </linearGradient>
        </defs>
        {kind === "layers" &&
          [0, 1, 2].map((i) => (
            <g key={i} style={{ animation: `nv-float ${6 + i}s ease-in-out ${i * 0.4}s infinite` }}>
              <rect x={70 + i * 34} y={60 + i * 28} width="200" height="130" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)" />
              <rect x={86 + i * 34} y={78 + i * 28} width={80 - i * 10} height="8" rx="4" fill={`url(#sv-${kind})`} opacity={1 - i * 0.25} />
              <rect x={86 + i * 34} y={96 + i * 28} width="140" height="5" rx="2.5" fill="rgba(255,255,255,0.25)" />
              <rect x={86 + i * 34} y={108 + i * 28} width="110" height="5" rx="2.5" fill="rgba(255,255,255,0.15)" />
            </g>
          ))}
        {kind === "grid" && (
          <g>
            <rect x="60" y="50" width="280" height="40" rx="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" />
            <circle cx="84" cy="70" r="8" fill="none" stroke="var(--nv-lavender)" strokeWidth="2" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i} style={{ animation: `nv-float ${5 + i}s ease-in-out ${i * 0.3}s infinite` }}>
                <rect x="60" y={110 + i * 40} width={240 - i * 40} height="26" rx="8" fill={i === 0 ? `url(#sv-${kind})` : "rgba(255,255,255,0.07)"} />
                <text x="72" y={128 + i * 40} fontSize="11" fill={i === 0 ? "#120a33" : "rgba(255,255,255,.6)"} fontFamily="monospace">
                  #{i + 1}
                </text>
              </g>
            ))}
          </g>
        )}
        {(kind === "flow" || kind === "nodes") && (
          <g>
            {[
              [70, 80],
              [200, 60],
              [330, 100],
              [120, 210],
              [260, 220],
            ].map(([x, y], i, all) => (
              <g key={i}>
                {i < all.length - 1 && <line x1={x} y1={y} x2={all[i + 1]![0]} y2={all[i + 1]![1]} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 6" style={{ animation: "nv-marquee 20s linear infinite" }} />}
                <circle cx={x} cy={y} r={kind === "nodes" ? 18 : 14} fill="rgba(255,255,255,0.06)" stroke={`url(#sv-${kind})`} strokeWidth="2" />
                <circle cx={x} cy={y} r="4" fill="var(--nv-lavender)" style={{ animation: `nv-pulse-ring 2.4s ease-out ${i * 0.4}s infinite`, transformOrigin: `${x}px ${y}px` }} />
              </g>
            ))}
          </g>
        )}
        {(kind === "chat" || kind === "bubbles") &&
          [
            [60, 70, 170, false],
            [170, 120, 170, true],
            [60, 170, 200, false],
            [200, 220, 140, true],
          ].map(([x, y, w, me], i) => (
            <g key={i} style={{ animation: `nv-float ${5 + i}s ease-in-out ${i * 0.5}s infinite` }}>
              <rect x={x as number} y={y as number} width={w as number} height="34" rx="17" fill={me ? `url(#sv-${kind})` : "rgba(255,255,255,0.08)"} stroke={me ? "none" : "rgba(255,255,255,0.2)"} />
              <rect x={(x as number) + 16} y={(y as number) + 14} width={(w as number) - 50} height="6" rx="3" fill={me ? "rgba(18,10,51,.5)" : "rgba(255,255,255,.35)"} />
            </g>
          ))}
        {kind === "dashboard" && (
          <g>
            <rect x="50" y="50" width="300" height="200" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const h = [60, 90, 70, 120, 100, 140, 115][i]!;
              return <rect key={i} x={80 + i * 36} y={220 - h} width="20" height={h} rx="5" fill={`url(#sv-${kind})`} opacity={0.4 + i * 0.08} style={{ transformOrigin: `${90 + i * 36}px 220px`, animation: `nv-float ${4 + (i % 3)}s ease-in-out ${i * 0.2}s infinite` }} />;
            })}
            <rect x="70" y="66" width="80" height="8" rx="4" fill="rgba(255,255,255,.4)" />
          </g>
        )}
        {kind === "data" &&
          [0, 1, 2, 3, 4].map((i) => (
            <g key={i} style={{ animation: `nv-float ${6 + i}s ease-in-out ${i * 0.25}s infinite` }}>
              <rect x="60" y={50 + i * 42} width="280" height="30" rx="8" fill={i === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)"} stroke="rgba(255,255,255,0.15)" />
              <circle cx="78" cy={65 + i * 42} r="5" fill={i % 2 ? "var(--nv-lavender)" : "var(--nv-secondary)"} />
              <rect x="96" y={62 + i * 42} width="90" height="6" rx="3" fill="rgba(255,255,255,.4)" />
              <rect x="210" y={62 + i * 42} width="50" height="6" rx="3" fill="rgba(255,255,255,.2)" />
              <rect x="280" y={62 + i * 42} width="40" height="6" rx="3" fill={`url(#sv-${kind})`} />
            </g>
          ))}
        {kind === "shield" && (
          <g style={{ transformOrigin: "200px 150px" }}>
            {[90, 70, 50].map((r, i) => (
              <circle key={r} cx="200" cy="150" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray={i === 1 ? "6 8" : undefined} style={{ animation: `nv-spin-slow ${30 + i * 10}s linear infinite`, transformOrigin: "200px 150px" }} />
            ))}
            <path d="M200 105 L235 118 L235 150 C235 172 220 188 200 196 C180 188 165 172 165 150 L165 118 Z" fill={`url(#sv-${kind})`} />
            <path d="M184 150 L196 162 L218 138" fill="none" stroke="#120a33" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {kind === "refresh" && (
          <g>
            <rect x="50" y="80" width="130" height="140" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            <rect x="64" y="96" width="60" height="6" rx="3" fill="rgba(255,255,255,.2)" />
            <rect x="64" y="110" width="100" height="40" rx="4" fill="rgba(255,255,255,.08)" />
            <path d="M190 150 h30 m-10 -10 l10 10 l-10 10" stroke="var(--nv-lavender)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <g style={{ animation: "nv-float 5s ease-in-out infinite" }}>
              <rect x="230" y="70" width="130" height="160" rx="14" fill="rgba(255,255,255,0.08)" stroke={`url(#sv-${kind})`} strokeWidth="2" />
              <rect x="246" y="90" width="70" height="10" rx="5" fill={`url(#sv-${kind})`} />
              <rect x="246" y="112" width="98" height="56" rx="8" fill="rgba(255,255,255,.12)" />
              <rect x="246" y="180" width="50" height="16" rx="8" fill="var(--nv-primary)" />
            </g>
          </g>
        )}
        {kind === "orbit" && (
          <g>
            {[110, 80].map((r, i) => (
              <ellipse key={r} cx="200" cy="150" rx={r * 1.4} ry={r * 0.6} fill="none" stroke="rgba(255,255,255,0.2)" style={{ animation: `nv-spin-slow ${40 + i * 20}s linear infinite`, transformOrigin: "200px 150px" }} />
            ))}
            <circle cx="200" cy="150" r="38" fill={`url(#sv-${kind})`} />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={70 + i * 110} y={i === 1 ? 50 : 200} width="70" height="46" rx="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" style={{ animation: `nv-float ${5 + i}s ease-in-out ${i * 0.6}s infinite` }} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
