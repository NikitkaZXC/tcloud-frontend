export interface Point {
  x: number
  y: number
}

export interface Particle {
  from: Point
  to: Point
  delay: number
}

function random(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

export function scatter(from: Point, count: number, spread = 80, seed = 11): Particle[] {
  const next = random(seed)
  return Array.from({ length: count }, () => ({
    from,
    to: { x: Math.round(from.x + (next() - 0.5) * spread * 2), y: Math.round(from.y - next() * spread - 20) },
    delay: Math.round(next() * 200),
  }))
}
