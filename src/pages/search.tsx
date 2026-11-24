import { ChevronDownIcon, FolderIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FileDialog } from '@/components/file-dialog'
import { PageTitle } from '@/components/fx'
import { Thumb } from '@/components/thumb'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMimes, useSearch } from '@/hooks/use-search'
import { useStorages } from '@/hooks/use-storages'
import { ApiError, errorMessage } from '@/lib/api'
import { filesCount, formatBytes, formatDate, formatShortDate, parentPath } from '@/lib/format'
import { foundLocation } from '@/lib/names'
import { foundFiles, hasCriteria, hasFilters, isDesc, KINDS, MIMES_MAX, parseSearch, SEARCH_SORTS, type SearchSort, type SearchState, scopePath, searchUrl, SIZE_UNITS } from '@/lib/search'
import type { FoundFile } from '@/lib/types'
import { t } from '@/lib/i18n'

const folderLink = (path: string) => `/files?path=${encodeURIComponent(path)}`

function describe(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessage(error)
  if (error.code === 'validation_error') return t('search.validation')
  if (error.code === 'forbidden') return t('search.forbidden')
  if (error.code === 'folder_not_found' || error.code === 'storage_not_found') return t('search.gone')
  return errorMessage(error)
}

function SizeFilter({ state, update }: { state: SearchState; update: (patch: Partial<SearchState>, replace?: boolean) => void }) {
  const [unit, setUnit] = useState(1024 ** 2)
  const shown = (value: number | null) => (value == null ? '' : String(+(value / unit).toFixed(2)))
  const toBytes = (value: string, factor = unit) => (value.trim() === '' || Number.isNaN(Number(value)) ? null : Math.round(Number(value) * factor))
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 fx-label">{t('sort.size')}</legend>
      <div className="flex items-center gap-1.5">
        <Input type="number" min={0} step="any" inputMode="decimal" aria-label={t('search.sizeFrom')} placeholder={t('search.from')} value={shown(state.sizeMin)} onChange={(e) => update({ sizeMin: toBytes(e.target.value) }, true)} />
        <span aria-hidden>–</span>
        <Input type="number" min={0} step="any" inputMode="decimal" aria-label={t('search.sizeTo')} placeholder={t('search.to')} value={shown(state.sizeMax)} onChange={(e) => update({ sizeMax: toBytes(e.target.value) }, true)} />
        <Select
          value={String(unit)}
          onValueChange={(v) => {
            const next = Number(v)
            setUnit(next)
            update({ sizeMin: toBytes(shown(state.sizeMin), next), sizeMax: toBytes(shown(state.sizeMax), next) }, true)
          }}
        >
          <SelectTrigger className="w-20 shrink-0" aria-label={t('search.unit')}>
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
  const options = [...state.mimes.filter((mime) => !mimeList.some((m) => m.mime === mime)).map((mime) => ({ mime, files: 0 })), ...mimeList]
  const [open] = useState(() => hasFilters(state) || window.matchMedia('(min-width: 640px)').matches)
  return (
    <details open={open} className="fx-panel group p-4">
      <summary className="cursor-pointer fx-label select-none pointer-coarse:py-2.5">
        {t('search.filters')}{hasFilters(state) ? ` · ${t('search.filtersOn')}` : ''}
      </summary>
      <div className="mt-4 grid gap-4">
        <fieldset>
          <legend className="mb-1.5 fx-label">{t('sort.type')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(([kind, label]) => {
              const on = state.kinds.includes(kind)
              return (
                <Button key={kind} type="button" size="sm" variant={on ? 'default' : 'outline'} aria-pressed={on} onClick={() => update({ kinds: on ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind] })}>
                  {t(label)}
                </Button>
              )
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,4fr)]">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="search-mime">{t('search.format')}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button id="search-mime" type="button" variant="outline" className="w-full justify-between">
                  <span className="truncate">{state.mimes.length === 0 ? t('search.any') : state.mimes.length === 1 ? state.mimes[0] : `${state.mimes[0]} +${state.mimes.length - 1}`}</span>
                  <ChevronDownIcon className="text-muted-foreground" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72">
                <DropdownMenuCheckboxItem checked={state.mimes.length === 0} disabled={state.mimes.length === 0} onCheckedChange={() => update({ mimes: [] })}>
                  {t('search.any')}
                </DropdownMenuCheckboxItem>
                {options.map((m) => {
                  const on = state.mimes.includes(m.mime)
                  return (
                    <DropdownMenuCheckboxItem
                      key={m.mime}
                      checked={on}
                      disabled={!on && state.mimes.length >= MIMES_MAX}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => update({ mimes: on ? state.mimes.filter((x) => x !== m.mime) : [...state.mimes, m.mime] })}
                    >
                      {m.mime}
                      {m.files > 0 && <span className="text-muted-foreground"> · {m.files}</span>}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <SizeFilter state={state} update={update} />
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 fx-label">{t('sort.modified')}</legend>
            <div className="flex items-center gap-1.5">
              <Input type="date" aria-label={t('search.modifiedFrom')} className={state.dateFrom ? undefined : 'text-muted-foreground'} value={state.dateFrom} max={state.dateTo || undefined} onChange={(e) => update({ dateFrom: e.target.value })} />
              <span aria-hidden>–</span>
              <Input type="date" aria-label={t('search.modifiedTo')} className={state.dateTo ? undefined : 'text-muted-foreground'} value={state.dateTo} min={state.dateFrom || undefined} onChange={(e) => update({ dateTo: e.target.value })} />
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
            <Checkbox checked={state.encrypted} onCheckedChange={(v) => update({ encrypted: v === true })} />
            {t('search.encryptedOnly')}
          </label>
          <div className="flex items-center gap-2">
            <Select value={state.sort} onValueChange={(v) => update({ sort: v as SearchSort, desc: null })}>
              <SelectTrigger className="w-40" aria-label={t('folder.sort')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_SORTS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {t(label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t(isDesc(state) ? 'folder.descArrow' : 'folder.ascArrow')}
              onClick={() => update({ desc: !isDesc(state) })}
            >
              {isDesc(state) ? '▼' : '▲'}
            </Button>
            {hasFilters(state) && (
              <Button type="button" variant="ghost" onClick={() => update({ kinds: [], mimes: [], sizeMin: null, sizeMax: null, dateFrom: '', dateTo: '', encrypted: false })}>
                {t('user.reset')}
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
  const files = foundFiles(pages)
  const folders = pages[0]?.folders ?? []
  const total = pages[0]?.total ?? 0

  return (
    <div className="grid gap-4">
      <PageTitle text={t('nav.search')} eyebrow={t('search.eyebrow')} />
      <Filters state={state} update={update} />
      {!hasCriteria(state) && <p className="text-sm text-muted-foreground">{t('search.empty')}</p>}
      {search.isFetching && !search.isFetchingNextPage && <p className="text-sm text-muted-foreground">{t('search.searching')}</p>}
      {search.error && <p className="text-destructive">{describe(search.error)}</p>}
      {search.data && (
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {t('search.found', { files: filesCount(total) })}
          {folders.length > 0 && ` ${t('search.andFolders', { n: folders.length })}`}
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
                <Link to={folderLink(folder.path)} className="truncate text-base hover:underline pointer-coarse:py-2" title={folder.name}>
                  {folder.name}
                </Link>
                <span className="truncate text-xs text-muted-foreground">{t('search.folderIn', { where: foundLocation(parentPath(folder.path), folder, storages) })}</span>
              </div>
            </li>
          ))}
          {files.map((file) => (
            <li key={file.uuid} className="flex items-center gap-3 px-3 py-2">
              <button type="button" className="fx-thumb size-12" onClick={() => setOpened(file)} tabIndex={-1} aria-hidden>
                <Thumb file={file} iconClassName="size-5" />
              </button>
              <div className="grid min-w-0 flex-1">
                <button type="button" onClick={() => setOpened(file)} className="flex min-w-0 items-center gap-1.5 text-left text-base hover:underline pointer-coarse:py-2" title={file.name}>
                  <span className="truncate">{file.name}</span>
                  {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label={t('folder.encrypted')} />}
                </button>
                <Link to={folderLink(file.folder)} className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline pointer-coarse:py-2">
                  {foundLocation(file.folder, file, storages)}
                </Link>
              </div>
              <span className="hidden shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">
                {formatBytes(file.size)}
                <span className="block" title={formatDate(file.updated_at)}>{formatShortDate(file.updated_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {search.data && total === 0 && folders.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('common.nothingFound')}</p>}
      {search.hasNextPage && (
        <Button variant="outline" className="justify-self-center" disabled={search.isFetchingNextPage} onClick={() => search.fetchNextPage()}>
          {search.isFetchingNextPage ? t('common.loading') : t('search.more', { n: total - files.length })}
        </Button>
      )}
      <FileDialog file={opened} onClose={() => setOpened(null)} />
    </div>
  )
}
