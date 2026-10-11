// Acting on a tile where it is (HEX-105's proposal, from components.html's #menu): its menu, by a
// right click, a long press, ⇧F10 or the menu key, and its hover card, after a moment under the
// pointer or at once on keyboard focus. The menu names what it acts on, then offers what its kind and
// its place allow (`groupsOf`), each line with its key, which runs it on the focused tile too; where
// the action is a place, adding a tile or moving this one, its submenu is the frame itself
// (`Picker`). A free slot has a menu and no card. What each line does is the caller's (`onAct`).
import {
  ArrowUpRight,
  AtSign,
  Copy,
  Download,
  Eye,
  FileText,
  FolderInput,
  Hexagon,
  Link,
  LogIn,
  Move,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Split,
  Trash2,
  Unlink,
} from 'lucide-react'
import {
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react'

import { m } from '#/paraglide/messages'

import { Menu, MenuDrawn, type MenuEntry } from '../../../atoms/Menu'
import type { Shortcut } from '../../../atoms/keys'
import type { Direction } from '../../geometry/geometry'
import type { Hand } from '../../keys'
import { HoverCard } from '../../layouts/HoverCard'
import { Picker, type PickerFrame } from './Picker'
import {
  actsAtOnce,
  directionName,
  groupsOf,
  placeOf,
  type Act,
  type Subject,
  type Verb,
} from './verbs'

interface TileMenuProps {
  subject: Subject
  /** What its hover card says beyond its title and place: its preview in full, and a note. */
  card?: Pick<ComponentProps<typeof HoverCard>, 'description' | 'note'>
  /**
   * The frames its place submenus draw: the one it holds, where a tile is added, and the one it
   * stands in, where it moves. A line whose frame is missing is left out.
   */
  frames?: { holds?: PickerFrame; standsIn?: PickerFrame }
  onAct: (act: Act) => void
  /** The tile, or the free slot, handed what its menu and its card need of it. */
  children: (hand: Hand) => ReactElement
}

export function TileMenu({ subject, card, frames = {}, onAct, children }: TileMenuProps) {
  const title = subject.kind === 'slot' ? m.tile_menu_free_slot() : subject.title
  const place = placeOf(subject)
  const pass = <Pass>{children}</Pass>
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <Menu
      opensOn="context"
      label={m.tile_menu_label({ title })}
      header={{ title, detail: place, description: card?.description }}
      entries={entriesOf(subject, frames, onAct)}
      onOpenChange={setMenuOpen}
      trigger={
        subject.kind === 'slot' ? (
          pass
        ) : (
          <HoverCard place={place} title={title} within="svg" shut={menuOpen} {...card}>
            {pass}
          </HoverCard>
        )
      }
    />
  )
}

/** The menu a subject opens, held open where it is drawn, for /design-system: nothing to choose. */
export function TileMenuDrawn({ subject, frames = {} }: Pick<TileMenuProps, 'subject' | 'frames'>) {
  const title = subject.kind === 'slot' ? m.tile_menu_free_slot() : subject.title
  return (
    <MenuDrawn
      label={m.tile_menu_label({ title })}
      header={{ title, detail: placeOf(subject) }}
      entries={entriesOf(subject, frames, () => undefined)}
    />
  )
}

/** A verb's words in a subject's menu. */
export const verbName = (verb: Verb, subject: Subject) => lineOf(verb, subject).label()

const coarse = '(pointer: coarse)'

/**
 * Whether the hand is a finger, as `pointer-coarse:` reads it, kept as it changes: a click under it is
 * a tap (`clickOf`).
 */
export function useFinger(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = matchMedia(coarse)
      query.addEventListener('change', changed)
      return () => {
        query.removeEventListener('change', changed)
      }
    },
    () => matchMedia(coarse).matches,
    () => false,
  )
}

/** Hands its child the props its triggers merged onto it, which a component takes as one prop. */
function Pass({
  children,
  ...hand
}: Omit<Hand, 'children'> & { children: (hand: Hand) => ReactElement }) {
  return children(hand)
}

interface Line {
  icon: ReactNode
  shortcut?: Shortcut
  label: () => string
  tone?: 'agent' | 'destructive'
}

const enter: Shortcut = { key: 'Enter' }

/** Each verb's line, read at render in the page's language, for a subject: its icon, words and key. */
function lineOf(verb: Verb, subject: Subject): Line {
  const tile = subject.kind === 'slot' ? undefined : subject
  switch (verb) {
    case 'back-out':
      return {
        icon: <ArrowUpRight />,
        shortcut: { key: 'Escape' },
        label: () => m.tile_menu_back_out({ parent: tile?.parent ?? '' }),
      }
    case 'open':
      return {
        icon: <Eye />,
        shortcut: enter,
        label: tile?.kind === 'branch' ? m.tile_menu_open_here : m.tile_menu_open,
      }
    case 'go-in':
      return { icon: <LogIn />, shortcut: { key: 'Enter', shift: true }, label: m.tile_menu_go_in }
    case 'show-context':
      return { icon: <Hexagon />, shortcut: { key: 'c' }, label: m.tile_menu_show_context }
    case 'edit':
      return {
        icon: <Pencil />,
        shortcut: { key: 'e' },
        label: tile?.kind === 'untitled' ? m.tile_menu_name_it : m.tile_menu_edit,
      }
    case 'make-leaf':
      return { icon: <FileText />, shortcut: { key: 'l' }, label: m.tile_menu_make_leaf }
    case 'make-branch':
      return { icon: <Split />, shortcut: { key: 'l' }, label: m.tile_menu_make_branch }
    case 'add':
      return { icon: <Plus />, shortcut: { key: 'n' }, label: m.tile_menu_add }
    case 'move':
      return { icon: <Move />, shortcut: { key: 'm' }, label: m.tile_menu_move }
    case 'ask-agent':
      return {
        icon: <Sparkles />,
        shortcut: { key: 'a' },
        label: tile === undefined ? m.tile_menu_ask_for_one : m.tile_menu_ask_about,
        tone: 'agent',
      }
    case 'copy':
      return { icon: <Copy />, label: m.tile_menu_copy }
    case 'export':
      return { icon: <Download />, shortcut: { key: 'e', shift: true }, label: m.tile_menu_export }
    case 'delete': {
      const below = tile?.below ?? 0
      return {
        icon: <Trash2 />,
        shortcut: { key: 'Backspace' },
        label: () => (below > 0 ? m.tile_menu_delete_with({ count: below }) : m.tile_menu_delete()),
        tone: 'destructive',
      }
    }
    case 'remove-reference':
      return {
        icon: <Unlink />,
        shortcut: { key: 'Backspace' },
        label: m.tile_menu_remove_reference,
        tone: 'destructive',
      }
    case 'new-tile':
      return { icon: <Plus />, shortcut: { key: 'n' }, label: m.tile_menu_new_tile }
    case 'import':
      return { icon: <FolderInput />, shortcut: { key: 'i' }, label: m.tile_menu_import }
  }
}

/** The subject's lines, its groups apart, each running its verb, the place submenus on their frame. */
function entriesOf(
  subject: Subject,
  frames: NonNullable<TileMenuProps['frames']>,
  onAct: (act: Act) => void,
): MenuEntry[] {
  return groupsOf(subject)
    .map((group) =>
      group.flatMap((verb): MenuEntry[] => {
        const line = lineOf(verb, subject)
        const { icon, shortcut, tone } = line
        const label = line.label()
        if (actsAtOnce(verb)) {
          return [
            {
              label,
              icon,
              shortcut,
              tone,
              onSelect: () => {
                onAct({ verb })
              },
            },
          ]
        }
        const submenu = submenuOf(verb, subject, frames, onAct)
        return submenu === undefined ? [] : [{ label, icon, shortcut, submenu }]
      }),
    )
    .filter((group) => group.length > 0)
    .flatMap((group, index) => (index === 0 ? group : ['separator' as const, ...group]))
}

type Submenu = Extract<MenuEntry, { submenu: unknown }>['submenu']

/** A verb's submenu, or none where its frame is missing, and its line is left out. */
function submenuOf(
  verb: 'add' | 'move' | 'copy',
  subject: Subject,
  { holds, standsIn }: NonNullable<TileMenuProps['frames']>,
  onAct: (act: Act) => void,
): Submenu | undefined {
  const at = (act: 'add' | 'move' | 'swap', direction: Direction) => () => {
    onAct({ verb: act, at: direction })
  }
  switch (verb) {
    case 'add':
      if (holds === undefined) return undefined
      return {
        label: m.tile_menu_add_where(),
        picture: (
          <Picker
            frame={holds}
            free={(direction) => ({
              label: m.tile_menu_add_at({ direction: directionName(direction), hub: holds.hub }),
              onSelect: at('add', direction),
            })}
          />
        ),
      }
    case 'move':
      if (standsIn === undefined || subject.at === 'center') return undefined
      return {
        label: m.tile_menu_move_where(),
        picture: (
          <Picker
            frame={standsIn}
            self={subject.at}
            free={(direction) => ({
              label: m.tile_menu_move_to({ direction: directionName(direction) }),
              onSelect: at('move', direction),
            })}
            taken={(direction) => {
              const held = standsIn.members[direction]
              return held?.swaps === true
                ? {
                    label: m.tile_menu_swap_with({ title: held.title }),
                    onSelect: at('swap', direction),
                  }
                : undefined
            }}
          />
        ),
        entries: [
          {
            label: m.tile_menu_move_elsewhere(),
            icon: <Search />,
            onSelect: () => {
              onAct({ verb: 'move-elsewhere' })
            },
          },
        ],
      }
    case 'copy':
      return {
        label: m.tile_menu_copy(),
        entries: [
          {
            label: m.tile_menu_copy_link(),
            icon: <Link />,
            onSelect: () => {
              onAct({ verb: 'copy-link' })
            },
          },
          {
            label: m.tile_menu_copy_title(),
            icon: <Copy />,
            onSelect: () => {
              onAct({ verb: 'copy-title' })
            },
          },
          {
            label: m.tile_menu_copy_mention(),
            icon: <AtSign />,
            onSelect: () => {
              onAct({ verb: 'copy-mention' })
            },
          },
        ],
      }
  }
}
