// The top of this very vault, as a System: the user, their six domains, and a little below.
import type { CanvasView, TileNode } from '../layout'

const softwareEngineering: TileNode = {
  id: 'software-engineering',
  title: 'Software Engineering',
  preview: 'How software gets built in the AI era, and what I build with it.',
  children: {
    1: {
      id: 'projects',
      title: 'Projects',
      preview: 'The software I build: hexframe and my personal site.',
    },
    2: {
      id: 'principles',
      title: 'Principles',
      preview: 'Domain-driven design, AI-first, feedback, mapping modules, maintainability.',
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

export const scenes = {
  frame: { label: 'Expanded Frame', view: { expanded: new Set(), showContext: false } },
  nested: {
    label: 'Nested expansion',
    view: { expanded: new Set(['software-engineering']), showContext: false },
  },
  context: { label: 'Center Context', view: { expanded: new Set(), showContext: true } },
} satisfies Record<string, { label: string; view: CanvasView }>

export type Scene = keyof typeof scenes
