import { useSearchParams } from 'react-router'
import { FolderView } from '@/components/folder-view'
import { StorageList } from '@/components/storages'

export function FilesPage() {
  const [params] = useSearchParams()
  const path = params.get('path')
  return path ? <FolderView key={path} path={path} /> : <StorageList />
}
