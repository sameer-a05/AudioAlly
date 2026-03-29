import { GalaxyNavbar, GalaxySplineBackground } from '../ui/galaxy-interactive-hero-section.jsx'

export default function GalaxyAppShell({ children }) {
  return (
    <div className="relative min-h-screen bg-black text-slate-200">
      <div className="pointer-events-none fixed inset-0 z-0">
        <GalaxySplineBackground />
      </div>
      <GalaxyNavbar />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  )
}
