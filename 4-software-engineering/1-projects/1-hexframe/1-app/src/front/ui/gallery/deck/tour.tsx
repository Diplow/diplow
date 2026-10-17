// What the screen's slides show before any piece: on the chat's, the canvas is still a page of
// words about the chat, its two voices drawn as the chat draws them, its curve and what it lacks; on
// the canvas's, the first tile, alone and large, whose six tell what the canvas is, in the reader's
// language, read at render; and on the onboarding's, a new account's first visit, played on the
// whole screen as home plays it, into the agent's invitation to a first command and the journey it
// takes to the tutorial, whose center's words the agent tells a beat at a time, from the start again
// at will.
import { RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../atoms/controls/act'
import { Canvas, type CanvasMarks } from '../../canvas/Canvas'
import { Journey } from '../../canvas/layouts/Journey'
import { Rail } from '../../canvas/layouts/Rail'
import type { CanvasRules } from '../../canvas/state/useCanvasState'
import { directionName } from '../../canvas/tile/menu/verbs'
import { directions } from '../../canvas/geometry/geometry'
import { pathTo, type TileNode } from '../../canvas/view/tiles'
import { centerOn, showView, type CanvasView } from '../../canvas/view/view'
import { said } from '../../chat/samples'
import { tutorialInvitation } from '../../chat/composer/commands'
import { Message, Told, useTold, type ToldPart } from '../../chat/text/Message'
import { TileWidget } from '../../chat/widgets/tile/TileWidget'
import { ScreenSlide, type Go } from './Deck'

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

/**
 * The tutorial as home shows it at its arrival, which the route reads and hands on, since `ui/` can't
 * reach the feature that rules it (`features/shipped/tutorial/rules.ts`): its Tiles in the reader's
 * language, the view its rules show, and what they let through, on the canvas and to the composer.
 */
interface TutorialArrival extends CanvasRules {
  system: TileNode
  /** The composer, held back while it is not let through. */
  composer: boolean
  /** The agent tells its center's words in turn, as its rules have it at its arrival (HEX-120). */
  tells: boolean
  /** Its center's body, which the agent tells last, in the chat. */
  body: string
}

interface OnboardingSlideProps {
  onGo: Go
  /** The tutorial at its arrival; none while it is read, the invitation's click saying what it does. */
  tutorial?: TutorialArrival | undefined
}

/**
 * The onboarding, a new account's first visit, on the whole screen as home plays it
 * (`routes/index.tsx`, `features/system/widget/`), on the same pieces: the chat asking the pseudo
 * alone, its composer held back, the corner's mark alone, the untitled root its lamp, the pseudo
 * showing on it as it is typed; then, taken, the dawn, from the corner down, its receipt saying it
 * alone, as home's timeline leaves it to the receipt, and, once the composer rose, the agent's line
 * inviting the first command, `/tutorial` (`features/conversation/`'s `ChatInvitation`), whose click
 * takes the journey to the tutorial's center, alone and large, the corner naming it, nothing on it
 * answering and the composer held back, as the tutorial's rules have it at its arrival
 * (`features/shipped/tutorial/rules.ts`), the agent telling its words a beat at a time, its title
 * lit, then its preview, then its body in the chat (HEX-120), the corner's mark carrying the canvas
 * back to the root.
 * Played again from the start at will, the page landing anew. What changes on home's onboarding and
 * its journey changes here too.
 */
export function OnboardingSlide({ onGo, tutorial }: OnboardingSlideProps) {
  const [play, setPlay] = useState(0)
  return (
    <FirstVisit
      key={play}
      onGo={onGo}
      tutorial={tutorial}
      onAgain={() => {
        setPlay(play + 1)
      }}
    />
  )
}

/** The id of the reader's own tile, the Root. */
const yours = 'yours'

/** The pseudo taken, and when. */
interface Named {
  title: string
  at: Date
}

/**
 * The Root as home's canvas draws a new account's: an empty System waiting for a name or a vault,
 * the pseudo being typed showing on it, then named (`features/system/tree.ts`'s `canvasTree`).
 */
function rootOf(typed: string, named: Named | undefined): TileNode {
  if (named !== undefined) return { id: yours, title: named.title, preview: '', root: 'named' }
  return {
    id: yours,
    title: m.system_untitled(),
    preview: '',
    root: 'empty',
    ...(typed.trim() !== '' && { naming: typed }),
  }
}

interface FirstVisitProps {
  onGo: Go
  tutorial: TutorialArrival | undefined
  onAgain: () => void
}

/** One play of the onboarding, from the page landing, into the journey to the tutorial and back. */
function FirstVisit({ onGo, tutorial, onAgain }: FirstVisitProps) {
  const [typed, setTyped] = useState('')
  const [named, setNamed] = useState<Named>()
  const [view, setView] = useState<CanvasView>({})
  // Each thing done, which the mark turns whole at, as home's does: the pseudo taken, each gesture.
  const [done, setDone] = useState(0)
  // The tutorial reached by its command, the canvas its own until the corner's mark brings it back.
  const [away, setAway] = useState(false)
  const system = rootOf(typed, named)
  const there = away ? tutorial : undefined
  // Arrived, what the agent has told of the center's words, a beat at a time, as on home.
  const told = useTold(there?.tells === true)
  const went = (next: CanvasView) => {
    setView(next)
    setDone(done + 1)
  }
  const center = (id: string) => {
    went(centerOn(system, id))
  }
  // As home's: the tutorial at its Root, the root's view set aside; back, the root alone.
  const travel = (to: boolean) => {
    setAway(to)
    setView({})
    setDone(done + 1)
  }
  return (
    <ScreenSlide
      slide="onboarding"
      onGo={onGo}
      lines={<Again onAgain={onAgain} />}
      canvas={
        <Journey at={there === undefined ? 'home' : 'tutorial'}>
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
            {there === undefined ? (
              <Canvas
                system={system}
                view={view}
                onViewChange={went}
                looking
                className="min-h-0 flex-1"
              />
            ) : (
              <Canvas
                system={there.system}
                view={there.view}
                onViewChange={() => undefined}
                looking={there.looking}
                lets={there.lets}
                marks={toldOn(there, told)}
                className="min-h-0 flex-1"
              />
            )}
          </div>
        </Journey>
      }
      corner={
        // The mark alone until the pseudo is taken, then the path coming down from it; in the
        // tutorial, its center named, the mark the way back.
        there === undefined ? (
          <Rail
            steps={named === undefined ? [] : pathTo(system, showView(system, view).center.id)}
            onSelect={center}
            turns={done}
          />
        ) : (
          <Rail
            steps={pathTo(there.system, showView(there.system, there.view).center.id)}
            onSelect={() => undefined}
            turns={done}
            onHome={() => {
              travel(false)
            }}
          />
        )
      }
      composerAway={named === undefined || there?.composer === false}
      foot={
        // As home's chat: the tile widget, which goes from question to receipt, one widget so the
        // focus goes along; the timeline leaves the pseudo taken to the receipt.
        named === undefined ? (
          <TileWidget
            mode="name"
            name={typed}
            onNameChange={setTyped}
            onName={() => {
              const title = typed.trim()
              if (title === '') return
              setNamed({ title, at: new Date() })
              setDone(done + 1)
            }}
            onImport={said(m.widget_tile_name_import())}
            takesFocus
          />
        ) : (
          <>
            <TileWidget
              mode="done"
              did="named"
              tile={{
                title: named.title,
                onCenter: () => {
                  center(yours)
                },
              }}
              at={named.at}
            />
            <Message
              voice="agent"
              words={tutorialInvitation(
                tutorial === undefined
                  ? said(m.composer_command_tutorial_does())
                  : () => {
                      travel(true)
                    },
              )}
              dawning
            />
            {there !== undefined && <Told told={told} body={[there.body]} />}
          </>
        )
      }
    />
  )
}

/** The part of the tutorial's center's words the agent tells of, on its canvas as on home's. */
function toldOn(there: TutorialArrival, told: ToldPart | undefined): CanvasMarks | undefined {
  if (told === undefined) return undefined
  const center = showView(there.system, there.view).center.id
  return { tile: (id) => (id === center ? { told } : undefined) }
}

/** Plays the onboarding again from the start, the page landing anew. */
function Again({ onAgain }: { onAgain: () => void }) {
  return (
    <Act className="justify-self-start" icon={<RotateCcw />} onClick={onAgain}>
      {m.deck_onboarding_again()}
    </Act>
  )
}
