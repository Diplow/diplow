// Assistant's Decider: what an Operation does to a Conversation, the events it makes or its refusal,
// and the Conversation after one event. Every rule of the Mode and the Proposal lives here: a Mode
// switched to the one it is changes nothing; a draft continues the open Proposal, opening one only
// when none is, so at most one is open at a time; and only the open Proposal is accepted or
// discarded, once; and a Proposal changes one System, the one the Turn that opened it works in, so a
// Turn working in another drafts nothing into it. The service runs it on the Conversation it locked. Pure: a new Proposal's id is
// given, never made here.
import { Result } from 'effect'

import type { Mode, ProposedChange } from '../entities'
import { ProposalClosed, ProposalElsewhere } from '../errors'
import {
  type AcceptProposal,
  type ConversationEvent,
  type DiscardProposal,
  type Draft,
  Drafted,
  ModeSet,
  type Operation,
  ProposalDecided,
  ProposalOpened,
  type SetMode,
} from './operation'

/** A write drafted into a Proposal, opaque, and the changes it makes, as Mapping summarized them. */
export interface DraftedWrite {
  readonly write: unknown
  readonly changes: ReadonlyArray<ProposedChange>
}

/**
 * The open Proposal of a Conversation, as it is decided on: its id, the Turn that opened it, its
 * drafts, in the order they were drafted, and the System they change, someone else's by its star
 * (`elsewhere`), none for the Account's own.
 */
export interface OpenProposal {
  readonly id: string
  readonly turn: string
  readonly drafts: ReadonlyArray<DraftedWrite>
  readonly elsewhere?: string
}

/** A Proposal's writes, opaque, in the order they were drafted: what the API layer runs on accept. */
export const writesOf = ({ drafts }: Pick<OpenProposal, 'drafts'>) =>
  drafts.map(({ write }) => write)

/** A Proposal's changes, as Mapping summarized them, in the order they were drafted. */
export const changesOf = ({ drafts }: Pick<OpenProposal, 'drafts'>) =>
  drafts.flatMap(({ changes }) => changes)

/** A Conversation as Assistant decides on it: its Mode, and its open Proposal, if one is. */
export interface ConversationState {
  readonly mode: Mode
  readonly open?: OpenProposal
}

/** What `decide` answers: the events an Operation makes, in order, none when it changes nothing. */
export type Decided<E = never> = Result.Result<ReadonlyArray<ConversationEvent>, E>

/**
 * The open Proposal a write drafted in the System `elsewhere` names continues, someone else's by its
 * star, none for the Account's own: the open one when it changes that System, none when none is open,
 * or `ProposalElsewhere` when the one open changes another, since a Proposal changes one System. What
 * a draft asks before it is decided on the System the Proposal makes, and what a Turn's reads show.
 */
export const continuedBy = (
  state: ConversationState,
  elsewhere: string | undefined,
): Result.Result<OpenProposal | undefined, ProposalElsewhere> =>
  state.open === undefined || state.open.elsewhere === elsewhere
    ? Result.succeed(state.open)
    : Result.fail(new ProposalElsewhere())

/** The open Proposal of this id, decided by the user: refused `ProposalClosed` unless it is open. */
const decided = (
  state: ConversationState,
  proposal: string,
  fate: ProposalDecided['fate'],
): Decided<ProposalClosed> =>
  state.open?.id === proposal
    ? Result.succeed([new ProposalDecided({ proposal, fate })])
    : Result.fail(new ProposalClosed())

/**
 * What an Operation does to a Conversation: its events, in the order they apply (`evolve`), none
 * when it changes nothing, or its refusal. A draft that opens a Proposal is given its id.
 */
export function decide(state: ConversationState, operation: SetMode): Decided
export function decide(
  state: ConversationState,
  operation: Draft,
  made: { readonly proposal: string },
): Decided<ProposalElsewhere>
export function decide(
  state: ConversationState,
  operation: AcceptProposal | DiscardProposal,
): Decided<ProposalClosed>
export function decide(
  state: ConversationState,
  operation: Operation,
  made?: { readonly proposal: string },
): Decided<ProposalClosed | ProposalElsewhere> {
  switch (operation._tag) {
    case 'SetMode':
      return Result.succeed(
        operation.mode === state.mode ? [] : [new ModeSet({ mode: operation.mode })],
      )
    case 'Draft': {
      const { turn, write, changes, elsewhere } = operation
      return Result.map(continuedBy(state, elsewhere), (open) => {
        const proposal = open?.id ?? made?.proposal
        if (proposal === undefined) throw new Error('A draft opened a Proposal without its id')
        const where = elsewhere === undefined ? {} : { elsewhere }
        const opened = open === undefined ? [new ProposalOpened({ id: proposal, turn, ...where })] : []
        return [...opened, new Drafted({ proposal, write, changes })]
      })
    }
    case 'AcceptProposal':
      return decided(state, operation.proposal, 'accepted')
    case 'DiscardProposal':
      return decided(state, operation.proposal, 'discarded')
  }
}

/** A Conversation after one of its events. */
export function evolve(state: ConversationState, event: ConversationEvent): ConversationState {
  switch (event._tag) {
    case 'ModeSet':
      return { ...state, mode: event.mode }
    case 'ProposalOpened': {
      const where = event.elsewhere === undefined ? {} : { elsewhere: event.elsewhere }
      return { ...state, open: { id: event.id, turn: event.turn, drafts: [], ...where } }
    }
    case 'Drafted': {
      const { open } = state
      if (open?.id !== event.proposal) return state
      const { write, changes } = event
      return { ...state, open: { ...open, drafts: [...open.drafts, { write, changes }] } }
    }
    case 'ProposalDecided':
      return state.open?.id === event.proposal ? { mode: state.mode } : state
  }
}
