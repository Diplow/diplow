// What an Entry says, as the chat's pieces take it (`Words`, `Happened`, ui's `chat/`): a Message's
// text with its links woven in as the Tiles they name; a change, an import, a navigation and a Turn's
// end as a line by who acted, the user, the agent, a Key, or hexframe itself; a Tile shared with the
// user as a line by whoever shared it, from outside, its Tile visited on a click; the user's place in
// an Organization changed by one of its admins, a line from outside, its star visited on a click, and
// someone asking to join one the user is an admin of, which they accept or decline (HEX-138); and a
// Proposal's changes.
// A Tile named shows as the Title it had, centering the canvas while the System still holds it, the
// agent's draft while a Proposal only proposes it, struck through once deleted. And the Entries cut
// into what the timeline draws: a run of lines on one thread, a Message, a Proposal, what a Turn
// applied. Pure; `./Entry.tsx` draws it.
import { Schema } from 'effect'

import {
  type Actor,
  type BadEnd,
  type Entry,
  type JoinAsked,
  type Membership,
  isTheirs,
  partsOf,
  type ProposedChange,
  type Someone,
  type TheirChange,
} from '#/domains/assistant/entities'
import type { OperationEvent } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import { Gesture } from '#/front/ui/canvas/view/view'
import type { Happened } from '#/front/ui/chat/entries/Events'
import { rightsSaid } from '#/front/ui/chat/widgets/sharing/share/rights'
import type { Change } from '#/front/ui/chat/entries/Receipt'
import type { MentionProps } from '#/front/ui/chat/text/Mention'
import { type Word, type Words, weave } from '#/front/ui/chat/text/words'

import type { Titles } from '../timeline/timeline'
import { isVerb, named, verbIcons } from './parts'

/** What a Tile named in the timeline needs to show as it stands now. */
export interface Naming {
  /** The Titles of the Tiles the day names by id alone, its navigations' and its links', now. */
  readonly titles: Titles
  /** The System's Tiles now, by id, with their Titles; none before it is read. */
  readonly system?: ReadonlyMap<string, string> | undefined
  /** Centers the canvas on a Tile; none where there is no canvas. */
  readonly onCenter?: ((tile: string) => void) | undefined
  /**
   * What a Tile named says in its card, as the canvas's card says it, by its id; none where the page
   * knows nothing more of it. A Tile with a card is pointed at while its card is open.
   */
  readonly card?: ((tile: string) => MentionProps['card']) | undefined
  /** A Tile named pointed at, its card open, or no longer: the canvas lights it meanwhile (HEX-109). */
  readonly onPoint?: ((tile: string, pointing: boolean) => void) | undefined
}

/** What a Tile named shows beside its title and tells while it is pointed at, where it has a card. */
function pointing(tile: string, { card, onPoint }: Naming): Pick<MentionProps, 'card' | 'onPoint'> {
  const shown = card?.(tile)
  if (shown === undefined) return {}
  return {
    card: shown,
    ...(onPoint && {
      onPoint: (on: boolean) => {
        onPoint(tile, on)
      },
    }),
  }
}

/** What a click on a Tile named does: centers the canvas on it, where there is one. */
const centering = (tile: string, onCenter: Naming['onCenter']) =>
  onCenter === undefined
    ? undefined
    : () => {
        onCenter(tile)
      }

/** A Tile named by its id alone, as the System holds it now: centered on a click, or deleted since. */
const linked = (tile: string, title: string | undefined, naming: Naming): Word =>
  title === undefined
    ? { tile: { title: m.conversation_link_broken(), standing: 'gone' } }
    : {
        tile: {
          title: named(title),
          onCenter: centering(tile, naming.onCenter),
          ...pointing(tile, naming),
        },
      }

/**
 * A Tile a change names, by the Title it had: there, it centers the canvas; drafted by a Proposal not
 * accepted, the agent's draft; deleted since, struck through. Before the System is read, plain.
 */
function recorded(
  { id, title }: { id: string; title: string },
  naming: Naming,
  drafted = false,
): Word {
  const { system, onCenter } = naming
  const shown = named(title)
  if (system === undefined) return { tile: { title: shown } }
  if (system.has(id)) {
    return { tile: { title: shown, onCenter: centering(id, onCenter), ...pointing(id, naming) } }
  }
  // The agent's draft: pointed at, it lights the ghost the canvas stands for it.
  if (drafted) return { tile: { title: shown, standing: 'draft', ...pointing(id, naming) } }
  return { tile: { title: shown, standing: 'gone' } }
}

/**
 * A Tile a change the user made in someone else's System names, by the Title it had: it stands
 * there, not in the user's, so a click visits it by its link, as a Tile shared is, and it is never
 * struck through by what the user's own System holds.
 */
const elsewhereOf = ({ id, title }: { id: string; title: string }, naming: Naming): Word => ({
  tile: { title: named(title), onCenter: centering(id, naming.onCenter) },
})

/** A Message's text, each link woven in as the Tile it names now. */
export const messageWords = (text: string, naming: Naming): Words =>
  partsOf(text).map((part) =>
    part._tag === 'Text' ? part.text : linked(part.tile, naming.titles[part.tile], naming),
  )

/** Who acted, as a line's mark says it: the user, the agent, or a Key or someone else from outside. */
const whoOf = (actor: Actor): Happened['who'] =>
  actor._tag === 'You' ? 'human' : actor._tag === 'Assistant' ? 'agent' : 'outside'

/** The Key that acted, named, or a revoked one, which has no name left. */
const keyOf = (actor: Extract<Actor, { _tag: 'Key' }>): Word =>
  actor.name === undefined
    ? m.conversation_revoked_key()
    : { name: m.conversation_key({ name: actor.name }) }

/**
 * Someone else who wrote in the user's System, by the Title their star had then, "Someone" for one
 * not named yet, and who of theirs acted: themselves, their agent, or one of their Keys, by no name.
 */
function someoneOf({ star, by }: Someone): Word {
  const name = star === '' ? m.conversation_someone() : star
  switch (by._tag) {
    case 'You':
      return { name }
    case 'Assistant':
      return { name: m.conversation_someones_agent({ name }) }
    case 'Key':
      return { name: m.conversation_someones_key({ name }) }
  }
}

/** Who starts a sentence said by someone from outside: a Key of the user's, or someone else. */
const outsiderOf = (actor: Extract<Actor, { _tag: 'Key' | 'Someone' }>): Word =>
  actor._tag === 'Key' ? keyOf(actor) : someoneOf(actor)

/** A sentence about Tiles, said by the user, by the agent, or by a Key, who then starts it. */
interface Said<Names extends string> {
  readonly mine: (inputs: Record<Names, string>) => string
  readonly agents: (inputs: Record<Names, string>) => string
  readonly theirs: (inputs: Record<Names | 'actor', string>) => string
}

/** The sentence `said` says, by `actor`, its Tiles woven in. */
function by<Names extends string>(
  said: Said<Names>,
  actor: Actor,
  pieces: Record<Names, Word>,
): Words {
  if (actor._tag === 'You') return weave(said.mine, pieces)
  if (actor._tag === 'Assistant') return weave(said.agents, pieces)
  return weave(said.theirs, { ...pieces, actor: outsiderOf(actor) })
}

type Two = 'title' | 'other'

/** What each of Mapping's changes says once it happened, in the past tense, by whom. */
const changes: Record<OperationEvent['_tag'], Said<Two>> = {
  TileCreated: {
    mine: m.conversation_created,
    agents: m.conversation_created_agent,
    theirs: m.conversation_created_by,
  },
  TileEdited: {
    mine: m.conversation_edited,
    agents: m.conversation_edited_agent,
    theirs: m.conversation_edited_by,
  },
  TileMoved: {
    mine: m.conversation_moved,
    agents: m.conversation_moved_agent,
    theirs: m.conversation_moved_by,
  },
  TilesSwapped: {
    mine: m.conversation_swapped,
    agents: m.conversation_swapped_agent,
    theirs: m.conversation_swapped_by,
  },
  TileDeleted: {
    mine: m.conversation_deleted,
    agents: m.conversation_deleted_agent,
    theirs: m.conversation_deleted_by,
  },
  ReferenceCreated: {
    mine: m.conversation_referenced,
    agents: m.conversation_referenced_agent,
    theirs: m.conversation_referenced_by,
  },
  ReferenceDeleted: {
    mine: m.conversation_unreferenced,
    agents: m.conversation_unreferenced_agent,
    theirs: m.conversation_unreferenced_by,
  },
}

/** A change whose verb this page does not know yet, which Mapping may have learned since. */
const changed: Said<Two> = {
  mine: m.conversation_changed,
  agents: m.conversation_changed_agent,
  theirs: m.conversation_changed_by,
}

/** What an import says: the Tile it landed as, and how many came with it below it. */
const imports = {
  none: {
    mine: m.conversation_imported,
    agents: m.conversation_imported_agent,
    theirs: m.conversation_imported_by,
  },
  one: {
    mine: m.conversation_imported_one,
    agents: m.conversation_imported_one_agent,
    theirs: m.conversation_imported_one_by,
  },
} satisfies Record<string, Said<'title'>>

/** What each of the canvas's gestures says once the user made it, in the past tense. */
const navigations: Record<Gesture, (inputs: Record<'title', string>) => string> = {
  center: m.conversation_centered,
  expand: m.conversation_expanded,
  collapse: m.conversation_collapsed,
  'show-context': m.conversation_context_shown,
  'hide-context': m.conversation_context_hidden,
  'show-leaves': m.conversation_leaves_shown,
  'hide-leaves': m.conversation_leaves_hidden,
  'show-children-around': m.conversation_children_around,
  'show-branches-around': m.conversation_branches_around,
  'show-leaves-around': m.conversation_leaves_around,
}

const isGesture = Schema.is(Gesture)

/** How a Turn ended, when not by its answer: who it was, and what the line says. */
const turnEnds: Record<BadEnd, Pick<Happened, 'who' | 'state'> & { text: () => string }> = {
  stopped: { who: 'human', text: m.conversation_turn_stopped },
  ceiling: { who: 'app', text: m.conversation_turn_ceiling },
  allowance: { who: 'app', text: m.conversation_turn_allowance },
  time: { who: 'app', text: m.conversation_turn_time },
  sandbox: { who: 'app', text: m.conversation_turn_sandbox, state: 'failed' },
}

/** An Entry the timeline tells in a line. */
export type Told = Extract<
  Entry,
  { _tag: 'Change' | 'Import' | 'Navigation' | 'TurnEnded' | 'Shared' | 'Membership' }
>

/** The line an Entry is told in, on the thread of what happened. */
export function happenedOf(entry: Told, naming: Naming): Happened {
  const at = entry.at
  switch (entry._tag) {
    case 'Change':
      return { who: whoOf(entry.actor), words: changeWords(entry, naming), at }
    case 'Import':
      return { who: whoOf(entry.actor), words: importWords(entry, naming), at }
    case 'Navigation':
      return navigationOf(entry, naming)
    case 'TurnEnded': {
      const { text, ...end } = turnEnds[entry.how]
      return { ...end, words: [text()], at }
    }
    case 'Shared':
      return sharedOf(entry, naming)
    case 'Membership':
      return { who: 'outside', words: membershipWords(entry, naming), at }
  }
}

type Joined = 'who' | 'organization' | 'group'

/**
 * What one of an Organization's admins did to the user's place there, by its Members or one of its
 * Groups.
 */
const memberships: Record<
  Membership['what'],
  Record<'members' | 'group', (inputs: Record<Joined, string>) => string>
> = {
  added: { members: m.conversation_member_added, group: m.conversation_member_added_group },
  removed: { members: m.conversation_member_removed, group: m.conversation_member_removed_group },
  accepted: { members: m.conversation_join_accepted, group: m.conversation_join_accepted_group },
  declined: { members: m.conversation_join_declined, group: m.conversation_join_declined_group },
}

/** Someone from outside, by the Title their star had then, "Someone" for one not named yet. */
const outsider = (star: string): Word => ({ name: star === '' ? m.conversation_someone() : star })

/** What an Organization's line names: its star, visited on a click, and its Group, if any. */
const joinedPieces = (
  { organization, group }: Pick<Membership, 'organization' | 'group'>,
  naming: Naming,
) => ({
  organization: {
    tile: {
      title: named(organization.title),
      onCenter: centering(organization.id, naming.onCenter),
    },
  },
  group: group ?? '',
})

/** What a change of the user's place in an Organization says, by the admin who made it. */
function membershipWords(entry: Omit<Membership, '_tag'>, naming: Naming): Words {
  const said = memberships[entry.what][entry.group === undefined ? 'members' : 'group']
  return weave(said, { who: outsider(entry.by), ...joinedPieces(entry, naming) })
}

/** What someone asking to join an Organization the user is an admin of, or one of its Groups, says. */
export function joinAskedWords(entry: JoinAsked, naming: Naming): Words {
  const said =
    entry.group === undefined ? m.conversation_join_asked : m.conversation_join_asked_group
  return weave(said, { who: outsider(entry.by), ...joinedPieces(entry, naming) })
}

/**
 * A Tile someone shared with the user, by the Title their star had then, from outside, and what the
 * user may do there: its Tile, in their System, by the Title it had then, visited on a click, the
 * page leading there by its link, or "Nothing to see here" once taken back.
 */
function sharedOf(entry: Extract<Told, { _tag: 'Shared' }>, naming: Naming): Happened {
  const { by, tile, rights, at } = entry
  const title: Word = {
    tile: { title: named(tile.title), onCenter: centering(tile.id, naming.onCenter) },
  }
  const who: Word = { name: by === '' ? m.conversation_someone() : by }
  return {
    who: 'outside',
    words: weave(m.conversation_shared, { who, title }),
    detail: rightsSaid(rights),
    at,
  }
}

/**
 * What a change says, by who acted, its Tiles by the Titles they had: in the user's System, as it
 * holds them now; made in someone else's, visited by their links (`elsewhereOf`). The Tile a
 * Reference points at that the user's System does not hold, a pin's, stands elsewhere too, visited by
 * its link, never struck through (HEX-133).
 */
export function changeWords(entry: Extract<Entry, { _tag: 'Change' }>, naming: Naming): Words {
  const said = isVerb(entry.verb) ? changes[entry.verb] : changed
  const elsewhere = !isTheirs(entry) && entry.elsewhere === true
  const tileOf = (tile: { id: string; title: string }) =>
    elsewhere ? elsewhereOf(tile, naming) : recorded(tile, naming)
  const pinned = (tile: { id: string }) =>
    entry.verb === 'ReferenceCreated' && naming.system !== undefined && !naming.system.has(tile.id)
  const otherOf = (tile: { id: string; title: string }) =>
    pinned(tile) ? elsewhereOf(tile, naming) : tileOf(tile)
  const pieces = {
    title: tileOf(entry.tile),
    other: entry.other === undefined ? named('') : otherOf(entry.other),
  }
  return by(said, entry.actor, pieces)
}

/** What an import says: the Tile it landed as, and how many came below it, by who imported it. */
function importWords(entry: Extract<Told, { _tag: 'Import' }>, naming: Naming): Words {
  const said =
    entry.count === 0 ? imports.none : entry.count === 1 ? imports.one : importedMany(entry.count)
  return by(said, entry.actor, { title: recorded(entry.tile, naming) })
}

/**
 * Where the user went: the last gesture they made, on its Tile as the System names it now, a deleted
 * one said so, and how many came before it; a gesture this page does not know yet said plainly.
 */
function navigationOf(entry: Extract<Told, { _tag: 'Navigation' }>, naming: Naming): Happened {
  const { at, gestures } = entry
  const last = entry.steps.at(-1)
  const detail = gestures > 1 ? m.conversation_gestures({ count: gestures }) : undefined
  if (last === undefined || !isGesture(last.gesture)) {
    return { who: 'human', words: [m.conversation_navigated()], detail, at }
  }
  const title = naming.titles[last.tile]
  const tile = title === undefined ? m.conversation_tile_gone() : linked(last.tile, title, naming)
  return { who: 'human', words: weave(navigations[last.gesture], { title: tile }), detail, at }
}

/** What an import that brought several Tiles below the one it landed as says, by who imported it. */
function importedMany(count: number): Said<'title'> {
  const many = { count: String(count) }
  return {
    mine: (inputs) => m.conversation_imported_many({ ...inputs, ...many }),
    agents: (inputs) => m.conversation_imported_many_agent({ ...inputs, ...many }),
    theirs: (inputs) => m.conversation_imported_many_by({ ...inputs, ...many }),
  }
}

/** What each of Mapping's changes would do, once accepted, as a Proposal says it. */
const proposed: Record<OperationEvent['_tag'], (inputs: Record<Two, string>) => string> = {
  TileCreated: m.conversation_proposal_create,
  TileEdited: m.conversation_proposal_edit,
  TileMoved: m.conversation_proposal_move,
  TilesSwapped: m.conversation_proposal_swap,
  TileDeleted: m.conversation_proposal_delete,
  ReferenceCreated: m.conversation_proposal_reference,
  ReferenceDeleted: m.conversation_proposal_unreference,
}

/**
 * A change a Proposal drafted, its verb's icon and what it would do; a Tile it creates is the agent's
 * draft while the Proposal is open, deleted once discarded or undone. A verb this page does not know yet said plainly.
 */
export function proposedOf(change: ProposedChange, naming: Naming, open: boolean): Change {
  const drafted = open && change.verb === 'TileCreated'
  const pieces = {
    title: recorded(change.tile, naming, drafted),
    other: change.other === undefined ? named('') : recorded(change.other, naming),
  }
  if (!isVerb(change.verb)) {
    return { icon: verbIcons.TileEdited, words: weave(m.conversation_proposal_change, pieces) }
  }
  return { icon: verbIcons[change.verb], words: weave(proposed[change.verb], pieces) }
}

/**
 * What the timeline draws, in order: a run of lines, a Message, a Proposal, what a Turn applied, and
 * a change someone else made in the user's System, which offers its Undo (`offersUndo`) until undone.
 */
export type Block =
  | { readonly kind: 'lines'; readonly entries: ReadonlyArray<Told> }
  | { readonly kind: 'theirs'; readonly entry: TheirChange & Pick<Entry, 'id' | 'at'> }
  | {
      readonly kind: 'message'
      readonly entry: Extract<Entry, { _tag: 'Message' }>
      /** It follows another of the agent's: its mark stays on the first. */
      readonly continued: boolean
    }
  | { readonly kind: 'proposal'; readonly entry: Extract<Entry, { _tag: 'Proposal' }> }
  | { readonly kind: 'applied'; readonly entry: Extract<Entry, { _tag: 'TurnApplied' }> }
  | { readonly kind: 'asked'; readonly entry: Extract<Entry, { _tag: 'JoinAsked' }> }

/** The Entries of a day, oldest first, cut into what the timeline draws, the lines run together. */
export function blocksOf(entries: ReadonlyArray<Entry>): ReadonlyArray<Block> {
  const blocks: Block[] = []
  entries.forEach((entry, index) => {
    switch (entry._tag) {
      case 'Message': {
        const before = entries[index - 1]
        const continued =
          entry.author === 'agent' && before?._tag === 'Message' && before.author === 'agent'
        blocks.push({ kind: 'message', entry, continued })
        return
      }
      case 'Proposal':
        blocks.push({ kind: 'proposal', entry })
        return
      case 'TurnApplied':
        blocks.push({ kind: 'applied', entry })
        return
      case 'JoinAsked':
        blocks.push({ kind: 'asked', entry })
        return
      case 'Change':
        if (isTheirs(entry)) blocks.push({ kind: 'theirs', entry })
        else lineAfter(blocks, entry)
        return
      default:
        lineAfter(blocks, entry)
    }
  })
  return blocks
}

/** A line told after the blocks so far: the run it ends joined, or a run of its own begun. */
function lineAfter(blocks: Block[], entry: Told) {
  const last = blocks.at(-1)
  if (last?.kind === 'lines')
    blocks[blocks.length - 1] = { ...last, entries: [...last.entries, entry] }
  else blocks.push({ kind: 'lines', entries: [entry] })
}
