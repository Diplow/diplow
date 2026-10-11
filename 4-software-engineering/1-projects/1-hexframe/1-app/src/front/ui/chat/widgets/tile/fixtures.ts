// The tile widget's samples on /design-system: Tooling, under Software engineering, the chat's sample
// tiles (`chat/samples.ts`), its words messages, so they read in the page's language; an edit's
// stretches are pieces of the same sentences, so a diff reads whole in both.
import { m } from '#/paraglide/messages'

import { freeFor } from '../demo'
import type { Segment } from './Proposal'
import type { TilePlace, TileWords } from './parts'

const parent = () => m.gallery_sample_chat_engineering()

/** Tooling as it stands. */
export const tooling = (): TileWords => ({
  title: m.gallery_sample_chat_tooling(),
  preview:
    m.gallery_tile_sample_kept() + m.gallery_tile_sample_gone() + m.gallery_tile_sample_rest(),
  body: m.gallery_tile_sample_body(),
})

/** Its preview as the user edited it: the "and why" gone. */
export const yours = (): TileWords => ({
  ...tooling(),
  preview: m.gallery_tile_sample_kept() + m.gallery_tile_sample_rest(),
})

/** Tooling as the agent's edit leaves it, which Edit it hands to the user. */
export const agentsWords = (): TileWords => ({
  ...tooling(),
  preview:
    m.gallery_tile_sample_kept() + m.gallery_tile_sample_added() + m.gallery_tile_sample_rest(),
  body: `${tooling().body}\n\n${m.gallery_tile_sample_body_added()}`,
})

/** Where a new Branch may go under Software engineering, places 1 to 3 taken. */
export const newBranch = (): TilePlace => ({
  parent: parent(),
  kind: 'branch',
  place: 6,
  free: freeFor.branch,
})

/** Where Tooling stands, west. */
export const standing = (): TilePlace => ({
  parent: parent(),
  kind: 'branch',
  place: 6,
  free: [4, 5],
})

/** A preview the user wrote past its limit, put back with the refusal. */
export const longPreview = () =>
  [tooling().preview, m.gallery_tile_sample_long(), m.gallery_tile_sample_long()].join(' ')

/** The agent's edit of Tooling: its preview reworded, a section added to its page. */
export const agentsEdit = () =>
  [
    {
      field: 'preview',
      segments: [
        { kind: 'same', text: m.gallery_tile_sample_kept() },
        { kind: 'gone', text: m.gallery_tile_sample_gone() },
        { kind: 'added', text: m.gallery_tile_sample_added() },
        { kind: 'same', text: m.gallery_tile_sample_rest() },
      ],
    },
    {
      field: 'body',
      segments: [
        { kind: 'same', text: m.gallery_tile_sample_body_kept() },
        { kind: 'added', text: m.gallery_tile_sample_body_added() },
      ],
    },
  ] as const satisfies ReadonlyArray<{ field: 'preview' | 'body'; segments: readonly Segment[] }>

/** Who changed Tooling while the user edited it, and how their preview differs from the user's. */
export const meanwhile = () => ({
  by: m.gallery_tile_sample_by(),
  compared: [
    {
      field: 'preview',
      segments: [
        { kind: 'same', text: m.gallery_tile_sample_kept() },
        { kind: 'added', text: m.gallery_tile_sample_meanwhile() },
        { kind: 'same', text: m.gallery_tile_sample_rest() },
      ],
    },
  ] as const satisfies ReadonlyArray<{ field: 'preview'; segments: readonly Segment[] }>,
})

/** What an import of a vault left out, by path: a file's path is the user's, never translated. */
export const leftOutPaths = ['tooling/.obsidian/', 'tooling/node_modules/', 'tooling/diagram.png']

/** What refused an import, by path. */
export const faultPaths = ['tooling/7-seventh/', 'tooling/2-agents/CLAUDE.md']
