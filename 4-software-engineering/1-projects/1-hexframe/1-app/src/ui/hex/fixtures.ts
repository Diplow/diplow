// A fixture System for /dev/hex: the top of this very vault, the user and their six domains, and a
// little below, deep enough to nest two expansions and open a Context. Its content is the user's own,
// in their words, so it is not translated.
import type { TileNode } from './geometry/layout'

const projects: TileNode = {
  id: 'projects',
  title: 'Projects',
  preview: 'The software I build: hexframe and my personal site.',
  children: {
    1: {
      id: 'hexframe',
      title: 'hexframe',
      preview: 'Lay out a system as a hierarchy of tiles, so AI works along its intent.',
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
