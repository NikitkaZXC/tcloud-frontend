export const COLUMNS = ['name', 'type', 'size', 'modified', 'uploaded'] as const
export type Column = (typeof COLUMNS)[number]
export type ColumnWidths = Partial<Record<Column, number>>

export const MAX_WIDTH = 2000
export const DEFAULT_WIDTHS: Record<Exclude<Column, 'name'>, number> = { type: 88, size: 110, modified: 154, uploaded: 154 }
export const COLUMN_STEP = 11
export const COLUMN_STEP_BIG = 44

export function minWidth(column: Column): number {
  return column === 'name' ? 160 : 48
}

export function clampWidth(column: Column, width: number): number {
  return Math.min(MAX_WIDTH, Math.max(minWidth(column), Math.round(width)))
}

export function fitWidth(column: Column, contentWidths: number[]): number {
  return clampWidth(column, Math.ceil(Math.max(0, ...contentWidths)))
}

export function parseColumns(raw: string | null): ColumnWidths {
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (!value || typeof value !== 'object') return {}
    return Object.fromEntries(
      COLUMNS.flatMap((column) => {
        const width = (value as Record<string, unknown>)[column]
        return typeof width === 'number' && Number.isFinite(width) ? [[column, clampWidth(column, width)]] : []
      }),
    )
  } catch {
    return {}
  }
}

export function tableMinWidth(widths: ColumnWidths, visible: Column[], fixed: number): number {
  return visible.reduce((sum, column) => sum + (widths[column] ?? (column === 'name' ? minWidth('name') : DEFAULT_WIDTHS[column])), fixed)
}
