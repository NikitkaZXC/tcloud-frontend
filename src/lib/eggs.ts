const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

export function konami(keys: string[]): boolean {
  return keys.slice(-KONAMI.length).map((key) => key.toLowerCase()).join() === KONAMI.map((key) => key.toLowerCase()).join()
}
