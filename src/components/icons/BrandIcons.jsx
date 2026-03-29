/** Minimal SVG icon set — Audio Ally brand (no emoji) */

export function LogoMark({ className = '', size = 36 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="logoGrad" x1="8" y1="4" x2="32" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#logoGrad)" />
      <path
        d="M12 26V14l8 6 8-6v12"
        stroke="#f8fafc"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="20" cy="12" r="2.5" fill="#fbbf24" />
    </svg>
  )
}

export function IconMic({ className = '' }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3zm5-3a5 5 0 01-10 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M12 18v3M8 21h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function IconWaveform({ className = '' }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 28v-8M14 32V16M20 28v-8M26 34V14M32 26v-4M38 30v-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconSpark({ className = '' }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 6l1.8 7.4L33 16l-7.2 2.2L24 26l-1.8-7.8L15 16l7.2-2.6L24 6zM38 28l1 4.2 4.4 1-4.2 1.2L38 39l-1-4.4-4.4-1 4.2-1.2L38 28z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  )
}

export function IconBook({ className = '' }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M12 10h12a4 4 0 014 4v22a2 2 0 00-2-2H12V10zM24 10h12v24H26a2 2 0 00-2 2V14a4 4 0 014-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconHeadphones({ className = '' }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M14 22v12a4 4 0 004 4h2M34 22v12a4 4 0 01-4 4h-2M14 22a10 10 0 1120 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconCheckCircle({ className = '' }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconXCircle({ className = '' }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function IconChevronLeft({ className = '' }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSettings({ className = '' }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82 1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconPlay({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export function IconPause({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

export function IconStop({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  )
}

/** Abstract hero art — sound + learning */
export function HeroIllustration({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 520 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="h1" x1="80" y1="40" x2="440" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6d28d9" stopOpacity="0.35" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="h2" x1="200" y1="60" x2="380" y2="280" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="24" />
        </filter>
      </defs>
      <ellipse cx="260" cy="200" rx="200" ry="120" fill="url(#h1)" filter="url(#blur)" opacity="0.9" />
      <rect x="140" y="100" width="240" height="160" rx="20" fill="#1e293b" stroke="#334155" strokeWidth="2" />
      <rect x="160" y="120" width="200" height="8" rx="4" fill="#334155" />
      <rect x="160" y="140" width="160" height="8" rx="4" fill="#475569" />
      <rect x="160" y="160" width="180" height="8" rx="4" fill="#475569" />
      <circle cx="260" cy="230" r="36" fill="url(#h2)" />
      <path
        d="M244 218v24M252 214v32M260 210v40M268 214v32M276 218v24"
        stroke="#f1f5f9"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.95"
      />
      <circle cx="400" cy="80" r="48" fill="#6d28d9" opacity="0.25" />
      <circle cx="120" cy="280" r="32" fill="#10b981" opacity="0.2" />
    </svg>
  )
}
