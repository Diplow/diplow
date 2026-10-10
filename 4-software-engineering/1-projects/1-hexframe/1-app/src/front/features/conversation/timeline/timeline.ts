// The Conversation as the timeline shows it on fixtures, at /dev/system: one continuous timeline per
// Account, split by day, holding the Messages and what the user did on the canvas. Pure; the
// components render it. The Account's own Conversation comes as Assistant's Entries
// (`domains/assistant/entities`, `useConversationDay`), which the chat on home will show in place of
// this model (hexframe-app-assistant/decisions.md#DEC-8).
import type { Operation } from '#/domains/mapping/operations'
import type { Navigated } from '#/front/features/facts'

/** A Tile as the fixtures' Conversation shows it: what a reader needs to recognise it. */
export interface TileSummary {
  id: string
  title: string
  preview: string
}

export type Entry =
  | { kind: 'message'; id: string; at: Date; author: 'user' | 'agent'; text: string }
  // What the user did to look at the System: the gesture as the navigation fact carries it, so one
  // vocabulary runs from the canvas to the timeline.
  | { kind: 'navigation'; id: string; at: Date; gesture: Navigated['gesture']; tile: TileSummary }
  | { kind: 'operation'; id: string; at: Date; operation: Operation['_tag']; tile: TileSummary }

/** One day of the Conversation, its entries oldest first. */
export interface Day {
  /** The day's local date, `2026-09-27`: unique in the timeline. */
  key: string
  /** The day's local midnight. */
  date: Date
  /** Set when the day is today or yesterday, which read better than a date. */
  relative?: 'today' | 'yesterday'
  entries: Entry[]
}

/** The entries split by the reader's local day, oldest day and oldest entry first. */
export function splitByDay(entries: readonly Entry[], now: Date): Day[] {
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const days: Day[] = []
  for (const entry of entries.toSorted((a, b) => a.at.getTime() - b.at.getTime())) {
    const key = dayKey(entry.at)
    const last = days.at(-1)
    if (last?.key === key) {
      last.entries.push(entry)
      continue
    }
    const date = new Date(entry.at.getFullYear(), entry.at.getMonth(), entry.at.getDate())
    const relative = key === today ? 'today' : key === yesterday ? 'yesterday' : undefined
    days.push({ key, date, ...(relative && { relative }), entries: [entry] })
  }
  return days
}

function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Splits a text into what a reader sees as characters, as Mapping counts a Tile's. */
const graphemes = new Intl.Segmenter()

/**
 * The start of a text too long to show whole, cut at a word and ended with an ellipsis, or
 * `undefined` when it fits within `limit` characters and there is nothing to hide. Characters are
 * graphemes, so an emoji, even one joined from several (👩‍👩‍👧), is never cut in half.
 */
export function excerpt(text: string, limit: number): string | undefined {
  const characters = Array.from(graphemes.segment(text), ({ segment }) => segment)
  if (characters.length <= limit) return undefined
  const cut = characters.slice(0, limit)
  const lastSpace = cut.findLastIndex((character) => /\s/.test(character))
  // A word longer than half the limit is cut through rather than dropped whole.
  const words = lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut
  return `${words.join('').replace(/[\s,;:.]+$/, '')}…`
}
