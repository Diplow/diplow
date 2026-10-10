// Assistant's server functions, for the Account the request's Session proves: a day of its
// Conversation, today by default; a Message posted, which starts a Turn answering it when the Account
// may use the Assistant, and a Stop of the Turn running; and where the user went, consecutive
// navigations merged by the browser into one Entry. Each validates its input by Assistant's own
// schemas, then hands its program (./programs.ts) to the helper.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { Ago, Day, MessageText, Navigation, Step } from '#/domains/assistant/entities'

import { run } from '../server/run'
import * as Assistant from './programs'

/**
 * A day of the Conversation, as its reader asks for it: a date of theirs, today when absent, and their
 * clock's offsets from UTC at its midnight and the next.
 */
export const DayAsked = Schema.Struct({ ...Day.fields, date: Schema.optionalKey(Day.fields.date) })

/** A Message the user posts: its text, trimmed, never empty. */
export const NewMessage = Schema.Struct({ text: MessageText })

/** The most Tiles a view names as on screen: two rings of six around a center, and theirs. */
const mostShown = 100

/**
 * A Message the user sends from home: its text; the view it was sent from, the centered Tile, where a
 * Turn answering it starts, and the Tiles on screen, by id, whose Previews its agent is shown; and how
 * far the reader's clock stands from UTC, which says what today is.
 */
export const SentMessage = Schema.Struct({
  text: MessageText,
  view: Schema.Struct({
    center: Step.fields.tile,
    shown: Schema.Array(Step.fields.tile).check(Schema.isMaxLength(mostShown)),
  }),
  offset: Day.fields.offset,
})

/**
 * Where the user went, as the browser merged it, and how long ago its last gesture was, a day at
 * most: the browser's clock says how long, never when, so two clocks never disagree.
 */
export const MergedNavigation = Schema.Struct({
  navigation: Navigation,
  sinceLast: Ago,
})

/**
 * A day of the Account's Conversation: the day, its Entries oldest first, the Titles of the Tiles its
 * navigations went to, by id, the instant of the latest Entry before it, and the Entry last recorded.
 */
export const conversationDay = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(DayAsked))
  .handler(({ data, context }) => run(context, Assistant.conversationDay(data)))

/**
 * The latest of what home shows, polled on focus, and every 2 s while a Turn runs: the System's
 * Version, the Conversation's last Entry, and the Turn running, with its agent's step.
 */
export const latest = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(Schema.Undefined))
  .handler(({ context }) => run(context, Assistant.latest))

/**
 * Posts the user's Message and, when the Account may use the Assistant, starts a Turn answering it;
 * answers its Entry, and the Turn when one started.
 */
export const postMessage = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(SentMessage))
  .handler(({ data, context }) => run(context, Assistant.sendMessage(data)))

/** Stops the Turn running in the Account's Conversation, if one runs. */
export const stopTurn = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(Schema.Undefined))
  .handler(({ context }) => run(context, Assistant.stopTurn))

/**
 * Whether the Account may use the Assistant, its `assistant` Entitlement: the composer says so when
 * it may not.
 */
export const assistantAvailable = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(Schema.Undefined))
  .handler(({ context }) => run(context, Assistant.assistantAvailable))

/** Records a merged navigation, sent once something else enters the timeline or the page hides. */
export const recordNavigation = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(MergedNavigation))
  .handler(({ data, context }) => run(context, Assistant.recordNavigation(data)))
