import { useEffect, useRef, useState } from 'react'
import { easeOut, prefersReducedMotion } from '@/lib/fx'

export function useTween(target: number, duration: number): number {
  const [shown, setShown] = useState(0)
  const current = useRef(0)
  useEffect(() => {
    const from = current.current
    if (prefersReducedMotion() || from === target) {
      current.current = target
      setShown(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const next = from + (target - from) * easeOut((now - start) / duration)
      current.current = next
      setShown(next)
      if (now - start < duration) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return prefersReducedMotion() ? target : shown
}
