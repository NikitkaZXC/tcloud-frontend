import type { Settings } from './settings'

export type Role = 'root' | 'admin' | 'user'
export type Priority = 'low' | 'normal' | 'high'
export type SendAs = 'file' | 'media'
export type OnConflict = 'error' | 'replace' | 'keep_both' | 'skip'
export type ArchiveFormat = 'zip' | '7z' | 'tar.gz' | 'tar.bz2' | 'tar.xz'
export type TaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
export type TelegramSessionName = 'api' | 'upload' | 'download'

export interface ApiErrorBody {
  code: string
  message: string
  [key: string]: unknown
}

export interface Grant {
  id: string
  storage_id: string
  folder: string
  path: string
  recursive: boolean
  can_read: boolean
  can_upload: boolean
  can_delete: boolean
}

export interface User {
  id: string
  login: string
  role: Role
  blocked: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Me extends User {
  grants: Grant[]
  settings: Settings
}

export interface UserSession {
  id: string
  user_agent: string | null
  ip_address: string | null
  signed_in_at: string
  last_active_at: string
  expires_at: string
  is_current: boolean
}

export interface ApiKey {
  id: string
  user_id: string
  name: string
  last_used_at: string | null
  created_at: string
  key: string | null
}

export interface Storage {
  id: string
  path: string
  name: string | null
  description: string | null
  has_photo: boolean
  available: boolean
  telegram: { chat_id: number }
  created_at: string
  updated_at: string
  files: number | null
  total_size: number | null
}

export interface TFile {
  uuid: string
  path: string
  storage_id: string
  name: string
  size: number
  mime: string
  kind: 'photo' | 'video' | 'audio' | 'animation' | 'document'
  sent_as: SendAs
  width: number | null
  height: number | null
  duration: number | null
  sha256: string
  encrypted: boolean
  created_at: string
  updated_at: string
  telegram: { chat_id: number; message_id: number; link: string; search: string }
}

export interface Folder {
  id: string
  path: string
  name: string
  created_at: string
  updated_at: string
  size: number
  files: number
}

export interface FolderListing {
  path: string
  size: number
  total_files: number
  folders: Folder[]
  files: TFile[]
}

export interface Task {
  id: string
  batch_id: string | null
  user_id: string | null
  status: TaskStatus
  stage: string
  priority: Priority
  path: string
  bytes_done: number
  bytes_total: number | null
  progress: number | null
  speed: number | null
  eta: number | null
  queue_position: number | null
  waiting: { reason: string; seconds: number | null } | null
  cancel_requested: boolean
  error: ApiErrorBody | null
  warnings: string[]
  file: TFile | null
  archive: { name: string; format: ArchiveFormat; files: number; size: number | null; expires_at: string | null } | null
  created_at: string
  updated_at: string
}

export interface BatchResponse {
  batch_id: string
  items: { path: string; task: Task | null; error: ApiErrorBody | null }[]
}

export interface Health {
  ok: boolean
  db: boolean
  telegram: boolean
  telegram_upload: boolean
  telegram_download: boolean
  antivirus: boolean
  redis: boolean
  queue: boolean
  workers: Record<string, boolean>
}

export interface Account {
  telegram_connected: boolean
  premium: boolean | null
  file_limit: number | null
  channels_used: number | null
  channels_limit: number | null
}

export interface TelegramLogin {
  step: 'starting' | 'qr' | 'code' | 'password' | 'expired' | 'failed'
  expires_at: string | null
  error: ApiErrorBody | null
}

export interface TelegramSessionState {
  session: TelegramSessionName
  authorized: boolean
  login: TelegramLogin | null
}

export interface TelegramAuthorization {
  id: string
  session: TelegramSessionName
  created_at: string | null
  active_at: string | null
  ip: string
  country: string
  current: boolean
}

export interface UploadOptions {
  path: string
  send_as: SendAs
  on_conflict: OnConflict
  priority: Priority
  allow_unscannable: boolean
  encrypt: boolean
}

export interface FolderDeleteResponse {
  path: string
  deleted_files: number
}

export interface FoundFile extends TFile {
  folder: string
  storage_name: string | null
}

export interface FoundFolder {
  id: string
  path: string
  name: string
  storage_id: string
  storage_name: string | null
  created_at: string
  updated_at: string
}

export interface SearchResult {
  items: FoundFile[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  folders: FoundFolder[]
}

export interface MimeCount {
  mime: string
  files: number
}
