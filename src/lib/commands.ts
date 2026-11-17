export type FolderAction = 'upload' | 'upload-folder' | 'url' | 'new-folder' | 'archive' | 'search'

export const FOLDER_ACTION = 'tcloud:folder-action'
export const OPEN_PALETTE = 'tcloud:palette'

export function runFolderAction(action: FolderAction) {
  window.dispatchEvent(new CustomEvent(FOLDER_ACTION, { detail: action }))
}

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE))
}

export interface Command {
  id: string
  group: string
  label: string
  hint?: string
  run: () => void
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return commands.filter((command) => {
    const text = `${command.group} ${command.label} ${command.hint ?? ''}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}
