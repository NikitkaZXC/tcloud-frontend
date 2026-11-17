import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '@/lib/fx'

export function useProgress(duration: number, key: unknown): number {
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0))
  useEffect(() => {
    if (prefersReducedMotion()) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const next = Math.min((now - start) / duration, 1)
      setProgress(next)
      if (next < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, key])
  return progress
}
