import { prefersReducedMotion } from '@/lib/fx'
import type { Particle } from '@/lib/particles'

let layer: HTMLDivElement | null = null

export function burst(particles: Particle[], color: string, size = 4) {
  if (prefersReducedMotion() || typeof document === 'undefined') return
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div')
    layer.className = 'fx-px-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.append(layer)
  }
  const nodes = particles.map(({ from, to, delay }) => {
    const node = document.createElement('i')
    node.className = 'fx-px'
    node.style.cssText = `left:${from.x}px;top:${from.y}px;width:${size}px;height:${size}px;background:${color};--dx:${to.x - from.x}px;--dy:${to.y - from.y}px;animation-delay:${delay}ms`
    return node
  })
  layer.append(...nodes)
  setTimeout(() => nodes.forEach((node) => node.remove()), 1600)
}
