import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils.js'

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=800&auto=format&fit=crop'

export default function FeatureCard({
  title = 'Feature Title',
  description = 'Feature description goes here.',
  tag = 'Tag',
  actionText = 'Learn More',
  imageSrc = DEFAULT_IMAGE,
  actionTo,
  onActionClick,
  className,
  style,
  staggerDelayMs,
  actionLeadingIcon,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    let time = 0
    let animationFrameId

    const waveData = Array.from({ length: 6 }).map(() => ({
      value: Math.random() * 0.5 + 0.1,
      targetValue: Math.random() * 0.5 + 0.1,
      speed: Math.random() * 0.02 + 0.01,
    }))

    function resizeCanvas() {
      if (!container) return
      const w = Math.max(1, Math.floor(container.clientWidth))
      const h = Math.max(1, Math.floor(container.clientHeight))
      canvas.width = w
      canvas.height = h
    }

    function updateWaveData() {
      waveData.forEach((data) => {
        if (Math.random() < 0.02) data.targetValue = Math.random() * 0.7 + 0.1
        const diff = data.targetValue - data.value
        data.value += diff * data.speed
      })
    }

    function draw() {
      const { width, height } = canvas
      if (width < 1 || height < 1) return
      ctx.clearRect(0, 0, width, height)
      waveData.forEach((data, i) => {
        const freq = data.value * 5
        ctx.beginPath()
        for (let x = 0; x <= width; x += 5) {
          const nx = (x / width) * 2 - 1
          const px = nx + i * 0.04 + freq * 0.03
          const py =
            Math.sin(px * 8 + time) * Math.cos(px * 2) * freq * 0.15 * ((i + 1) / 6)
          const y = (py + 1) * height / 2
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const intensity = Math.min(1, freq * 0.4)
        ctx.lineWidth = 1 + i * 0.5
        ctx.strokeStyle = `rgba(${130 + intensity * 100}, ${0 + intensity * 100}, 219, ${0.4 + i / 20})`
        ctx.stroke()
      })
    }

    function animate() {
      time += 0.03
      updateWaveData()
      draw()
      animationFrameId = requestAnimationFrame(animate)
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
      draw()
    })
    resizeObserver.observe(container)
    resizeCanvas()
    animate()

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  const staggerStyle =
    staggerDelayMs != null
      ? { '--stagger-delay': `${staggerDelayMs}ms`, ...style }
      : style

  const actionClass =
    'text-[#D1A3FF] hover:text-white transition-colors flex items-center gap-1.5 text-sm font-medium group/btn'

  const showSparkles = actionLeadingIcon === 'sparkles'

  return (
    <div
      className={cn(
        'w-full max-w-sm mx-auto group h-full',
        staggerDelayMs != null && 'aa-stagger-item',
        className,
      )}
      style={staggerStyle}
    >
      <div className="relative card-border overflow-hidden rounded-2xl flex flex-col bg-[#0A0A10]/80 backdrop-blur-xl border border-white/10 transition-transform duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#8200DB]/20 h-full">
        <div className="p-4 flex justify-center relative pb-0">
          <div
            ref={containerRef}
            className="w-full h-48 rounded-xl gradient-border inner-glow overflow-hidden relative bg-black"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay transition-opacity duration-500 group-hover:opacity-40"
              style={{ backgroundImage: `url(${imageSrc})` }}
            />
            <div className="absolute inset-0">
              <div
                className="w-full h-full animate-pulse-grid"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
            </div>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            <div className="absolute inset-0 bg-linear-to-t from-[#0A0A10] to-transparent opacity-80" />
          </div>
        </div>

        <div className="w-full h-px bg-linear-to-r from-transparent via-white/20 to-transparent mt-4" />

        <div className="p-6 flex flex-col flex-grow">
          <div className="mb-3">
            <span className="inline-block px-3 py-1 bg-[#8200DB]/20 text-[#D1A3FF] rounded-full text-xs font-medium border border-[#8200DB]/30 shadow-[0_0_10px_rgba(130,0,219,0.2)]">
              {tag}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
          <p className="text-gray-400 mb-6 leading-relaxed text-sm grow">{description}</p>

          <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
            {actionTo ? (
              <Link to={actionTo} className={actionClass}>
                {showSparkles && (
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {actionText}
                <ArrowRight className="h-4 w-4 shrink-0 transform transition-transform group-hover/btn:translate-x-1" />
              </Link>
            ) : (
              <button
                type="button"
                className={actionClass}
                onClick={onActionClick}
              >
                {showSparkles && (
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {actionText}
                <ArrowRight className="h-4 w-4 shrink-0 transform transition-transform group-hover/btn:translate-x-1" />
              </button>
            )}
            <div className="flex space-x-1" aria-hidden>
              <div className="w-1.5 h-1.5 rounded-full bg-[#8200DB] animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#8200DB]/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
