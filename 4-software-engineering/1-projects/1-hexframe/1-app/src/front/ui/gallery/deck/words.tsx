// The deck's first two slides, words on the ground alone, before there is a screen: why hexframe
// exists, beside a sun drawn in the root's warm light, since each person is one in hexframe's
// universe; then the six principles its look follows, which rise one after another. The screen comes
// with the slide after, the chat first.
import { cn } from 'cn'
import type { CSSProperties } from 'react'

import { m } from '#/paraglide/messages'

import { Brand, cornerPlace } from '../../layouts/screen/Screen'
import { DeckRail, WayOn, type Go } from './Deck'

/** A slide of words, on the ground alone: the brand, the corner, the words, the way on. */
export function WordsSlide({ slide, onGo }: { slide: 'why' | 'principles'; onGo: Go }) {
  return (
    <main className="@container relative isolate h-dvh overflow-x-hidden overflow-y-auto bg-background">
      {slide === 'why' && <Sun />}
      <Brand />
      <DeckRail slide={slide} onGo={onGo} className={cn(cornerPlace, 'z-10')} />
      <div className="relative mx-auto grid min-h-[calc(100%-4rem)] w-full max-w-6xl content-center gap-10 px-6 pt-28 pb-12 @wide:px-[8%] @wide:pt-12">
        {slide === 'why' ? <Thesis /> : <Principles />}
        <div className="max-w-2xl">
          <WayOn slide={slide} onGo={onGo} />
        </div>
      </div>
    </main>
  )
}

/** Each part rises after the one before it: the slide's own entrance, motion telling its order. */
const rise = (step: number): CSSProperties => ({ animationDelay: `${String(step * 90)}ms` })

/** Why hexframe exists: intelligence is common, experience is not, and each person is a sun. */
function Thesis() {
  return (
    <article className="grid max-w-2xl gap-7">
      <h1 className="grid gap-5">
        <span
          className="font-agent text-[0.75rem] tracking-wide text-faint motion-safe:animate-rise"
          style={rise(0)}
        >
          {m.deck_title_why()}
        </span>
        <span
          className="font-human text-[clamp(2.25rem,5cqw,3.75rem)] leading-[1.08] font-light text-balance motion-safe:animate-rise"
          style={rise(1)}
        >
          {m.deck_why_title()}
        </span>
      </h1>
      {[m.deck_why_1, m.deck_why_2, m.deck_why_3].map((said, index) => (
        <p
          key={index}
          className="max-w-[36em] font-human text-[1.1875rem] leading-[1.6] font-light text-muted-foreground motion-safe:animate-rise"
          style={rise(index + 2)}
        >
          {said()}
        </p>
      ))}
      <p
        className="max-w-[30em] border-l border-human/70 pl-5 font-human text-[1.4375rem] leading-[1.45] font-light text-foreground italic motion-safe:animate-rise"
        style={rise(5)}
      >
        {m.deck_why_sun()}
      </p>
    </article>
  )
}

/** The six principles, in the order the screen answers them, each with what it means. */
const principles = [
  { title: m.design_system_principle_space, text: m.design_system_principle_space_text },
  { title: m.design_system_principle_light, text: m.design_system_principle_light_text },
  { title: m.design_system_principle_root, text: m.design_system_principle_root_text },
  { title: m.design_system_principle_voices, text: m.design_system_principle_voices_text },
  { title: m.design_system_principle_curves, text: m.design_system_principle_curves_text },
  { title: m.design_system_principle_motion, text: m.design_system_principle_motion_text },
]

/** The look's direction, then its six principles, numbered as the six around a tile are. */
function Principles() {
  return (
    <article className="grid gap-10">
      <header className="grid max-w-3xl gap-4">
        <p className="font-agent text-[0.75rem] tracking-wide text-faint motion-safe:animate-rise">
          {m.deck_principles_kicker()}
        </p>
        <h1
          className="font-human text-[clamp(2.25rem,5cqw,3.75rem)] leading-[1.08] font-light motion-safe:animate-rise"
          style={rise(1)}
        >
          {m.deck_title_principles()}
        </h1>
        <p
          className="max-w-[40em] font-human text-[1.1875rem] leading-[1.6] font-light text-muted-foreground motion-safe:animate-rise"
          style={rise(2)}
        >
          {m.deck_principles_intro()}
        </p>
      </header>
      <ol className="grid gap-x-12 gap-y-8 @wide:grid-cols-2 @4xl:grid-cols-3">
        {principles.map(({ title, text }, index) => (
          <li
            key={index}
            className="relative grid content-start gap-2 pt-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-input before:to-transparent before:content-[''] motion-safe:animate-rise"
            style={rise(index + 3)}
          >
            <span className="font-agent text-[0.6875rem] text-faint">{index + 1}</span>
            <h2 className="font-human text-[1.375rem] leading-snug font-light">{title()}</h2>
            <p className="text-[0.9375rem] leading-relaxed font-light text-muted-foreground">
              {text()}
            </p>
          </li>
        ))}
      </ol>
      <p
        className="text-[0.875rem] font-light text-muted-foreground motion-safe:animate-rise"
        style={rise(9)}
      >
        {m.deck_principles_light()}
      </p>
    </article>
  )
}

/** A hex's points, pointy on top, around the origin. */
const hex = (radius: number) =>
  [-90, -30, 30, 90, 150, 210]
    .map((degrees) => {
      const radians = (degrees * Math.PI) / 180
      return `${(radius * Math.cos(radians)).toFixed(2)},${(radius * Math.sin(radians)).toFixed(2)}`
    })
    .join(' ')

/** The worlds turning round the sun, each on its own orbit, at its own pace. */
const worlds = [
  { orbit: 58, size: 3.4, turn: '140s', from: 20 },
  { orbit: 74, size: 2.6, turn: '220s', from: 200 },
  { orbit: 88, size: 2, turn: '320s', from: 110 },
]

/**
 * A sun in the root's warm light, the user's in hexframe's universe: its glow, the brand's hex at
 * its heart, and what they understand turning round it on hairline orbits. Still with reduced motion.
 */
function Sun() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 right-[-14%] -z-10 aspect-square w-[min(118vh,62rem)] -translate-y-1/2 @max-wide:top-[calc(4rem-50cqw)] @max-wide:right-[-50cqw] @max-wide:w-[100cqw] @max-wide:translate-y-0 @max-wide:opacity-70"
    >
      <div
        className="absolute inset-0 motion-safe:animate-[rise_1.6s_var(--ease-glide)_both]"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--halo) 55%, transparent) 0%, color-mix(in oklab, var(--halo) 26%, transparent) 9%, color-mix(in oklab, var(--aura) 14%, transparent) 22%, transparent 48%)',
        }}
      />
      {/* The orbits fade toward the words, so no line runs through them. */}
      <svg
        viewBox="-100 -100 200 200"
        className="absolute inset-0 size-full overflow-visible [mask-image:linear-gradient(to_right,transparent_12%,black_50%)]"
      >
        {worlds.map(({ orbit, size, turn, from }) => (
          <g key={orbit}>
            <circle
              r={orbit}
              fill="none"
              stroke="var(--input)"
              strokeOpacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
            <g
              className="motion-safe:animate-[spin_var(--turn)_linear_infinite]"
              style={
                {
                  '--turn': turn,
                  transformOrigin: '0 0',
                  rotate: `${String(from)}deg`,
                } as CSSProperties
              }
            >
              <polygon
                points={hex(size)}
                transform={`translate(${String(orbit)} 0)`}
                fill="var(--tile-lit)"
                stroke="var(--input)"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        ))}
        <polygon
          points={hex(9)}
          fill="color-mix(in oklab, var(--human) 18%, transparent)"
          stroke="var(--human)"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
