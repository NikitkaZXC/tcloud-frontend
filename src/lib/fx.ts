export function easeOut(progress: number): number {
  return 1 - (1 - Math.min(Math.max(progress, 0), 1)) ** 3
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
