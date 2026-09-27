// A fixture System for /dev/hex and /dev/system: the top of this very vault, the user and their six domains, and a
// little below, deep enough to nest two expansions and open a Context. Its content is the user's own,
// in their words, so it is not translated.
import type { TileNode } from './geometry/layout'
import type { CanvasView } from './view/view'

const projects: TileNode = {
  id: 'projects',
  title: 'Projects',
  preview: 'The software I build: hexframe and my personal site.',
  children: {
    1: {
      id: 'hexframe',
      title: 'hexframe',
      // Long, near the Preview's 350 characters: the chat's tile card shows it with show more.
      preview:
        'The app where a user lays out a system (a codebase, a team, their own life) as a ' +
        'hierarchy of tiles: one tile, the six it breaks into, then theirs. What they choose to ' +
        'show first carries their intent, and an AI reading the system in that order works along ' +
        'it. A TanStack Start app on Vercel, Effect on the server, Neon below.',
    },
    2: { id: 'site', title: 'Site', preview: 'My personal website.' },
  },
}

const softwareEngineering: TileNode = {
  id: 'software-engineering',
  title: 'Software Engineering',
  preview: 'How software gets built in the AI era, and what I build with it.',
  children: {
    1: projects,
    2: {
      id: 'principles',
      title: 'Principles',
      preview: 'Domain-driven design, AI-first, feedback, mapping modules, maintainability.',
    },
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
  children: {
    1: { id: 'leadership', title: 'Leadership', preview: 'Leading teams, and the people in them.' },
    2: { id: 'education', title: 'Education', preview: 'How people learn, and how to help them.' },
    3: { id: 'games', title: 'Games', preview: 'Games as designed systems of rules and play.' },
    4: softwareEngineering,
    5: { id: 'startups', title: 'Startups', preview: 'Building a company from nothing.' },
    6: { id: 'politics', title: 'Politics', preview: 'How a society decides together.' },
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
  expanded: { expanded: [softwareEngineering.id] },
  nested: { expanded: [softwareEngineering.id, projects.id] },
  context: { context: true },
  centered: { center: softwareEngineering.id, context: true },
} satisfies Record<string, CanvasView>
