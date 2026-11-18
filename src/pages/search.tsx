import { FolderIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FileDialog } from '@/components/file-dialog'
import { PageTitle } from '@/components/fx'
import { Thumb } from '@/components/thumb'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMimes, useSearch } from '@/hooks/use-search'
import { useStorages } from '@/hooks/use-storages'
import { ApiError } from '@/lib/api'
import { filesCount, formatBytes, formatDate, parentPath } from '@/lib/format'
import { foundLocation } from '@/lib/names'
import { hasCriteria, hasFilters, isDesc, KINDS, parseSearch, SEARCH_SORTS, type SearchSort, type SearchState, scopePath, searchUrl, SIZE_UNITS } from '@/lib/search'
import type { FoundFile } from '@/lib/types'

const ANY = 'any'
const folderLink = (path: string) => `/files?path=${encodeURIComponent(path)}`

function describe(error: unknown): string {
  if (!(error instanceof ApiError)) return String(error)
  if (error.code === 'validation_error') return 'Проверьте фильтры: «от» не больше «до», размер — целое число.'
  if (error.code === 'forbidden') return 'Нет доступа к этой папке.'
  if (error.code === 'folder_not_found' || error.code === 'storage_not_found') return 'Папка или хранилище больше не существует.'
  return error.message
}

function SizeFilter({ state, update }: { state: SearchState; update: (patch: Partial<SearchState>, replace?: boolean) => void }) {
  const [unit, setUnit] = useState(1024 ** 2)
  const shown = (value: number | null) => (value == null ? '' : String(+(value / unit).toFixed(2)))
  const toBytes = (value: string, factor = unit) => (value.trim() === '' || Number.isNaN(Number(value)) ? null : Math.round(Number(value) * factor))
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Размер</legend>
      <div className="flex items-center gap-1.5">
        <Input type="number" min={0} step="any" inputMode="decimal" aria-label="Размер от" placeholder="от" value={shown(state.sizeMin)} onChange={(e) => update({ sizeMin: toBytes(e.target.value) }, true)} />
        <span aria-hidden>–</span>
        <Input type="number" min={0} step="any" inputMode="decimal" aria-label="Размер до" placeholder="до" value={shown(state.sizeMax)} onChange={(e) => update({ sizeMax: toBytes(e.target.value) }, true)} />
        <Select
          value={String(unit)}
          onValueChange={(v) => {
            const next = Number(v)
            setUnit(next)
            update({ sizeMin: toBytes(shown(state.sizeMin), next), sizeMax: toBytes(shown(state.sizeMax), next) }, true)
          }}
        >
          <SelectTrigger className="w-20 shrink-0" aria-label="Единица размера">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZE_UNITS.map(([label, factor]) => (
              <SelectItem key={label} value={String(factor)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  )
}

function Filters({ state, update }: { state: SearchState; update: (patch: Partial<SearchState>, replace?: boolean) => void }) {
  const mimes = useMimes(scopePath(state))
  const mimeList = mimes.data ?? []
  const options = state.mime && !mimeList.some((m) => m.mime === state.mime) ? [{ mime: state.mime, files: 0 }, ...mimeList] : mimeList
  const [open] = useState(() => hasFilters(state) || window.matchMedia('(min-width: 640px)').matches)
  return (
    <details open={open} className="fx-panel group p-4">
      <summary className="cursor-pointer text-sm font-medium select-none pointer-coarse:py-2.5">
        Фильтры{hasFilters(state) ? ' · включены' : ''}
      </summary>
      <div className="mt-4 grid gap-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Тип</legend>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(([kind, label]) => {
              const on = state.kinds.includes(kind)
              return (
                <Button key={kind} type="button" size="sm" variant={on ? 'default' : 'outline'} aria-pressed={on} onClick={() => update({ kinds: on ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind] })}>
                  {label}
                </Button>
              )
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="search-mime">Формат</Label>
            <Select value={state.mime ?? ANY} onValueChange={(v) => update({ mime: v === ANY ? null : v })}>
              <SelectTrigger id="search-mime" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>любой</SelectItem>
                {options.map((m) => (
                  <SelectItem key={m.mime} value={m.mime}>
                    {m.mime}
                    {m.files > 0 && <span className="text-muted-foreground"> · {m.files}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SizeFilter state={state} update={update} />
          <fieldset className="grid gap-1.5 lg:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Изменён</legend>
            <div className="flex items-center gap-1.5">
              <Input type="date" aria-label="Изменён с" value={state.dateFrom} max={state.dateTo || undefined} onChange={(e) => update({ dateFrom: e.target.value })} />
              <span aria-hidden>–</span>
              <Input type="date" aria-label="Изменён по" value={state.dateTo} min={state.dateFrom || undefined} onChange={(e) => update({ dateTo: e.target.value })} />
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
            <Checkbox checked={state.encrypted} onCheckedChange={(v) => update({ encrypted: v === true })} />
            только зашифрованные
          </label>
          <div className="flex items-center gap-2">
            <Select value={state.sort} onValueChange={(v) => update({ sort: v as SearchSort, desc: null })}>
              <SelectTrigger className="w-40" aria-label="Сортировка">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_SORTS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={isDesc(state) ? 'По убыванию' : 'По возрастанию'}
              onClick={() => update({ desc: !isDesc(state) })}
            >
              {isDesc(state) ? '▼' : '▲'}
            </Button>
            {hasFilters(state) && (
              <Button type="button" variant="ghost" onClick={() => update({ kinds: [], mime: null, sizeMin: null, sizeMax: null, dateFrom: '', dateTo: '', encrypted: false })}>
                Сбросить
              </Button>
            )}
          </div>
        </div>
      </div>
    </details>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const state = parseSearch(params)
  const search = useSearch(state)
  const storages = useStorages().data ?? []
  const [opened, setOpened] = useState<FoundFile | null>(null)

  const update = (patch: Partial<SearchState>, replace = false) => navigate(searchUrl({ ...state, ...patch }), { replace })
  const pages = search.data?.pages ?? []
  const files = pages.flatMap((page) => page.items)
  const folders = pages[0]?.folders ?? []
  const total = pages[0]?.total ?? 0

  return (
    <div className="grid gap-4">
      <PageTitle text="Поиск" eyebrow="По подстроке имени и фильтрам — только файлы, к которым у вас есть доступ." />
      <Filters state={state} update={update} />
      {!hasCriteria(state) && <p className="text-sm text-muted-foreground">Введите часть имени в строке поиска или выберите фильтр.</p>}
      {search.isFetching && !search.isFetchingNextPage && <p className="text-sm text-muted-foreground">Ищем…</p>}
      {search.error && <p className="text-destructive">{describe(search.error)}</p>}
      {search.data && (
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          Найдено: {filesCount(total)}
          {folders.length > 0 && ` и папок: ${folders.length}`}
        </p>
      )}
      {(folders.length > 0 || files.length > 0) && (
        <ul className="fx-panel divide-y divide-border">
          {folders.map((folder) => (
            <li key={folder.id} className="flex items-center gap-3 px-3 py-2">
              <span className="fx-mini">
                <FolderIcon className="size-4 text-primary" aria-hidden />
              </span>
              <div className="grid min-w-0 flex-1">
                <Link to={folderLink(folder.path)} className="truncate text-base font-medium hover:underline pointer-coarse:py-2" title={folder.name}>
                  {folder.name}
                </Link>
                <span className="truncate text-xs text-muted-foreground">папка в {foundLocation(parentPath(folder.path), folder, storages)}</span>
              </div>
            </li>
          ))}
          {files.map((file) => (
            <li key={file.uuid} className="flex items-center gap-3 px-3 py-2">
              <button type="button" className="fx-thumb size-12" onClick={() => setOpened(file)} tabIndex={-1} aria-hidden>
                <Thumb file={file} iconClassName="size-5" />
              </button>
              <div className="grid min-w-0 flex-1">
                <button type="button" onClick={() => setOpened(file)} className="flex min-w-0 items-center gap-1.5 text-left text-base font-medium hover:underline pointer-coarse:py-2" title={file.name}>
                  <span className="truncate">{file.name}</span>
                  {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label="зашифрован" />}
                </button>
                <Link to={folderLink(file.folder)} className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline pointer-coarse:py-2">
                  {foundLocation(file.folder, file, storages)}
                </Link>
              </div>
              <span className="hidden shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">
                {formatBytes(file.size)}
                <span className="block">{formatDate(file.updated_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {search.data && total === 0 && folders.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ничего не найдено</p>}
      {search.hasNextPage && (
        <Button variant="outline" className="justify-self-center" disabled={search.isFetchingNextPage} onClick={() => search.fetchNextPage()}>
          {search.isFetchingNextPage ? 'Загрузка…' : `Показать ещё (${total - files.length})`}
        </Button>
      )}
      <FileDialog file={opened} onClose={() => setOpened(null)} />
    </div>
  )
}
