import { describe, expect, it } from 'vitest'
import { fromFiles, readEntries } from './dir-upload'

const fileEntry = (fullPath: string) =>
  ({ isFile: true, isDirectory: false, fullPath, file: (ok: (f: File) => void) => ok(new File(['x'], fullPath.split('/').pop()!)) }) as unknown as FileSystemEntry

function dirEntry(fullPath: string, children: FileSystemEntry[]) {
  return {
    isFile: false,
    isDirectory: true,
    fullPath,
    createReader: () => {
      const batches = [children.slice(0, 1), children.slice(1), []]
      return { readEntries: (ok: (e: FileSystemEntry[]) => void) => ok(batches.shift() ?? []) }
    },
  } as unknown as FileSystemEntry
}

describe('directory upload', () => {
  it('walks nested directories in batches and keeps relative paths', async () => {
    const tree = dirEntry('/photos', [fileEntry('/photos/a.jpg'), dirEntry('/photos/2026', [fileEntry('/photos/2026/b.jpg')]), dirEntry('/photos/empty', [])])
    const picked = await readEntries([tree, fileEntry('/top.txt')])
    expect(picked.map((p) => p.path)).toEqual(['photos/a.jpg', 'photos/2026/b.jpg', 'top.txt'])
  })

  it('uses webkitRelativePath from a directory input', () => {
    const file = new File(['x'], 'c.txt')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'dir/sub/c.txt' })
    expect(fromFiles([file, new File(['y'], 'd.txt')]).map((p) => p.path)).toEqual(['dir/sub/c.txt', 'd.txt'])
  })
})
