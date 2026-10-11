// Every piece /design-system shows, by tier and side, top-down: what it is for, the files it is drawn
// in, and what it is made of. `pieces.test.ts` reads "made of" again from those files' imports, so it
// cannot drift from the code; "used in" is read back from it.
import { m } from '#/paraglide/messages'

/** The page's tiers, top-down: the crossings, each side, then what the sides share, then the seams. */
export const tiers = ['crossings', 'chat', 'canvas', 'layouts', 'atoms', 'seams'] as const

export type Tier = (typeof tiers)[number]

interface Entry {
  readonly name: string
  readonly tier: Tier
  /** The files it is drawn in, from `src/front/`. */
  readonly sources: readonly string[]
  /**
   * The pieces its files import, through files that are no piece of their own. Pieces that share a
   * file share its imports between them: each names those it draws.
   */
  readonly madeOf: readonly string[]
  /** What it is for and why, in a sentence or two. */
  readonly note: () => string
}

export const pieces = [
  {
    name: 'Conversation',
    tier: 'chat',
    sources: ['features/conversation/Conversation.tsx'],
    madeOf: [
      'Suggestions',
      'ConfirmDialog',
      'EmptyState',
      'Button',
      'Textarea',
      'Field',
      'useAppForm',
    ],
    note: m.gallery_note_conversation,
  },
  {
    name: 'Message',
    tier: 'chat',
    sources: ['ui/chat/text/Message.tsx'],
    madeOf: ['Mention', 'Act', 'Button', 'Toaster'],
    note: m.gallery_note_message,
  },
  {
    name: 'Thinking',
    tier: 'chat',
    sources: ['ui/chat/text/Thinking.tsx'],
    madeOf: [],
    note: m.gallery_note_thinking,
  },
  {
    name: 'Mention',
    tier: 'chat',
    sources: ['ui/chat/text/Mention.tsx'],
    madeOf: [],
    note: m.gallery_note_mention,
  },
  {
    name: 'Events',
    tier: 'chat',
    sources: ['ui/chat/entries/Events.tsx'],
    madeOf: ['Mention'],
    note: m.gallery_note_events,
  },
  {
    name: 'DaySplit',
    tier: 'chat',
    sources: ['ui/chat/entries/DaySplit.tsx'],
    madeOf: [],
    note: m.gallery_note_day_split,
  },
  {
    name: 'Proposal',
    tier: 'chat',
    sources: ['ui/chat/entries/Proposal.tsx'],
    madeOf: ['ConfirmDialog', 'Act', 'Mention', 'Receipt'],
    note: m.gallery_note_proposal,
  },
  {
    name: 'Receipt',
    tier: 'chat',
    sources: ['ui/chat/entries/Receipt.tsx'],
    madeOf: ['Act', 'Mention'],
    note: m.gallery_note_receipt,
  },
  {
    name: 'Suggestions',
    tier: 'chat',
    sources: ['ui/chat/atoms/Suggestions.tsx'],
    madeOf: [],
    note: m.gallery_note_suggestions,
  },
  {
    name: 'Act',
    tier: 'chat',
    sources: ['ui/chat/atoms/Act.tsx'],
    madeOf: [],
    note: m.gallery_note_act,
  },
  {
    name: 'Canvas',
    tier: 'canvas',
    sources: ['ui/canvas/Canvas.tsx'],
    madeOf: ['Tooltip', 'Button'],
    note: m.gallery_note_canvas,
  },
  {
    name: 'Breadcrumb',
    tier: 'canvas',
    sources: ['features/breadcrumb/Breadcrumb.tsx'],
    madeOf: [],
    note: m.gallery_note_breadcrumb,
  },
  {
    name: 'Card',
    tier: 'canvas',
    sources: ['ui/canvas/layouts/Card.tsx'],
    madeOf: [],
    note: m.gallery_note_card,
  },
  {
    name: 'Drawer',
    tier: 'canvas',
    sources: ['ui/canvas/layouts/Drawer.tsx'],
    madeOf: [],
    note: m.gallery_note_drawer,
  },
  {
    name: 'Tooltip',
    tier: 'canvas',
    sources: ['ui/canvas/atoms/Tooltip.tsx'],
    madeOf: [],
    note: m.gallery_note_tooltip,
  },
  {
    name: 'channels',
    tier: 'layouts',
    sources: ['client/ReadBoundary.tsx', 'client/channels.ts'],
    madeOf: ['ErrorState', 'Forbidden', 'Toaster'],
    note: m.gallery_note_channels,
  },
  {
    name: 'ConfirmDialog',
    tier: 'layouts',
    sources: ['ui/layouts/ConfirmDialog.tsx'],
    madeOf: ['Button'],
    note: m.gallery_note_confirm_dialog,
  },
  {
    name: 'DataTable',
    tier: 'layouts',
    sources: ['ui/layouts/DataTable.tsx'],
    madeOf: ['Skeleton'],
    note: m.gallery_note_data_table,
  },
  {
    name: 'PageHeader',
    tier: 'layouts',
    sources: ['ui/layouts/PageHeader.tsx'],
    madeOf: [],
    note: m.gallery_note_page_header,
  },
  {
    name: 'EmptyState',
    tier: 'layouts',
    sources: ['ui/layouts/states.tsx'],
    madeOf: [],
    note: m.gallery_note_empty_state,
  },
  {
    name: 'ErrorState',
    tier: 'layouts',
    sources: ['ui/layouts/states.tsx'],
    madeOf: ['Button'],
    note: m.gallery_note_error_state,
  },
  {
    name: 'Forbidden',
    tier: 'layouts',
    sources: ['ui/layouts/states.tsx'],
    madeOf: [],
    note: m.gallery_note_forbidden,
  },
  {
    name: 'Button',
    tier: 'atoms',
    sources: ['ui/atoms/controls/button.tsx'],
    madeOf: [],
    note: m.gallery_note_button,
  },
  {
    name: 'Input',
    tier: 'atoms',
    sources: ['ui/atoms/controls/input.tsx'],
    madeOf: [],
    note: m.gallery_note_input,
  },
  {
    name: 'Textarea',
    tier: 'atoms',
    sources: ['ui/atoms/controls/textarea.tsx'],
    madeOf: [],
    note: m.gallery_note_textarea,
  },
  {
    name: 'Field',
    tier: 'atoms',
    sources: ['ui/atoms/forms/field.tsx'],
    madeOf: [],
    note: m.gallery_note_field,
  },
  {
    name: 'useAppForm',
    tier: 'atoms',
    sources: ['ui/atoms/forms/form.tsx'],
    madeOf: ['Button', 'Input', 'Textarea', 'Field'],
    note: m.gallery_note_use_app_form,
  },
  {
    name: 'DropdownMenu',
    tier: 'atoms',
    sources: ['ui/atoms/DropdownMenu.tsx'],
    madeOf: [],
    note: m.gallery_note_dropdown_menu,
  },
  {
    name: 'Toaster',
    tier: 'atoms',
    sources: ['ui/atoms/Toaster.tsx'],
    madeOf: [],
    note: m.gallery_note_toaster,
  },
  {
    name: 'Skeleton',
    tier: 'atoms',
    sources: ['ui/atoms/skeleton.tsx'],
    madeOf: [],
    note: m.gallery_note_skeleton,
  },
  {
    name: 'ThemeToggle',
    tier: 'atoms',
    sources: ['ui/atoms/controls/ThemeToggle.tsx'],
    madeOf: ['Button'],
    note: m.gallery_note_theme_toggle,
  },
  {
    name: 'LocaleSwitch',
    tier: 'atoms',
    sources: ['ui/atoms/controls/LocaleSwitch.tsx'],
    madeOf: ['Button'],
    note: m.gallery_note_locale_switch,
  },
  {
    name: 'CodeBlock',
    tier: 'seams',
    sources: ['ui/seams/Markdown.tsx'],
    madeOf: [],
    note: m.gallery_note_code_block,
  },
] as const satisfies readonly Entry[]

export type PieceName = (typeof pieces)[number]['name']

/** The piece by its name. */
export function pieceNamed(name: PieceName): Entry {
  // Every name the type allows is in the list.
  return pieces.find((piece) => piece.name === name) as Entry
}

/** The pieces made with this one, in the page's order. */
export function usedIn(name: PieceName): PieceName[] {
  return pieces
    .filter((piece) => (piece.madeOf as readonly string[]).includes(name))
    .map((piece) => piece.name)
}

/** Whether a piece fills the tier, so the page shows its section. */
export function filled(tier: Tier): boolean {
  return pieces.some((piece) => piece.tier === tier)
}

/** A piece's anchor on the page, which "made of" and "used in" link to. */
export const anchorOf = (name: string) => `piece-${name}`
