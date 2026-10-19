// The tokens, last on /design-system: every one the stylesheet declares, read from it by
// `stylesheet.ts`, grouped with what it is for. `tokens.test.ts` checks every token has its group, so
// none shows without a word; one that had none would still show, last, under "no note yet".
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import css from '../../styles.css?raw'
import { colorTokens, valueTokens, type ColorToken, type ValueToken } from './stylesheet'

/** Tokens that mean one thing, by name, and what that is. */
export interface Note {
  tokens: readonly string[]
  note: () => string
}

export const colourNotes: readonly Note[] = [
  { tokens: ['background', 'foreground'], note: m.tokens_colour_ground },
  { tokens: ['card', 'popover'], note: m.tokens_colour_surface },
  { tokens: ['primary'], note: m.tokens_colour_primary },
  { tokens: ['secondary', 'muted', 'accent'], note: m.tokens_colour_step },
  { tokens: ['faint'], note: m.tokens_colour_faint },
  { tokens: ['border', 'input'], note: m.tokens_colour_hairlines },
  { tokens: ['ring'], note: m.tokens_colour_ring },
  { tokens: ['human'], note: m.tokens_colour_human },
  { tokens: ['agent'], note: m.tokens_colour_agent },
  { tokens: ['destructive', 'success', 'warning', 'info'], note: m.tokens_colour_statuses },
  { tokens: ['context'], note: m.tokens_colour_context },
  { tokens: ['glow', 'glow-soft'], note: m.tokens_colour_glow },
  { tokens: ['halo'], note: m.tokens_colour_halo },
  { tokens: ['aura'], note: m.tokens_colour_aura },
  {
    tokens: ['organization', 'organization-soft', 'organization-halo'],
    note: m.tokens_colour_organization,
  },
  { tokens: ['ambient'], note: m.tokens_colour_ambient },
  { tokens: ['dusk'], note: m.tokens_colour_dusk },
  { tokens: ['tile', 'tile-fade'], note: m.tokens_colour_tile },
  { tokens: ['tile-lit', 'tile-lit-fade'], note: m.tokens_colour_tile_lit },
  { tokens: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'], note: m.tokens_colour_chart },
  {
    tokens: ['sidebar', 'sidebar-primary', 'sidebar-accent', 'sidebar-border', 'sidebar-ring'],
    note: m.tokens_colour_sidebar,
  },
]

const radii = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'].map((step) => `radius-${step}`)

export const valueNotes: readonly Note[] = [
  { tokens: ['font-sans'], note: m.tokens_type_sans },
  { tokens: ['font-serif', 'font-heading', 'font-human'], note: m.tokens_type_serif },
  { tokens: ['font-mono', 'font-agent'], note: m.tokens_type_mono },
  { tokens: ['text-prose', 'text-mono'], note: m.tokens_type_sizes },
  { tokens: radii, note: m.tokens_shape },
  { tokens: ['shadow-lift'], note: m.tokens_shape_lift },
  { tokens: ['ease-glide'], note: m.tokens_motion_glide },
  { tokens: ['ease-camera'], note: m.tokens_motion_camera_ease },
  { tokens: ['duration-bloom', 'animate-bloom'], note: m.tokens_motion_bloom },
  { tokens: ['duration-fold', 'animate-fold'], note: m.tokens_motion_fold },
  { tokens: ['stagger-bloom'], note: m.tokens_motion_stagger },
  { tokens: ['stagger-step'], note: m.tokens_motion_step },
  { tokens: ['duration-camera'], note: m.tokens_motion_camera },
  { tokens: ['duration-camera-level'], note: m.tokens_motion_camera_level },
  {
    tokens: ['duration-journey', 'animate-recede', 'animate-approach'],
    note: m.tokens_motion_journey,
  },
  { tokens: ['duration-turn'], note: m.tokens_motion_turn },
  { tokens: ['duration-glide'], note: m.tokens_motion_glide_duration },
  { tokens: ['animate-breathe'], note: m.tokens_motion_breathe },
  { tokens: ['animate-draw', 'animate-unfold', 'animate-rise'], note: m.tokens_motion_entrance },
  { tokens: ['animate-descend'], note: m.tokens_motion_descend },
  { tokens: ['animate-sweep'], note: m.tokens_motion_sweep },
  { tokens: ['duration-flare', 'animate-flare'], note: m.tokens_motion_flare },
  { tokens: ['duration-glint', 'animate-glint'], note: m.tokens_motion_glint },
  { tokens: ['animate-orbit'], note: m.tokens_motion_orbit },
  { tokens: ['duration-glance'], note: m.tokens_motion_glance },
  { tokens: ['duration-sunrise'], note: m.tokens_motion_sunrise },
  { tokens: ['duration-dawn', 'animate-dawn', 'stagger-dawn'], note: m.tokens_motion_dawn },
  { tokens: ['stagger-beat'], note: m.tokens_motion_beat },
  { tokens: ['animate-ants'], note: m.tokens_motion_ants },
  { tokens: ['animate-ink'], note: m.tokens_motion_ink },
  { tokens: ['container-wide'], note: m.tokens_container_wide },
]

/** The tokens read from the stylesheet, under their notes, in the notes' order; the unnoted last. */
function grouped<T extends { name: string }>(tokens: readonly T[], notes: readonly Note[]) {
  const groups = notes.map(({ tokens: names, note }) => ({
    note,
    tokens: tokens.filter(({ name }) => names.includes(name)),
  }))
  const unnoted = tokens.filter(
    ({ name }) => !notes.some(({ tokens: names }) => names.includes(name)),
  )
  return [...groups, { note: m.tokens_unnoted, tokens: unnoted }].filter(
    (group) => group.tokens.length > 0,
  )
}

const colours = colorTokens(css)
const values = valueTokens(css)

export function Tokens() {
  return (
    <section id="tokens" className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-8">
      <header className="grid gap-2 border-t border-input pt-8">
        <h2 className="text-3xl font-light">{m.tokens_title()}</h2>
        <p className="max-w-prose text-muted-foreground">{m.tokens_intro()}</p>
      </header>
      <Part title={m.tokens_colour_title()}>
        {grouped(colours, colourNotes).map(({ note, tokens }) => (
          <Row key={tokens[0]?.name} note={note()}>
            {tokens.map((token) => (
              <Swatch key={token.name} token={token} />
            ))}
          </Row>
        ))}
      </Part>
      <Part title={m.tokens_values_title()}>
        {grouped(values, valueNotes).map(({ note, tokens }) => (
          <Row key={tokens[0]?.name} note={note()}>
            {tokens.map((token) => (
              <Value key={token.name} token={token} />
            ))}
          </Row>
        ))}
      </Part>
      <Part title={m.tokens_phone_title()}>
        <p className="max-w-prose text-sm">{m.tokens_phone()}</p>
      </Part>
      <Part title={m.tokens_light_title()}>
        <ul className="grid max-w-prose list-disc gap-2 pl-5 text-sm">
          {lightNotes.map((note) => (
            <li key={note()}>{note()}</li>
          ))}
        </ul>
      </Part>
    </section>
  )
}

const lightNotes = [
  m.tokens_light_tile,
  m.tokens_light_center,
  m.tokens_light_root,
  m.tokens_light_halo,
  m.tokens_light_sunward,
  m.tokens_light_ambient,
  m.tokens_light_zone,
  m.tokens_light_draft,
]

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <dl className="grid gap-4">{children}</dl>
    </div>
  )
}

/** A group: its tokens, then what they are for, side by side from `sm` up. */
function Row({ note, children }: { note: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
      <dt className="flex flex-wrap gap-3">{children}</dt>
      <dd className="text-sm text-muted-foreground">{note}</dd>
    </div>
  )
}

function Swatch({ token: { name, foreground } }: { token: ColorToken }) {
  return (
    <span className="grid w-44 gap-1">
      <span
        className="flex h-12 items-center justify-center border text-lg font-semibold"
        // `@theme inline` defines no `--color-*` variable, so a swatch reads the variable behind the token.
        style={{ background: `var(--${name})`, color: foreground && `var(--${foreground})` }}
      >
        {foreground && 'Aa'}
      </span>
      <code className="text-xs break-all">--{name}</code>
      {foreground && <code className="text-xs break-all text-faint">--{foreground}</code>}
    </span>
  )
}

/**
 * A font, a size and an animation show themselves, through the utility of the same name, which
 * Tailwind finds written out in the notes above; any other token shows its value alone.
 */
function Value({ token: { name, value } }: { token: ValueToken }) {
  const shows = /^(font|text|animate)-/.test(name)
  // A size shows at its own size; a font and an animation at one large enough to see.
  const specimen = name.startsWith('text-') ? name : `${name} text-2xl`
  return (
    <span className="grid min-w-28 gap-1">
      {shows && <span className={specimen}>Aa</span>}
      <code className="text-xs">--{name}</code>
      <code className="text-xs break-all text-faint">{value}</code>
    </span>
  )
}
