export function load(key: string): string | null {
  try {
    return localStorage.getItem(`tcloud.${key}`)
  } catch {
    return null
  }
}

export function save(key: string, value: string) {
  try {
    localStorage.setItem(`tcloud.${key}`, value)
  } catch {
    return
  }
}
