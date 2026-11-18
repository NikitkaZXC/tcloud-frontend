const NOTES = { click: [880], done: [523, 659, 784], error: [330, 220] }

let context: AudioContext | null = null

export function beep(kind: keyof typeof NOTES) {
  if (typeof AudioContext === 'undefined') return
  context ??= new AudioContext()
  const start = context.currentTime
  NOTES[kind].forEach((frequency, i) => {
    const osc = context!.createOscillator()
    const gain = context!.createGain()
    osc.type = 'square'
    osc.frequency.value = frequency
    gain.gain.value = 0.04
    osc.connect(gain).connect(context!.destination)
    osc.start(start + i * 0.09)
    osc.stop(start + i * 0.09 + (kind === 'click' ? 0.03 : 0.08))
  })
}
