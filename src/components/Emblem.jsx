// Original, hand-built SVG emblems (one per page/hero). Simple geometric homages — not official logos.
// All strokes/fills use currentColor + CSS variables so they pick up the active theme.
export default function Emblem({ id, size = 48, className = '', title }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', className: `emblem emblem-${id} ${className}`, role: title ? 'img' : undefined, 'aria-label': title, 'aria-hidden': title ? undefined : true }
  switch (id) {
    case 'reactor': // arc-reactor style ring: outer ring, 10 coil segments, inner triangle core
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="3" />
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2
            const x = 32 + Math.cos(a) * 21
            const y = 32 + Math.sin(a) * 21
            return <rect key={i} x={x - 2.4} y={y - 4.2} width="4.8" height="8.4" rx="1" fill="currentColor" transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} opacity="0.85" />
          })}
          <circle cx="32" cy="32" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
          <polygon points="32,23 40,37 24,37" fill="currentColor" />
        </svg>
      )
    case 'shield': // concentric shield with a five-point star
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="29" fill="var(--primary)" />
          <circle cx="32" cy="32" r="23" fill="var(--accent)" />
          <circle cx="32" cy="32" r="17" fill="var(--primary)" />
          <circle cx="32" cy="32" r="12" fill="var(--accent-2)" />
          <polygon points="32,21.5 34.6,29.2 42.7,29.3 36.2,34.1 38.6,41.8 32,37.1 25.4,41.8 27.8,34.1 21.3,29.3 29.4,29.2" fill="#f4f6fb" />
        </svg>
      )
    case 'hammer': // war hammer: blocky head, wrapped handle, strap loop, lightning tick
      return (
        <svg {...common}>
          <rect x="14" y="10" width="36" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M14 16h36M14 22h36" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
          <rect x="29" y="28" width="6" height="24" fill="currentColor" />
          {[32, 37, 42, 47].map((y) => (
            <path key={y} d={`M29 ${y}l6 2.5`} stroke="var(--bg)" strokeWidth="1.2" />
          ))}
          <circle cx="32" cy="56" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M50 4l-5 8h4l-4 7" fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )
    case 'hourglass': // two triangles meeting at a point, inside a thin ring
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
          <polygon points="18,12 46,12 32,31" fill="currentColor" />
          <polygon points="18,52 46,52 32,33" fill="currentColor" />
        </svg>
      )
    case 'gamma': // gamma glyph inside a cracked hexagon
      return (
        <svg {...common}>
          <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M20 20c5-2 8 1 10 6l2 6 2-6c2-5 5-8 10-6" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M32 32v18" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M8 30l9 3-4 6 8 3" fill="none" stroke="var(--accent-2)" strokeWidth="1.4" opacity="0.8" />
        </svg>
      )
    case 'mandala': // spell circle: two rings, rotated squares, runic ticks
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2.4" />
          <rect x="17" y="17" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="17" y="17" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(45 32 32)" />
          <circle cx="32" cy="32" r="6" fill="var(--accent-2)" />
          <circle cx="32" cy="32" r="2.4" fill="var(--bg)" />
        </svg>
      )
    case 'assemble': // six small hero marks orbiting a ring
    default:
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="32" cy="32" r="19" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2
            return <circle key={i} cx={32 + Math.cos(a) * 19} cy={32 + Math.sin(a) * 19} r="3.6" fill={i % 2 ? 'var(--accent)' : 'var(--primary)'} />
          })}
          <circle cx="32" cy="32" r="7" fill="currentColor" />
        </svg>
      )
  }
}
