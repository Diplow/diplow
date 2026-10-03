// The rows the pane's lines take under the drawing in the terminal, so the drawing leaves them room:
// a Raster too tall pushes the controls out of sight.
import { columnsOf } from './draw/raster.js'

/** The blank rows the pane's column puts between two of its elements. */
export const rowGap = 1

/** The columns the pane's row of controls puts between two of them. */
export const controlGap = 2

/**
 * A control as a plain Button draws it in the terminal: `hotkey: label`, or the label alone, as
 * `ButtonProps.plain` documents it. The pane's test pins that its controls are plain.
 */
export interface Control {
  hotkey?: string
  label: string
}

/** What sits under the drawing, top to bottom. */
export interface Footer {
  /** The red line, which wraps. */
  problem?: string
  /** Whether the clashes' line shows; it is cut to one row. */
  hasClashes: boolean
  /** The controls, in a row that wraps. */
  controls: readonly Control[]
}

/**
 * The rows the footer takes in `columns`: each of its lines, the problem, the clashes, the
 * controls and the path, with the gap the column puts above it.
 */
export function footerRows(columns: number, { problem, hasClashes, controls }: Footer): number {
  const widths = controls.map(({ hotkey, label }) =>
    columnsOf(hotkey ? `${hotkey}: ${label}` : label),
  )
  const lines = [
    ...(problem ? [rowsOf(problem, columns)] : []),
    ...(hasClashes ? [1] : []),
    rowsOfRow(widths, columns),
    1,
  ]
  return lines.reduce((rows, line) => rows + rowGap + line, 0)
}

/**
 * The rows `text` takes when it wraps in `columns`: at spaces, and a word wider than a row broken
 * across rows.
 */
export function rowsOf(text: string, columns: number): number {
  const width = Math.max(1, columns)
  let rows = 1
  let used = 0
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const size = columnsOf(word)
    if (used > 0 && used + 1 + size <= width) {
      used += 1 + size
      continue
    }
    if (used > 0) rows++
    rows += Math.ceil(size / width) - 1
    used = size % width || width
  }
  return rows
}

/** The rows a row of controls `widths` wide takes when it wraps in `columns`. */
export function rowsOfRow(widths: readonly number[], columns: number): number {
  let rows = 1
  let used = 0
  for (const width of widths) {
    if (used > 0 && used + controlGap + width > columns) {
      rows++
      used = 0
    }
    used += (used > 0 ? controlGap : 0) + width
  }
  return rows
}
