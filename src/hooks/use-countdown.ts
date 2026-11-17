import { useEffect, useState } from 'react'

export function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [enabled])
  return now
}

export function useCountdown(until: number | null): number {
  const now = useNow(!!until)
  return until ? Math.max(Math.ceil((until - now) / 1000), 0) : 0
}
