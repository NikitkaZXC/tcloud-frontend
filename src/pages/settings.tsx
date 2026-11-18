import { RotateCcwIcon } from 'lucide-react'
import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { toast } from 'sonner'
import { Confirm } from '@/components/confirm'
import { PageTitle, PixelToggle, Section } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { resetSettings, type Settings, settingsError, type SettingsPatch, updateSettings, useSettings } from '@/lib/settings'

type Ui = Settings['interface']

function save(patch: SettingsPatch) {
  updateSettings(patch).catch((error) => toast.error(settingsError(error)))
}

function Row({ label, hint, children }: { label: string; hint?: string; children: (ids: { label: string; hint?: string }) => ReactNode }) {
  const id = useId()
  const ids = { label: `${id}l`, hint: hint ? `${id}h` : undefined }
  return (
    <div className="fx-dotted flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b py-2.5 last:border-b-0">
      <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
        <span id={ids.label} className="text-base">
          {label}
        </span>
        {hint && (
          <span id={ids.hint} className="text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children(ids)}
    </div>
  )
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      {(ids) => <PixelToggle checked={checked} disabled={disabled} onChange={onChange} labelledBy={ids.label} describedBy={ids.hint} />}
    </Row>
  )
}

function Choice<T extends string>({ label, hint, value, options, onChange }: { label: string; hint?: string; value: T; options: [T, string][]; onChange: (next: T) => void }) {
  return (
    <Row label={label} hint={hint}>
      {(ids) => (
        <Select value={value} onValueChange={(next) => onChange(next as T)}>
          <SelectTrigger className="w-full sm:w-56" aria-labelledby={ids.label} aria-describedby={ids.hint}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(([option, text]) => (
              <SelectItem key={option} value={option}>
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Row>
  )
}

const PRIORITIES: [Settings['uploads']['priority'], string][] = [
  ['low', 'низкий'],
  ['normal', 'обычный'],
  ['high', 'высокий'],
]

function Webhook({ value }: { value: string | null }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const text = draft ?? value ?? ''
  const id = useId()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateSettings({ uploads: { webhook_url: text.trim() || null } })
      setDraft(null)
      toast.success(text.trim() ? 'Вебхук сохранён' : 'Вебхук выключен')
    } catch (e) {
      setError(settingsError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor={id} className="text-base">
        Адрес вебхука задач
      </label>
      <p id={`${id}h`} className="max-w-xl text-xs text-muted-foreground">
        Сервер отправит POST, когда задача загрузки завершится. Действует для загрузок без своего callback_url, в том числе через API-ключ. Пусто — без вебхука.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://hooks.example.com/tcloud"
          value={text}
          maxLength={2048}
          onChange={(e) => {
            setDraft(e.target.value)
            setError('')
          }}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}e` : `${id}h`}
          className="min-w-0 flex-1 basis-64"
        />
        <Button type="submit" disabled={busy || text === (value ?? '')}>
          Сохранить
        </Button>
        {value && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft('')}>
            Очистить
          </Button>
        )}
      </div>
      {error && (
        <p id={`${id}e`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

export function SettingsPage() {
  const settings = useSettings()
  const { uploads, archives } = settings
  const ui = settings.interface
  const setUi = (patch: Partial<Ui>) => save({ interface: patch })
  const [resetting, setResetting] = useState(false)

  async function reset() {
    setResetting(true)
    try {
      await resetSettings()
      toast.success('Настройки сброшены')
    } catch (error) {
      toast.error(settingsError(error))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="grid">
      <header className="grid gap-4 pb-6">
        <PageTitle text="Настройки" eyebrow="Хранятся в аккаунте и действуют на любом устройстве. Изменения сохраняются сразу." />
      </header>

      <Section label="Загрузки">
        <div className="grid">
          <Choice
            label="Отправлять как"
            hint="Медиа Telegram сжимает и не шифрует"
            value={uploads.send_as}
            options={[
              ['file', 'файл (оригинал)'],
              ['media', 'медиа (сжатие)'],
            ]}
            onChange={(send_as) => save({ uploads: { send_as } })}
          />
          <Toggle
            label="Шифровать файлы"
            hint={uploads.send_as === 'media' ? 'Только при отправке файлом' : 'Без ключа сервера файл в Telegram не прочитать'}
            checked={uploads.encrypt && uploads.send_as === 'file'}
            disabled={uploads.send_as === 'media'}
            onChange={(encrypt) => save({ uploads: { encrypt } })}
          />
          <Choice
            label="Если файл уже есть"
            value={uploads.on_conflict}
            options={[
              ['error', 'ошибка'],
              ['replace', 'заменить'],
              ['keep_both', 'оставить оба'],
              ['skip', 'пропустить'],
            ]}
            onChange={(on_conflict) => save({ uploads: { on_conflict } })}
          />
          <Choice label="Приоритет загрузок" value={uploads.priority} options={PRIORITIES} onChange={(priority) => save({ uploads: { priority } })} />
          <Toggle
            label="Принимать непроверяемые файлы"
            hint="Файлы, которые антивирус не может проверить полностью (например, архивы с паролем)"
            checked={uploads.allow_unscannable}
            onChange={(allow_unscannable) => save({ uploads: { allow_unscannable } })}
          />
        </div>
      </Section>

      <Section label="Архивы">
        <div className="grid">
          <Choice
            label="Формат по умолчанию"
            hint="Первым пунктом в меню «Скачать папку» и «Скачать архивом»"
            value={archives.format}
            options={(['zip', '7z', 'tar.gz', 'tar.bz2', 'tar.xz'] as const).map((format) => [format, format])}
            onChange={(format) => save({ archives: { format } })}
          />
          <Choice label="Приоритет архивов" value={archives.priority} options={PRIORITIES} onChange={(priority) => save({ archives: { priority } })} />
        </div>
      </Section>

      <Section label="Интерфейс">
        <div className="grid">
          <Choice
            label="Тема"
            value={ui.theme}
            options={[
              ['dark', 'тёмная'],
              ['light', 'светлая'],
            ]}
            onChange={(theme) => setUi({ theme })}
          />
          <Choice
            label="Стартовая страница"
            hint="Открывается после входа"
            value={ui.start_page}
            options={[
              ['dashboard', 'дашборд'],
              ['storages', 'хранилища'],
              ['tasks', 'задачи'],
            ]}
            onChange={(start_page) => setUi({ start_page })}
          />
          <Choice
            label="Вид папки"
            value={ui.folder_view}
            options={[
              ['list', 'список'],
              ['grid', 'плитка'],
            ]}
            onChange={(folder_view) => setUi({ folder_view })}
          />
          <Choice
            label="Сортировка в папке"
            value={ui.sort_by}
            options={[
              ['name', 'имя'],
              ['modified', 'изменён'],
              ['uploaded', 'загружен'],
              ['type', 'тип'],
              ['size', 'размер'],
            ]}
            onChange={(sort_by) => setUi({ sort_by })}
          />
          <Choice
            label="Порядок"
            value={ui.sort_order}
            options={[
              ['asc', 'по возрастанию ▲'],
              ['desc', 'по убыванию ▼'],
            ]}
            onChange={(sort_order) => setUi({ sort_order })}
          />
          <Toggle label="Папки сверху" checked={ui.folders_first} onChange={(folders_first) => setUi({ folders_first })} />
          <Choice
            label="Список задач"
            hint="На странице «Задачи» и в «Активности» дашборда"
            value={ui.tasks_filter}
            options={[
              ['all', 'все'],
              ['active_and_failed', 'активные и ошибки'],
            ]}
            onChange={(tasks_filter) => setUi({ tasks_filter })}
          />
          <Toggle label="Анимации" hint="Выключено — как при «уменьшении движения» в системе" checked={ui.animations} onChange={(animations) => setUi({ animations })} />
          <Toggle
            label="Спрашивать перед удалением"
            hint="Удаление нескольких выбранных элементов подтверждается всегда"
            checked={ui.confirm_delete}
            onChange={(confirm_delete) => setUi({ confirm_delete })}
          />
        </div>
      </Section>

      <Section label="Фишки">
        <div className="grid">
          <Toggle label="Пиксельный питомец" hint="Живёт над профилем, ест загружаемые файлы" checked={ui.fx_pet} onChange={(fx_pet) => setUi({ fx_pet })} />
          <Toggle label="8-битные звуки" hint="Клик, готово, ошибка" checked={ui.fx_sounds} onChange={(fx_sounds) => setUi({ fx_sounds })} />
          <Toggle label="Конфетти за достижения" checked={ui.fx_confetti} onChange={(fx_confetti) => setUi({ fx_confetti })} />
          <Toggle label="Пиксельный курсор" hint="Искры по клику" checked={ui.fx_cursor} onChange={(fx_cursor) => setUi({ fx_cursor })} />
          <Toggle label="Пасхалки и подсказки" hint="Советы внизу страниц, секреты" checked={ui.fx_easter_eggs} onChange={(fx_easter_eggs) => setUi({ fx_easter_eggs })} />
        </div>
      </Section>

      <Section label="Вебхуки">
        <Webhook value={uploads.webhook_url} />
      </Section>

      <Section label="Сброс">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">Вернуть все настройки к значениям по умолчанию, включая вебхук.</p>
          <Confirm title="Сбросить настройки?" description="Все группы вернутся к значениям по умолчанию." action="Сбросить" onConfirm={reset}>
            <Button variant="destructive" disabled={resetting}>
              <RotateCcwIcon /> Сбросить по умолчанию
            </Button>
          </Confirm>
        </div>
      </Section>
    </div>
  )
}
