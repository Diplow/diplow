// The tile widget's specimens on /design-system: a tile of the fixture System, Tooling, under
// Software engineering, in the user's own words, not translated, as the canvas's fixtures are.
import type { Segment } from './Proposal'
import type { TilePlace, TileWords } from './parts'

export const parent = 'Software engineering'

export const tooling: TileWords = {
  title: 'Tooling',
  preview:
    'What I use to build, and why: the editor, the agents, and the scripts that keep a repository honest.',
  body: '## Agents\n\nClaude Code, with the mods this repository ships.\n\n## Checks\n\nThe rule of 6, cubic’s three reviewers, dependency-cruiser.',
}

/** Where a new Branch may go under Software engineering, 1 to 3 taken, and where Tooling stands. */
export const newBranch: TilePlace = { parent, kind: 'branch', place: 6, free: [4, 5, 6] }
export const standing: TilePlace = { parent, kind: 'branch', place: 6, free: [4, 5] }

/** A preview the user wrote past its 350 characters, put back with the refusal. */
export const longPreview =
  `${tooling.preview} ${'Every tool earns its place by what it saves me, and the ones that stopped saving anything are listed below, with the day I dropped them and why, so I never pick one up again by accident. '.repeat(2)}`.trim()

/** The agent's edit of Tooling: its preview reworded, a section added to its page. */
export const agentsEdit: ReadonlyArray<{ field: 'preview' | 'body'; segments: Segment[] }> = [
  {
    field: 'preview',
    segments: [
      { kind: 'same', text: 'What I use to build' },
      { kind: 'gone', text: ', and why' },
      { kind: 'added', text: ' and how it fits together' },
      {
        kind: 'same',
        text: ': the editor, the agents, and the scripts that keep a repository honest.',
      },
    ],
  },
  {
    field: 'body',
    segments: [
      { kind: 'same', text: '…dependency-cruiser.\n\n' },
      { kind: 'added', text: '## Shortcuts\n\nThe scripts I run before every pull request.' },
    ],
  },
]

/** Who changed Tooling while the user edited it, and how their preview differs from the user's. */
export const meanwhile = {
  by: 'Claude Code, laptop',
  compared: [
    {
      field: 'preview',
      segments: [
        { kind: 'same', text: 'What I use to build' },
        { kind: 'gone', text: ', and why' },
        { kind: 'added', text: ', day to day' },
        {
          kind: 'same',
          text: ': the editor, the agents, and the scripts that keep a repository honest.',
        },
      ],
    },
  ],
} as const satisfies {
  by: string
  compared: ReadonlyArray<{ field: 'preview'; segments: Segment[] }>
}

/** What an import of a vault left out, by path. */
export const leftOutPaths = ['tooling/.obsidian/', 'tooling/node_modules/', 'tooling/diagram.png']

/** What refused an import, by path. */
export const faultPaths = ['tooling/7-seventh/', 'tooling/2-agents/CLAUDE.md']
