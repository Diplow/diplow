// A fixture System for /dev/hex and /dev/system: the top of this very vault, the user, their six
// domains and the files beside them, and a little below, deep enough to open a Branch two
// generations down, mix Branches and Leaves in a ring of Children, clash a Leaf with a Branch, and
// split a Tile of more than six into its Branches and its Leaves. Its content is the user's own, in
// their words, so it is not translated.
import type { TileNode } from './view/tiles'
import type { CanvasView } from './view/view'

const leaf = (id: string, title: string, preview: string): TileNode => ({
  id,
  title,
  preview,
  leaf: true,
})

const hexframe: TileNode = {
  id: 'hexframe',
  title: 'hexframe',
  // Long, near the Preview's 350 characters: the chat's tile card shows it with show more.
  preview:
    'The app where a user lays out a system (a codebase, a team, their own life) as a ' +
    'hierarchy of tiles: one tile, the six it breaks into, then theirs. What they choose to ' +
    'show first carries their intent, and an AI reading the system in that order works along ' +
    'it. A TanStack Start app on Vercel, Effect on the server, Neon below.',
  branches: {
    1: { id: 'app', title: 'App', preview: 'The TanStack Start app.' },
    2: { id: 'claude-mod', title: 'Claude mod', preview: 'hexframe inside Claude Code.' },
    3: { id: 'obsidian', title: 'Obsidian plugin', preview: 'hexframe inside Obsidian.' },
  },
  leaves: {
    1: leaf('stack', 'Stack', 'The technical choices, and the rules that come with them.'),
  },
}

const projects: TileNode = {
  id: 'projects',
  title: 'Projects',
  preview: 'The software I build: hexframe and my personal site.',
  branches: {
    1: hexframe,
    2: { id: 'site', title: 'Site', preview: 'My personal website.' },
  },
}

const softwareEngineering: TileNode = {
  id: 'software-engineering',
  title: 'Software Engineering',
  preview: 'How software gets built in the AI era, and what I build with it.',
  branches: {
    1: projects,
    2: {
      id: 'principles',
      title: 'Principles',
      preview: 'Domain-driven design, AI-first, feedback, mapping modules, maintainability.',
    },
  },
  // The reading list is numbered 2, as Principles is: a clash, seated in the first free Direction.
  leaves: {
    2: leaf('reading-list', 'Reading list', 'Books and papers I keep coming back to.'),
    3: leaf('notes', 'Notes', 'What I learned this year.'),
  },
  context: {
    1: {
      id: 'ai-first',
      title: 'AI-first',
      preview: 'Agents write most of the code; people steer.',
    },
  },
}

export const ulysse: TileNode = {
  id: 'ulysse',
  title: 'Ulysse',
  preview: 'What I aim at, what I think about the world, and why.',
  branches: {
    1: { id: 'leadership', title: 'Leadership', preview: 'Leading teams, and the people in them.' },
    2: { id: 'education', title: 'Education', preview: 'How people learn, and how to help them.' },
    3: { id: 'games', title: 'Games', preview: 'Games as designed systems of rules and play.' },
    4: softwareEngineering,
    5: { id: 'startups', title: 'Startups', preview: 'Building a company from nothing.' },
    6: { id: 'politics', title: 'Politics', preview: 'How a society decides together.' },
  },
  // Six Branches and two Leaves: more than six in all, so the root shows Branches and Leaves apart.
  leaves: {
    1: leaf('vault-stack', 'Stack', 'The stack every project of the vault shares.'),
    2: leaf('diplow-hexframe', 'diplow.hexframe', ''),
  },
  context: {
    1: { id: 'purpose', title: 'Purpose', preview: 'An entry point to who I am.' },
    2: { id: 'conventions', title: 'Conventions', preview: 'The hexframe shape, at every level.' },
    3: { id: 'skills', title: 'Skills', preview: 'How agents work in this vault.' },
  },
}

/** A view per state the canvas has to get right, named by the fixture's own Tiles. */
export const fixtureViews = {
  root: {},
  split: { inner: 'leaves' },
  expanded: { expanded: { 4: 'children' } },
  context: { inner: 'context' },
  mixed: { center: softwareEngineering.id, inner: 'context' },
  twoDeep: { center: softwareEngineering.id, expanded: { 1: 'children' } },
  leaf: { center: 'notes' },
} satisfies Record<string, CanvasView>
