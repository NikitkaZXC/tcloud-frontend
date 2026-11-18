import type { Storage, Task } from './types'

const SEP = ' › '

export function isUnavailable(storage: Pick<Storage, 'available'>): boolean {
  return storage.available === false
}

export function storageName(storage: Pick<Storage, 'name'> | undefined): string {
  return storage?.name || 'хранилище'
}

function parts(path: string): string[] {
  return path.split('/').filter(Boolean)
}

export function fileName(path: string): string {
  return parts(path).at(-1) ?? ''
}

export function humanPath(path: string, storages: Pick<Storage, 'id' | 'name'>[] = []): string {
  const [, id, ...rest] = parts(path)
  if (!id) return storageName(undefined)
  return [storageName(storages.find((s) => s.id === id)), ...rest].join(SEP)
}

export function taskTitle(task: Pick<Task, 'path' | 'archive'>, storages: Pick<Storage, 'id' | 'name'>[] = []): { name: string; where: string } {
  if (task.archive) return { name: task.archive.name, where: humanPath(task.path, storages) }
  return { name: fileName(task.path), where: humanPath(parts(task.path).slice(0, -1).join('/'), storages) }
}
