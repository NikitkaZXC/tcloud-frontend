import { RotateCcwIcon } from 'lucide-react'
import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { toast } from 'sonner'
import { Confirm } from '@/components/confirm'
import { PageTitle, PixelToggle, Section } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { resetSettings, type Settings, settingsError, type SettingsPatch, updateSettings, useSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'

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

const priorities = (): [Settings['uploads']['priority'], string][] => [
  ['low', t('priority.low')],
  ['normal', t('priority.normal')],
  ['high', t('priority.high')],
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
      toast.success(t(text.trim() ? 'settings.webhookSaved' : 'settings.webhookOff'))
    } catch (e) {
      setError(settingsError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor={id} className="text-base">
        {t('settings.webhook')}
      </label>
      <p id={`${id}h`} className="max-w-xl text-xs text-muted-foreground">
        {t('settings.webhookHint')}
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
          {t('common.save')}
        </Button>
        {value && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft('')}>
            {t('common.clear')}
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
      toast.success(t('settings.resetDone'))
    } catch (error) {
      toast.error(settingsError(error))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="grid">
      <header className="grid gap-4 pb-6">
        <PageTitle text={t('nav.settings')} eyebrow={t('settings.eyebrow')} />
      </header>

      <Section label={t('settings.uploads')}>
        <div className="grid">
          <Choice
            label={t('settings.sendAs')}
            hint={t('settings.sendAsHint')}
            value={uploads.send_as}
            options={[
              ['file', t('sendAs.file')],
              ['media', t('sendAs.media')],
            ]}
            onChange={(send_as) => save({ uploads: { send_as } })}
          />
          <Toggle
            label={t('settings.encrypt')}
            hint={t(uploads.send_as === 'media' ? 'settings.encryptMedia' : 'settings.encryptHint')}
            checked={uploads.encrypt && uploads.send_as === 'file'}
            disabled={uploads.send_as === 'media'}
            onChange={(encrypt) => save({ uploads: { encrypt } })}
          />
          <Choice
            label={t('settings.onConflict')}
            value={uploads.on_conflict}
            options={[
              ['error', t('conflict.error')],
              ['replace', t('conflict.replace')],
              ['keep_both', t('conflict.keepBoth')],
              ['skip', t('conflict.skip')],
            ]}
            onChange={(on_conflict) => save({ uploads: { on_conflict } })}
          />
          <Choice label={t('settings.uploadPriority')} value={uploads.priority} options={priorities()} onChange={(priority) => save({ uploads: { priority } })} />
          <Toggle
            label={t('settings.unscannable')}
            hint={t('settings.unscannableHint')}
            checked={uploads.allow_unscannable}
            onChange={(allow_unscannable) => save({ uploads: { allow_unscannable } })}
          />
        </div>
      </Section>

      <Section label={t('settings.archives')}>
        <div className="grid">
          <Choice
            label={t('settings.archiveFormat')}
            hint={t('settings.archiveFormatHint')}
            value={archives.format}
            options={(['zip', '7z', 'tar.gz', 'tar.bz2', 'tar.xz'] as const).map((format) => [format, format])}
            onChange={(format) => save({ archives: { format } })}
          />
          <Choice label={t('settings.archivePriority')} value={archives.priority} options={priorities()} onChange={(priority) => save({ archives: { priority } })} />
        </div>
      </Section>

      <Section label={t('settings.interface')}>
        <div className="grid">
          <Choice
            label={t('settings.language')}
            hint={t('settings.languageHint')}
            value={ui.language ?? 'auto'}
            options={[
              ['auto', t('settings.languageAuto')],
              ['ru', 'Русский'],
              ['en', 'English'],
            ]}
            onChange={(language) => setUi({ language: language === 'auto' ? null : language })}
          />
          <Choice
            label={t('settings.theme')}
            value={ui.theme}
            options={[
              ['dark', t('settings.themeDark')],
              ['light', t('settings.themeLight')],
              ['system', t('settings.themeSystem')],
            ]}
            onChange={(theme) => setUi({ theme })}
          />
          <Choice
            label={t('settings.startPage')}
            hint={t('settings.startPageHint')}
            value={ui.start_page}
            options={[
              ['dashboard', t('nav.dashboard')],
              ['storages', t('nav.storages')],
              ['tasks', t('nav.tasks')],
            ]}
            onChange={(start_page) => setUi({ start_page })}
          />
          <Choice
            label={t('settings.folderView')}
            value={ui.folder_view}
            options={[
              ['list', t('folder.list')],
              ['grid', t('folder.grid')],
            ]}
            onChange={(folder_view) => setUi({ folder_view })}
          />
          <Choice
            label={t('settings.tasksFilter')}
            hint={t('settings.tasksFilterHint')}
            value={ui.tasks_filter}
            options={[
              ['all', t('tasks.filterAll')],
              ['active_and_failed', t('tasks.filterActive')],
            ]}
            onChange={(tasks_filter) => setUi({ tasks_filter })}
          />
          <Toggle label={t('settings.animations')} hint={t('settings.animationsHint')} checked={ui.animations} onChange={(animations) => setUi({ animations })} />
          <Toggle label={t('dashboard.map')} checked={ui.activity_map} onChange={(activity_map) => setUi({ activity_map })} />
          <Toggle
            label={t('settings.confirmDelete')}
            hint={t('settings.confirmDeleteHint')}
            checked={ui.confirm_delete}
            onChange={(confirm_delete) => setUi({ confirm_delete })}
          />
        </div>
      </Section>

      <Section label={t('settings.telegram')}>
        <div className="grid">
          <Toggle
            label={t('settings.chatFolder')}
            hint={t('settings.chatFolderHint')}
            checked={settings.telegram.chat_folder}
            onChange={(chat_folder) => save({ telegram: { chat_folder } })}
          />
        </div>
      </Section>

      <Section label={t('settings.extras')}>
        <div className="grid">
          <Toggle label={t('settings.pet')} hint={t('settings.petHint')} checked={ui.fx_pet} onChange={(fx_pet) => setUi({ fx_pet })} />
          <Toggle label={t('settings.sounds')} hint={t('settings.soundsHint')} checked={ui.fx_sounds} onChange={(fx_sounds) => setUi({ fx_sounds })} />
          <Toggle label={t('settings.confetti')} checked={ui.fx_confetti} onChange={(fx_confetti) => setUi({ fx_confetti })} />
          <Toggle label={t('settings.cursor')} hint={t('settings.cursorHint')} checked={ui.fx_cursor} onChange={(fx_cursor) => setUi({ fx_cursor })} />
          <Toggle label={t('settings.eggs')} hint={t('settings.eggsHint')} checked={ui.fx_easter_eggs} onChange={(fx_easter_eggs) => setUi({ fx_easter_eggs })} />
        </div>
      </Section>

      <Section label={t('settings.webhooks')}>
        <Webhook value={uploads.webhook_url} />
      </Section>

      <Section label={t('settings.reset')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">{t('settings.resetHint')}</p>
          <Confirm title={t('settings.resetQ')} description={t('settings.resetConfirm')} action={t('user.reset')} onConfirm={reset}>
            <Button variant="destructive" disabled={resetting}>
              <RotateCcwIcon /> {t('settings.resetButton')}
            </Button>
          </Confirm>
        </div>
      </Section>
    </div>
  )
}
