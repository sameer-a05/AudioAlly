/**
 * Ally the owl. Friendly guide for Audio Ally.
 * Moods: default | wave | celebrate | think | encourage
 */
export default function MascotCharacter({
  mood = 'default',
  size = 200,
  className = '',
  title = 'Ally the owl',
  decorative = false,
}) {
  const wave = mood === 'wave'
  const celebrate = mood === 'celebrate'
  const think = mood === 'think'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`aa-mascot aa-mascot--${mood} ${className}`}
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
    >
      <defs>
        <linearGradient id="mascotBody" x1="40" y1="40" x2="160" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="0.5" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="mascotBelly" x1="70" y1="120" x2="130" y2="175">
          <stop stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="mascotEar" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <g className={celebrate ? 'aa-mascot-celebrate' : ''} style={{ transformOrigin: '100px 120px' }}>
        <path
          d="M52 48 L40 12 L78 36 Z"
          fill="url(#mascotEar)"
          stroke="#312e81"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M148 48 L160 12 L122 36 Z"
          fill="url(#mascotEar)"
          stroke="#312e81"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        <ellipse cx="100" cy="125" rx="72" ry="68" fill="url(#mascotBody)" stroke="#312e81" strokeWidth="3" />
        <ellipse cx="100" cy="138" rx="48" ry="40" fill="url(#mascotBelly)" />

        <g className={wave ? 'aa-mascot-wing-wave' : ''} style={{ transformOrigin: '55px 125px' }}>
          <ellipse cx="48" cy="128" rx="22" ry="38" fill="#5b21b6" opacity="0.85" transform="rotate(-12 48 128)" />
        </g>
        <ellipse cx="152" cy="128" rx="22" ry="38" fill="#5b21b6" opacity="0.85" transform="rotate(12 152 128)" />

        <ellipse cx="78" cy="95" rx="26" ry="30" fill="#f8fafc" stroke="#1e1b4b" strokeWidth="2.5" />
        <ellipse cx="122" cy="95" rx="26" ry="30" fill="#f8fafc" stroke="#1e1b4b" strokeWidth="2.5" />

        <g className={think ? 'aa-mascot-eyes-think' : ''}>
          <circle className="aa-mascot-pupil" cx="78" cy="98" r="12" fill="#1e293b" />
          <circle className="aa-mascot-pupil" cx="122" cy="98" r="12" fill="#1e293b" />
          <circle cx="74" cy="94" r="4" fill="#fff" opacity="0.9" />
          <circle cx="118" cy="94" r="4" fill="#fff" opacity="0.9" />
        </g>

        <path d="M92 118 L108 118 L100 132 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" />

        <path d="M82 178 L78 192 L88 188 Z" fill="#f59e0b" />
        <path d="M118 178 L122 192 L112 188 Z" fill="#f59e0b" />
      </g>
    </svg>
  )
}
