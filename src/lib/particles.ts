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

export function pour(from: Point, to: Point, count: number, seed = 7): Particle[] {
  const next = random(seed)
  return Array.from({ length: count }, () => ({
    from: { x: Math.round(from.x + (next() - 0.5) * 48), y: Math.round(from.y + (next() - 0.5) * 48) },
    to: { x: Math.round(to.x + (next() - 0.5) * 10), y: Math.round(to.y + (next() - 0.5) * 6) },
    delay: Math.round(next() * 300),
  }))
}

export function scatter(from: Point, count: number, spread = 80, seed = 11): Particle[] {
  const next = random(seed)
  return Array.from({ length: count }, () => ({
    from,
    to: { x: Math.round(from.x + (next() - 0.5) * spread * 2), y: Math.round(from.y - next() * spread - 20) },
    delay: Math.round(next() * 200),
  }))
}
