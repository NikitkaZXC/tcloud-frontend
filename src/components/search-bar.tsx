import { SearchIcon, XIcon } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isTyping, SEARCH_INPUT } from '@/lib/commands'
import { defaultScope, EMPTY_SEARCH, parseSearch, type Scope, SCOPES, scopesFor, searchUrl, type SearchState } from '@/lib/search'
import { t } from '@/lib/i18n'

export function SearchBar() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const onSearch = pathname === '/search'
  const here = pathname === '/files' ? params.get('path') : null
  const urlState = onSearch ? parseSearch(params) : null
  const urlQ = urlState?.q ?? ''
  const [text, setText] = useState(urlQ)
  const [seenQ, setSeenQ] = useState(urlQ)
  const [pending, setPending] = useState(false)
  if (urlQ !== seenQ) {
    setSeenQ(urlQ)
    if (!pending) setText(urlQ)
  }
  const [picked, setPicked] = useState<{ here: string | null; scope: Scope } | null>(null)
  const where = urlState ? urlState.in : here
  const scope = picked?.here === here ? picked.scope : defaultScope(here)
  const current: SearchState = urlState ?? { ...EMPTY_SEARCH, in: where, scope }
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function type(value: string) {
    setText(value)
    setPending(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setPending(false)
      if (onSearch) navigate(searchUrl({ ...current, q: value }), { replace: true })
      else if (value.trim()) navigate(searchUrl({ ...current, q: value }))
    }, 300)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || isTyping(event.target) || document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    clearTimeout(timer.current)
    setPending(false)
    navigate(searchUrl({ ...current, q: text }), { replace: onSearch })
  }

  function changeScope(next: Scope) {
    setPicked({ here, scope: next })
    if (onSearch || text.trim()) navigate(searchUrl({ ...current, q: text, scope: next }))
  }

  const scopes = scopesFor(where)

  return (
    <form role="search" onSubmit={submit} className="mb-6 flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={input}
          id={SEARCH_INPUT}
          type="search"
          value={text}
          onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            type('')
            input.current?.blur()
          }}
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
          className="pr-8 pl-8"
        />
        {text && (
          <button type="button" onClick={() => type('')} aria-label={t('common.clear')} className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground pointer-coarse:size-11">
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      {scopes.length > 1 && (
        <div role="group" aria-label={t('search.where')} className="flex">
          {SCOPES.filter(([value]) => scopes.includes(value)).map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={current.scope === value ? 'default' : 'outline'} aria-pressed={current.scope === value} onClick={() => changeScope(value)}>
              {t(label)}
            </Button>
          ))}
        </div>
      )}
    </form>
  )
}
