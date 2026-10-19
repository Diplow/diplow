// Acting on a tile where it is (HEX-105's proposal, from components.html's #menu): its menu, by a
// right click, a long press, ⇧F10 or the menu key, and its hover card, after a moment under the
// pointer or at once on keyboard focus. The menu names what it acts on, then offers what its kind and
// its place allow (`groupsOf`), each line with its key, which runs it on the focused tile too; where
// the action is a place, adding a tile or moving this one, its submenu is the frame itself
// (`Picker`). A free slot has a menu and no card. What each line does is the caller's (`onAct`), and
// so is what the tile pointed at lights elsewhere while its card or its menu is open (`onPoint`).
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
  Share2,
  Sparkles,
  Split,
  Trash2,
  Unlink,
  Users,
  UserPlus,
  UsersRound,
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
import type { Hand } from '../../keys'
import { HoverCard, useOpenTold } from '../../../layouts/HoverCard'
import { partOf } from '../moving/move'
import { Picker, type PickerFrame } from './Picker'
import {
  actsAtOnce,
  directionName,
  groupsOf,
  placeOf,
  type TileAct,
  type Subject,
  type Verb,
} from './verbs'

interface TileMenuProps {
  subject: Subject
  /** What its hover card says beyond its title and place: its preview in full, and its notes. */
  card?: Pick<ComponentProps<typeof HoverCard>, 'description' | 'notes'>
  /**
   * The frames its place submenus draw: the one it holds, where a tile is added, and the one it
   * stands in, where it moves. A line whose frame is missing is left out.
   */
  frames?: { holds?: PickerFrame; standsIn?: PickerFrame }
  /** What a chosen line does: its act, and the words its line said, for a toast or a timeline. */
  onAct: OnAct
  /**
   * The lines its caller can't run yet, left out: the agent's, on a page whose chat isn't wired to
   * the menu; an import, where the subject takes none.
   */
  without?: readonly Verb[]
  /** Told when it opens and closes: the canvas steps the other tiles back while it is open. */
  onOpenChange?: (open: boolean) => void
  /**
   * Told when the tile is pointed at and let go: while its card or its menu is open, by a pointer,
   * the keyboard's focus or a finger's long press, which a crossing lights elsewhere (HEX-122).
   */
  onPoint?: ((pointing: boolean) => void) | undefined
  /**
   * Not there yet, the untitled root's lamp: no card and no menu. It stays in its menu meanwhile, so
   * the tile is the same once it wakes, its light rising rather than drawn anew.
   */
  asleep?: boolean
  /**
   * Its hover card alone, where its caller lets no line through, the tutorial's six (HEX-121): no
   * menu opens, nor does a line's key run; under a finger, which opens no card, the long press opens
   * the menu's header alone, its title and its preview, what the card would have said.
   */
  cardAlone?: boolean
  /** The tile, or the free slot, handed what its menu and its card need of it. */
  children: (hand: Hand) => ReactElement
}

export function TileMenu({
  subject,
  card,
  frames = {},
  onAct,
  without = [],
  onOpenChange,
  onPoint,
  asleep = false,
  cardAlone = false,
  children,
}: TileMenuProps) {
  const title = subject.kind === 'slot' ? m.tile_menu_free_slot() : subject.title
  const place = placeOf(subject)
  const pass = <Pass>{children}</Pass>
  const [menuOpen, setMenuOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  useOpenTold(menuOpen || cardOpen, onPoint)
  const finger = useFinger()
  return (
    <Menu
      opensOn="context"
      disabled={asleep || (cardAlone && !finger)}
      label={m.tile_menu_label({ title })}
      header={{ title, detail: place, description: card?.description }}
      entries={cardAlone ? [] : entriesOf(subject, frames, onAct, without)}
      onOpenChange={(open) => {
        setMenuOpen(open)
        onOpenChange?.(open)
      }}
      trigger={
        subject.kind === 'slot' ? (
          pass
        ) : (
          <HoverCard
            place={place}
            title={title}
            within="svg"
            shut={menuOpen || asleep}
            onOpenChange={setCardOpen}
            {...card}
          >
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
  /** It names the tile in the composer, whose field takes the focus. */
  takesFocus?: boolean
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
    // No key of its own: C is the canvas's, cycling the center's views (`useCycleKey`).
    case 'show-context':
      return { icon: <Hexagon />, label: m.tile_menu_show_context }
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
        takesFocus: true,
      }
    case 'copy':
      return { icon: <Copy />, label: m.tile_menu_copy }
    case 'share':
      // Its widget opens in the chat.
      return { icon: <Share2 />, shortcut: { key: 's' }, label: m.tile_menu_share }
    case 'export':
      return { icon: <Download />, shortcut: { key: 'e', shift: true }, label: m.tile_menu_export }
    case 'members':
      // An Organization's star: its Members widget opens in the chat.
      return { icon: <Users />, label: m.tile_menu_members }
    case 'groups':
      // An Organization's star: its Groups widget opens in the chat (HEX-137).
      return { icon: <UsersRound />, label: m.tile_menu_groups }
    case 'join':
      // An Organization's star, for someone outside it: asks its admins (HEX-138).
      return { icon: <UserPlus />, label: m.tile_menu_join }
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
      // Its widget opens in the chat, its title taking the focus.
      return {
        icon: <Plus />,
        shortcut: { key: 'n' },
        label: m.tile_menu_new_tile,
        takesFocus: true,
      }
    case 'import':
      return { icon: <FolderInput />, shortcut: { key: 'i' }, label: m.tile_menu_import }
  }
}

/** What the menu hands its caller once a line is chosen: the act, and the words its line said. */
type OnAct = (act: TileAct, said: string) => void

/** A line that hands its act to the caller, with its own words. */
const acting = (onAct: OnAct, act: TileAct, label: string) => () => {
  onAct(act, label)
}

/** The subject's lines, its groups apart, each running its verb, the place submenus on their frame. */
function entriesOf(
  subject: Subject,
  frames: NonNullable<TileMenuProps['frames']>,
  onAct: OnAct,
  without: readonly Verb[] = [],
): MenuEntry[] {
  return groupsOf(subject)
    .map((group) =>
      group.flatMap((verb): MenuEntry[] => {
        if (without.includes(verb)) return []
        const { label: words, ...line } = lineOf(verb, subject)
        const label = words()
        if (actsAtOnce(verb)) return [{ label, ...line, onSelect: acting(onAct, { verb }, label) }]
        const submenu = submenuOf(verb, subject, frames, onAct)
        const { icon, shortcut } = line
        return submenu === undefined ? [] : [{ label, icon, shortcut, submenu }]
      }),
    )
    .filter((group) => group.length > 0)
    .flatMap((group, index) => (index === 0 ? group : ['separator' as const, ...group]))
}

type Submenu = Extract<MenuEntry, { submenu: unknown }>['submenu']

/** A choice in a frame: its words, and the act it hands the caller with them. */
const choice = (onAct: OnAct, act: TileAct, label: string) => ({
  label,
  onSelect: acting(onAct, act, label),
})

/** A verb's submenu, or none where its frame is missing, and its line is left out. */
function submenuOf(
  verb: 'add' | 'move' | 'copy',
  subject: Subject,
  { holds, standsIn }: NonNullable<TileMenuProps['frames']>,
  onAct: OnAct,
): Submenu | undefined {
  switch (verb) {
    case 'add':
      if (holds === undefined) return undefined
      return {
        label: m.tile_menu_add_where(),
        picture: (
          <Picker
            frame={holds}
            choose={(at) =>
              holds.seats[at] === undefined
                ? {
                    // The new tile's widget opens in the chat, its title taking the focus.
                    ...choice(
                      onAct,
                      { verb: 'add', at },
                      m.tile_menu_add_at({ direction: directionName(at), hub: holds.hub }),
                    ),
                    takesFocus: true,
                  }
                : undefined
            }
          />
        ),
      }
    case 'move': {
      if (standsIn === undefined || subject.at === 'center') return undefined
      const from = subject.at
      const elsewhere = m.tile_menu_move_elsewhere()
      return {
        label: m.tile_menu_move_where(),
        picture: (
          <Picker
            frame={standsIn}
            self={from}
            // The frame offers what the canvas does while the tile moves (`partOf`).
            choose={(at) => {
              switch (partOf(standsIn, from, at)) {
                case 'landing':
                  return choice(
                    onAct,
                    { verb: 'move', at },
                    m.tile_menu_move_to({ direction: directionName(at) }),
                  )
                case 'swap':
                  return choice(
                    onAct,
                    { verb: 'swap', at },
                    m.tile_menu_swap_with({ title: standsIn.seats[at]?.title ?? '' }),
                  )
                default:
                  return undefined
              }
            }}
          />
        ),
        entries: [
          {
            label: elsewhere,
            icon: <Search />,
            onSelect: acting(onAct, { verb: 'move-elsewhere' }, elsewhere),
          },
        ],
      }
    }
    case 'copy': {
      const copies = [
        { verb: 'copy-link', icon: <Link />, label: m.tile_menu_copy_link() },
        { verb: 'copy-title', icon: <Copy />, label: m.tile_menu_copy_title() },
        { verb: 'copy-mention', icon: <AtSign />, label: m.tile_menu_copy_mention() },
      ] as const
      return {
        label: m.tile_menu_copy(),
        entries: copies.map(({ verb: copy, icon, label }) => ({
          label,
          icon,
          onSelect: acting(onAct, { verb: copy }, label),
        })),
      }
    }
  }
}
