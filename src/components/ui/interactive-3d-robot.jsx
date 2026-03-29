import { Suspense, lazy } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

/**
 * Lazy-loaded Spline 3D scene with a loading fallback.
 * @param {{ scene: string, className?: string }} props
 */
export function InteractiveRobotSpline({ scene, className = '' }) {
  return (
    <Suspense
      fallback={
        <div
          className={`flex h-full w-full items-center justify-center bg-slate-950 text-white ${className}`}
        >
          <svg
            className="mr-3 h-5 w-5 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z"
            />
          </svg>
          <span className="text-sm text-slate-300">Loading scene…</span>
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  )
}
