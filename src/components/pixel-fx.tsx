import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/fx'
import { type Particle, type Point, pour, scatter } from '@/lib/particles'
import { useReads } from '@/lib/reads'
import { useSending } from '@/lib/upload'

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

export function storageCenter(id: string): Point | null {
  for (const node of document.querySelectorAll<SVGElement>(`[data-storage="${CSS.escape(id)}"]`)) {
    const box = node.getBoundingClientRect()
    if (box.width && box.bottom > 0 && box.top < innerHeight) return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }
  return null
}

const idOf = (path: string) => path.split('/').filter(Boolean)[1] ?? ''

export function PixelBursts() {
  const sending = useSending()
  const reads = useReads()
  const pointer = useRef<Point | null>(null)
  const seen = useRef({ sending: 0, reads: 0 })

  useEffect(() => {
    const remember = (event: PointerEvent | DragEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener('pointerdown', remember, { passive: true })
    window.addEventListener('drop', remember)
    return () => {
      window.removeEventListener('pointerdown', remember)
      window.removeEventListener('drop', remember)
    }
  }, [])

  useEffect(() => {
    const fresh = sending.filter((item) => item.id > seen.current.sending)
    if (!fresh.length) return
    seen.current.sending = Math.max(...fresh.map((item) => item.id))
    const ids = [...new Set(fresh.map((item) => idOf(item.path)))]
    for (const id of ids) {
      const target = storageCenter(id)
      if (!target) continue
      const from = pointer.current ?? { x: innerWidth / 2, y: innerHeight / 2 }
      burst(pour(from, target, 28, fresh.length + target.x), 'var(--warning)')
    }
  }, [sending])

  useEffect(() => {
    const fresh = reads.filter((read) => read.id > seen.current.reads)
    if (!fresh.length) return
    seen.current.reads = Math.max(...fresh.map((read) => read.id))
    for (const id of new Set(fresh.map((read) => idOf(read.path)))) {
      const source = storageCenter(id)
      if (source) burst(scatter(source, 18, 70, source.y), 'var(--read)')
    }
  }, [reads])

  return null
}
