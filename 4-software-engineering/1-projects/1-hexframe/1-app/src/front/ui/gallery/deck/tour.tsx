// What the screen's two slides show before any piece: on the chat's, the canvas is still a page of
// words about the chat, its two voices drawn as the chat draws them, its curve and what it lacks; on
// the canvas's, the first tile, alone and large, whose six tell what the canvas is, in the reader's
// language, read at render.
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { directionName } from '../../canvas/tile/menu/verbs'
import { directions } from '../../canvas/geometry/geometry'
import type { TileNode } from '../../canvas/view/tiles'
import { Message } from '../../chat/text/Message'

/** The canvas, while the chat is told: what a chat is for, in words. */
export function ChatPage() {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <article className="grid max-w-[46rem] content-start gap-12 px-6 pt-24 pb-20 @wide:px-16">
        <header className="grid gap-4 motion-safe:animate-rise">
          <p className="font-agent text-[0.75rem] tracking-wide text-faint">
            {m.deck_title_chat()}
          </p>
          <h2 className="font-human text-[clamp(2rem,4cqw,2.875rem)] leading-[1.1] font-light text-balance">
            {m.deck_chat_page_title()}
          </h2>
          <p className="font-human text-[1.1875rem] leading-[1.6] font-light text-muted-foreground">
            {m.deck_chat_page_intro()}
          </p>
        </header>
        <Part title={m.deck_chat_page_voices()}>
          <Voice label={m.deck_chat_page_yours()}>
            <Message voice="human" words={[m.deck_chat_page_yours_sample()]} />
          </Voice>
          <Voice label={m.deck_chat_page_agents()}>
            <Message voice="agent" words={[m.deck_chat_page_agents_sample()]} />
          </Voice>
          <Voice label={m.deck_chat_page_interface()}>
            <p className="text-[0.9375rem] font-light text-muted-foreground">
              {m.deck_chat_page_interface_sample()}
            </p>
          </Voice>
        </Part>
        <Part title={m.deck_chat_page_curve()}>
          <Said>{m.deck_chat_page_curve_text()}</Said>
        </Part>
        <Part title={m.deck_chat_page_lacks()}>
          <Said>{m.deck_chat_page_lacks_text()}</Said>
        </Part>
      </article>
    </div>
  )
}

/** A part of the page: a fine line on top, its title, what it says. */
function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="relative grid gap-5 pt-6 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-input before:to-transparent before:content-[''] motion-safe:animate-rise">
      <h3 className="font-human text-[1.375rem] font-light">{title}</h3>
      {children}
    </section>
  )
}

/** A voice, drawn as the chat draws it, under what it is. */
function Voice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="grid gap-2.5">
      <figcaption className="text-[0.75rem] text-faint">{label}</figcaption>
      {children}
    </figure>
  )
}

function Said({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.9375rem] leading-relaxed font-light text-muted-foreground">{children}</p>
  )
}

const leaf = (id: string, title: string, preview: string): TileNode => ({
  id,
  title,
  preview,
  leaf: true,
})

/**
 * The tile the canvas shows first: the canvas itself, its six what it is, one of them lit as the root
 * is, since amber is yours, two of them opening in place, and in its Context why six, and why hexes.
 */
export function canvasTour(): TileNode {
  return {
    id: 'canvas',
    title: m.deck_tour_canvas(),
    preview: m.deck_tour_canvas_preview(),
    branches: {
      1: {
        id: 'tile',
        title: m.deck_tour_tile(),
        preview: m.deck_tour_tile_preview(),
        leaves: {
          1: leaf('title', m.deck_tour_title(), m.deck_tour_title_preview()),
          2: leaf('preview', m.deck_tour_preview(), m.deck_tour_preview_preview()),
          3: leaf('body', m.deck_tour_body(), m.deck_tour_body_preview()),
        },
      },
      2: {
        id: 'six',
        title: m.deck_tour_six(),
        preview: m.deck_tour_six_preview(),
        leaves: Object.fromEntries(
          directions.map((direction) => [
            direction,
            leaf(
              `six-${String(direction)}`,
              `${String(direction)} · ${directionName(direction)}`,
              '',
            ),
          ]),
        ),
      },
      3: { id: 'light', title: m.deck_tour_light(), preview: m.deck_tour_light_preview() },
      4: {
        id: 'warm',
        title: m.deck_tour_warm(),
        preview: m.deck_tour_warm_preview(),
        root: 'named',
      },
      5: { id: 'inside', title: m.deck_tour_inside(), preview: m.deck_tour_inside_preview() },
      6: { id: 'motion', title: m.deck_tour_motion(), preview: m.deck_tour_motion_preview() },
    },
    context: {
      1: { id: 'why-six', title: m.deck_tour_why_six(), preview: m.deck_tour_why_six_preview() },
      2: {
        id: 'why-hexes',
        title: m.deck_tour_why_hexes(),
        preview: m.deck_tour_why_hexes_preview(),
      },
    },
  }
}
