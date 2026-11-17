export interface Picked {
  file: File
  path: string
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function walk(entry: FileSystemEntry, out: Picked[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
    out.push({ file, path: entry.fullPath.replace(/^\/+/, '') || file.name })
    return
  }
  if (!entry.isDirectory) return
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  for (let batch = await readBatch(reader); batch.length; batch = await readBatch(reader)) {
    for (const child of batch) await walk(child, out)
  }
}

export async function readEntries(entries: FileSystemEntry[]): Promise<Picked[]> {
  const out: Picked[] = []
  for (const entry of entries) await walk(entry, out)
  return out
}

export function fromFiles(files: Iterable<File>): Picked[] {
  return [...files].map((file) => ({ file, path: file.webkitRelativePath || file.name }))
}
