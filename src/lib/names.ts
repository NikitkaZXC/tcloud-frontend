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
  if (task.archive) {
    const id = parts(task.path)[1] ?? ''
    const name = id ? task.archive.name.replaceAll(id, storageName(storages.find((s) => s.id === id))) : task.archive.name
    return { name, where: humanPath(task.path, storages) }
  }
  return { name: fileName(task.path), where: humanPath(parts(task.path).slice(0, -1).join('/'), storages) }
}

export function foundLocation(dir: string, item: { storage_id: string; storage_name: string | null }, storages: Pick<Storage, 'id' | 'name'>[] = []): string {
  const name = item.storage_name ?? storages.find((s) => s.id === item.storage_id)?.name ?? null
  return humanPath(dir, [{ id: item.storage_id, name }])
}
