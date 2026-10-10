// Assistant's server functions, for the Account the request's Session proves: a day of its
// Conversation, today by default; a Message posted, which no agent answers yet; and where the user
// went, consecutive navigations merged by the browser into one Entry. Each validates its input by
// Assistant's own schemas, then hands its program (./programs.ts) to the helper.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { Ago, Day, MessageText, Navigation } from '#/domains/assistant/entities'

import { run } from '../server/run'
import * as Assistant from './programs'

/**
 * A day of the Conversation, as its reader asks for it: a date of theirs, today when absent, and their
 * clock's offsets from UTC at its midnight and the next.
 */
export const DayAsked = Schema.Struct({ ...Day.fields, date: Schema.optionalKey(Day.fields.date) })

/** A Message the user posts: its text, trimmed, never empty. */
export const NewMessage = Schema.Struct({ text: MessageText })

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
 * Version and the Conversation's last Entry.
 */
export const latest = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(Schema.Undefined))
  .handler(({ context }) => run(context, Assistant.latest))

/** Posts the user's Message, and answers its Entry. */
export const postMessage = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(NewMessage))
  .handler(({ data, context }) => run(context, Assistant.postMessage(data)))

/** Records a merged navigation, sent once something else enters the timeline or the page hides. */
export const recordNavigation = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(MergedNavigation))
  .handler(({ data, context }) => run(context, Assistant.recordNavigation(data)))
