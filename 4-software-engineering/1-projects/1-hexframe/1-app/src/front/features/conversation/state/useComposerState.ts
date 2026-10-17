// The composer's state on home: what the field holds and where its caret stands, the links picked
// since the last Message, and whether the user left the list. From them, what the caret stands in
// lists, a `/` the commands offered, the language the languages, an `@` the Account's Tiles; what the
// field shows marked; what a pick puts in the field, or the language it goes to; and what the field
// submits, a command to run, words for the agent, or a language to go to, the field emptied for the
// next; a Tile named from outside, at the caret or first, a menu on the canvas asking the agent heard
// on the client bus; and where the next Turn works, the field's
// Message read as Assistant reads it, the canvas centered where the page says. The reading is `../composer/typing.ts` and, for what the field shows marked, ui's
// `fieldMarksOf`, both pure; this hook holds what they read.
import { type RefObject, useCallback, useReducer, useRef } from 'react'

import { m } from '#/paraglide/messages'
import { type Command, fieldMarksOf } from '#/front/ui/chat/composer/commands'
import { directionName } from '#/front/ui/canvas/tile/menu/verbs'

import { useFact } from '../../bus'
import { AskedAboutTile } from '../../facts'

import type { Edited, Inserted, Mentionable } from '../composer/mention'
import {
  type Field,
  type FieldPick,
  namedIn,
  type NameAt,
  pickOf,
  type Submitted,
  submittedOf,
  typingAt,
  workingInOf,
} from '../composer/typing'

interface State extends Field {
  /** The list left, by Escape or the field's blur, until the field changes or the caret moves. */
  readonly left: boolean
}

type Event =
  | { readonly type: 'changed'; readonly value: string; readonly caret: number }
  | { readonly type: 'left' }
  | {
      readonly type: 'picked'
      readonly value: string
      readonly caret: number
      readonly link?: Inserted
    }
  | { readonly type: 'sent' }

const initial: State = { value: '', caret: 0, links: [], left: false }

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'changed':
      return { ...state, value: event.value, caret: event.caret, left: false }
    case 'left':
      return { ...state, left: true }
    case 'picked': {
      const { link } = event
      // A Tile named again where the field already shows it keeps its one link.
      const kept =
        link === undefined ||
        state.links.some(({ id, shown }) => id === link.id && shown === link.shown)
      return {
        value: event.value,
        caret: event.caret,
        links: kept ? state.links : [...state.links, link],
        left: false,
      }
    }
    case 'sent':
      return initial
  }
}

/** The field's next value set on its element, its caret after what was put in it. */
export function writeInto(element: HTMLTextAreaElement, { value, caret }: Edited) {
  // Set on the element first, so React finds it as it is and leaves the caret be.
  element.value = value
  element.setSelectionRange(caret, caret)
}

/**
 * The field's reducer, and the field as the last event left it, which the bus's reaction reads
 * whenever a fact comes, so it stays the same reaction and subscribes once per set of Tiles. Every
 * event goes through `send`, the only way in, so the two never part.
 */
function useField() {
  const [state, dispatch] = useReducer(reducer, initial)
  const latest = useRef(initial)
  const send = useCallback((event: Event) => {
    latest.current = reducer(latest.current, event)
    dispatch(event)
  }, [])
  return { state, latest, send }
}

/** What the composer's state hook is told besides its Tiles and commands. */
interface ComposerInput {
  /** The Tile centered on the canvas, by its id; none while the page can't say. */
  center?: string | undefined
  /** The field, which a Tile named from outside is written into, the focus then in it. */
  field?: RefObject<HTMLTextAreaElement | null> | undefined
}

/**
 * The composer over the Account's Tiles, offering `among`, the commands the page runs now, the canvas
 * centered on `center`. A menu on the canvas asking the agent (`AskedAboutTile`, on the client bus)
 * names its Tile first in the field, a free slot's place after it.
 */
export function useComposerState(
  tiles: ReadonlyArray<Mentionable>,
  among: ReadonlyArray<Command>,
  { center, field }: ComposerInput = {},
) {
  const { state, latest, send } = useField()
  /** A Tile named from outside, written into the field, its caret just after it, the focus there. */
  const name = useCallback(
    (tile: string, where: NameAt): (Edited & { readonly link: Inserted }) | undefined => {
      const found = tiles.find(({ id }) => id === tile)
      if (found === undefined) return undefined
      const named = namedIn(latest.current, found, where)
      send({ type: 'picked', ...named })
      const element = field?.current
      if (element != null) {
        writeInto(element, named)
        element.focus()
      }
      return named
    },
    [tiles, field, send],
  )
  const asked = useCallback(
    ({ tile, place }: AskedAboutTile) => {
      name(tile, {
        first: true,
        then:
          place === undefined ? '' : m.crossing_ask_for_one({ direction: directionName(place) }),
      })
    },
    [name],
  )
  useFact(AskedAboutTile, asked)
  const typing = state.left ? undefined : typingAt(state, tiles, among)
  return {
    state: {
      value: state.value,
      typing,
      marks: fieldMarksOf(state.value, state.links, among),
      /** Where the next Turn works, the Tile the Message opens with, `first`, else the centered one. */
      workingIn: center === undefined ? undefined : workingInOf(state, { center, tiles, among }),
    },
    actions: {
      /** The field changed, or its caret moved. */
      change: (value: string, caret: number) => {
        send({ type: 'changed', value, caret })
      },
      /** The list left, until the field changes. */
      leave: () => {
        send({ type: 'left' })
      },
      /**
       * A row taken, by its id: the field's next value and where its caret goes, for the composer to
       * set, or the language to go to. None while nothing is listed.
       */
      pick: (row: string): FieldPick | undefined => {
        if (typing === undefined) return undefined
        const picked = pickOf(state, typing, row, tiles)
        if (!('language' in picked)) send({ type: 'picked', ...picked })
        return picked
      },
      /**
       * A Tile named from outside, by its id, at the caret as a drop names it or first: written into
       * the field, the focus there, and answered; none for a Tile the page can't name.
       */
      name,
      /**
       * What the field submits, a command or a Message, the field then emptied for the next; none,
       * the field kept, when it names a language hexframe is not in.
       */
      submit: (): Submitted | undefined => {
        const submitted = submittedOf(state, among)
        if (submitted !== undefined) send({ type: 'sent' })
        return submitted
      },
    },
  }
}
