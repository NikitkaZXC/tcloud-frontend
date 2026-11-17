const GLYPHS = '01<>/\\[]{}#$%&*+=?АБВГДЖЗИЛ'

export function scramble(target: string, progress: number, random: () => number = Math.random): string {
  const fixed = Math.floor(target.length * Math.min(Math.max(progress, 0), 1))
  return Array.from(target, (char, i) => (i < fixed || char === ' ' ? char : GLYPHS[Math.floor(random() * GLYPHS.length)])).join('')
}

export function easeOut(progress: number): number {
  return 1 - (1 - Math.min(Math.max(progress, 0), 1)) ** 3
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
