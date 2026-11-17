import { ApiError, refreshSession, withQuery } from './api'
import type { Task, UploadOptions } from './types'

function send(file: File, options: UploadOptions, onProgress: (loaded: number) => void): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', withQuery('/api/uploads', { ...options }))
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => resolve(xhr)
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}

export async function uploadFile(file: File, options: UploadOptions, onProgress: (loaded: number) => void): Promise<Task> {
  let xhr = await send(file, options, onProgress)
  if (xhr.status === 401 && (await refreshSession())) xhr = await send(file, options, onProgress)
  let body: { error?: ApiError['body'] } | null = null
  try {
    body = JSON.parse(xhr.responseText)
  } catch {
    body = null
  }
  if (xhr.status >= 200 && xhr.status < 300) return body as Task
  throw new ApiError(xhr.status, body?.error ?? { code: 'http_error', message: `${xhr.status}` })
}
