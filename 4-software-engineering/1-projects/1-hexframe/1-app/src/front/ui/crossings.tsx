// The crossings on /design-system (HEX-108), where one side answers the other, both ways: each drawn
// with both ends side by side, the chat's where the screen has it, on the left, then the canvas's. The
// pieces stay in their sides (the grill of 2026-10-11, Q7): each end is its side's `crossings.tsx`, on
// the chat's pieces and the canvas's, and this file only joins them, as home joins them through its
// route and the client bus (HEX-109, HEX-110): what passes between two ends is this state, nothing
// else. It sits at ui's root, outside the tiers, as the theme does, the one module of ui/ that imports
// both sides; what ui/ can't reach, Mapping's limit and how the timeline tells a navigation, the route
// hands it.
import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from './atoms/Toaster'
import { Canvas } from './canvas/Canvas'
import {
  actingThroughChat,
  CarryFrame,
  CrossingCanvas,
  draftOnCanvas,
  engineering,
  freeInEngineering,
  glinting,
  mentionablesIn,
  namedOf,
  proposalOnCanvas,
  startView,
  titleOf,
  toolingNamed,
  turnOnCanvas,
  type Glint,
} from './canvas/crossings'
import { tooling, ulysse } from './canvas/fixtures'
import type { Direction } from './canvas/geometry/geometry'
import { Rail } from './canvas/layouts/Rail'
import { pathTo, type TileNode } from './canvas/view/tiles'
import { centerOn, showView, type CanvasView, type ViewAction } from './canvas/view/view'
import { useComposerDemo } from './chat/composer/demo'
import {
  ComposerEnd,
  DraftingEnd,
  NamingLine,
  NavigationLines,
  ProposalEnd,
  TurnLines,
} from './chat/crossings'
import type { Happened } from './chat/entries/Events'
import type { Fate } from './chat/entries/Proposal'
import type { MentionProps } from './chat/text/Mention'
import type { TileKind } from './chat/widgets/tile/parts'
import { GallerySection, GalleryState, useSteps } from './gallery/frame'
import { Screen } from './layouts/screen/Screen'
import { useScreenState } from './layouts/screen/state/useScreenState'

/** How the conversation's timeline tells a run of gestures on the canvas, which home's words say. */
export type Tell = (gestures: readonly ViewAction[]) => Happened

/** A Message as the composer holds it: its words, and the links picked, each Tile and how it shows. */
interface Written {
  value: string
  links: readonly { id: string; shown: string }[]
}

/** Where the Turn answering a Message works, the canvas centered on `center`: Assistant's to say. */
export type Where = (message: Written, center: string) => string

/**
 * The crossings, in the catalogue's order: from the chat to the canvas, then from the canvas to the
 * chat, then on a phone. `previewLimit` is Mapping's, `tell` the timeline's, `where` Assistant's, all
 * the route's.
 */
export function CrossingsGallery(props: { previewLimit: number; tell: Tell; where: Where }) {
  return (
    <>
      <PointingCrossing />
      <AgentAtWorkCrossing />
      <ProposalCrossing />
      <DraftingCrossing previewLimit={props.previewLimit} />
      <NextTurnCrossing where={props.where} />
      <MenuCrossing />
      <NavigationCrossing tell={props.tell} />
      <DropCrossing />
      <PhoneCrossing />
    </>
  )
}

/**
 * A crossing's two ends, side by side as on the screen, one above the other once there is no room;
 * each as wide as its side, so a label longer in one language wraps rather than pushing the other end
 * below. Beside the canvas, the chat's end stands as tall, its lines at its foot as in the chat;
 * above it, as tall as its lines.
 */
function Ends(props: {
  chat: ReactNode
  chatLabel: string
  canvas: ReactNode
  canvasLabel?: string
}) {
  return (
    <>
      <div className="flex w-[23.4375rem] max-w-full self-stretch [&>figure]:flex-1 [&>figure]:grid-rows-[auto_1fr]">
        <GalleryState label={props.chatLabel}>
          <div className="flex flex-col justify-end gap-4">{props.chat}</div>
        </GalleryState>
      </div>
      <div className="w-[35rem] max-w-full">
        <GalleryState label={props.canvasLabel ?? m.crossing_state_canvas()}>
          {props.canvas}
        </GalleryState>
      </div>
    </>
  )
}

/** How the chat names Tooling while the System doesn't hold it: the agent's draft, or gone. */
type ToolingStanding = Exclude<NonNullable<MentionProps['standing']>, 'live'>

/**
 * A tile of the System as the chat names it, with its card, what a click on it and pointing at it do.
 * One the System doesn't hold is gone, struck through, but Tooling, which `standing` names: the
 * agent's draft while it is on its way, violet, its card saying where it will stand, which pointing at
 * lights where it waits; gone too once it will never come, a Proposal discarded or undone.
 */
const naming =
  (
    system: TileNode,
    act: { center?: (id: string) => void; point?: (id: string, pointing: boolean) => void },
    standing: ToolingStanding = 'draft',
  ) =>
  (id: string): MentionProps => {
    const pointing = act.point && { onPoint: (on: boolean) => act.point?.(id, on) }
    const named = namedOf(system, id)
    if (named !== undefined) {
      return { ...named, ...(act.center && { onCenter: () => act.center?.(id) }), ...pointing }
    }
    if (id !== tooling.id) return { title: titleOf(id), standing: 'gone' }
    // Tooling is no Tile of the fixture, whose titles `titleOf` reads.
    if (standing === 'gone') return { title: tooling.title, standing }
    return { ...toolingNamed, standing, ...pointing }
  }

/**
 * The tile pointed at, as each name's card opens and shuts: a card shutting clears its own tile only,
 * so going from one name to the next keeps the next one lit.
 */
const pointedWith =
  (setPointed: Dispatch<SetStateAction<string | undefined>>) => (id: string, pointing: boolean) => {
    setPointed((current) => (pointing ? id : current === id ? undefined : current))
  }

const mentionables = mentionablesIn(ulysse)

function PointingCrossing() {
  const [view, setView] = useState<CanvasView>(startView)
  const [pointed, setPointed] = useState<string>()
  const [arrived, setArrived] = useState<Glint>()
  const demo = useComposerDemo({ among: mentionables, listed: false })
  const named = naming(ulysse, {
    center: (id) => {
      setView(centerOn(ulysse, id))
      setArrived({ id, key: Date.now() })
    },
    point: pointedWith(setPointed),
  })
  const chat = (
    <>
      <NamingLine near={named('projects')} deep={named('hexframe')} beside={named('notes')} />
      <ComposerEnd demo={demo} onPoint={setPointed} />
    </>
  )
  const marks = { pointed, tile: glinting(arrived) }
  return (
    <GallerySection name="Pointing">
      <Ends
        chatLabel={m.crossing_state_pointing()}
        chat={chat}
        canvas={<CrossingCanvas view={view} onViewChange={setView} marks={marks} />}
      />
    </GallerySection>
  )
}

/** The tiles the agent's Turn touches, by their part in it, and their ids. */
const turnIds = {
  engineering,
  projects: 'projects',
  principles: 'principles',
  tooling: tooling.id,
  notes: 'notes',
}

type Part = Exclude<keyof typeof turnIds, 'notes'>

/** A beat of the sample Turn: when it comes, and what the Turn has done by then. */
interface TurnBeat {
  /** In ms from the Turn's start. */
  at: number
  /** How many of Software Engineering, Projects and Principles it has read, in that order. */
  read: number
  /** The tile it reads now. */
  reading?: Part
  writing?: boolean
  created?: boolean
  editing?: boolean
  edited?: boolean
  /** The tile it changed just now. */
  changed?: Part
  answered?: boolean
}

/**
 * The agent's Turn, each beat once, as both ends draw it, the chat telling it (`TurnLines`) and the
 * canvas marking it (`turnOnCanvas`): it reads Software Engineering, Projects and Principles, working
 * in Software Engineering; writes Tooling; Tooling is created as it edits Principles; Principles is
 * edited; it answers.
 */
const turn: readonly TurnBeat[] = [
  { at: 0, read: 0, reading: 'engineering' },
  { at: 900, read: 1, reading: 'projects' },
  { at: 1900, read: 2, reading: 'principles' },
  { at: 2900, read: 3, writing: true },
  { at: 4600, read: 3, created: true, editing: true, changed: 'tooling' },
  { at: 5800, read: 3, created: true, edited: true, changed: 'principles' },
  { at: 7000, read: 3, created: true, edited: true, answered: true },
]

const turnTimes = turn.map(({ at }) => at)

function AgentAtWorkCrossing() {
  const [run, setRun] = useState(0)
  const played = useSteps(turnTimes, run)
  // Nothing before the Turn first runs.
  const now = run === 0 ? undefined : turn[played]
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const [keyed, setKeyed] = useState(false)
  const [view, setView] = useState<CanvasView>(startView)
  const [at] = useState(() => new Date())
  const { system, marks } = turnOnCanvas(now, turnIds, seen, keyed)
  const chat = (
    <TurnLines
      told={now}
      tiles={mapped(turnIds, naming(system, {}))}
      keyed={keyed}
      at={at}
      onRun={() => {
        setRun(run + 1)
        setSeen(new Set())
      }}
      onKey={() => {
        setKeyed(true)
        setSeen(new Set([...seen].filter((id) => id !== 'notes')))
      }}
    />
  )
  const opened = (next: CanvasView, action: ViewAction) => {
    setView(next)
    setSeen(new Set(seen).add(action.tile))
  }
  return (
    <GallerySection name="AgentAtWork">
      <Ends
        chatLabel={m.crossing_state_turn()}
        chat={chat}
        canvasLabel={m.crossing_state_canvas_seen()}
        canvas={<CrossingCanvas system={system} view={view} onViewChange={opened} marks={marks} />}
      />
    </GallerySection>
  )
}

/** Each tile, by its role, as the chat names it. */
function mapped<Role extends string>(
  ids: Record<Role, string>,
  named: (id: string) => MentionProps,
) {
  return Object.fromEntries(
    Object.entries(ids).map(([role, id]) => [role, named(id as string)]),
  ) as Record<Role, MentionProps>
}

function ProposalCrossing() {
  const [fate, setFate] = useState<Fate>('open')
  const [undone, setUndone] = useState(false)
  const [pointed, setPointed] = useState<string>()
  const [view, setView] = useState<CanvasView>(startView)
  const [at] = useState(() => new Date())
  // What the canvas draws of it: what it would do while it waits, what it did once accepted.
  const shown = fate === 'open' ? 'waiting' : fate === 'accepted' && !undone ? 'landed' : 'gone'
  const { system, marks } = proposalOnCanvas(shown)
  const named = naming(
    system,
    { point: pointedWith(setPointed) },
    shown === 'gone' ? 'gone' : 'draft',
  )
  const ids = {
    tooling: tooling.id,
    principles: 'principles',
    notes: 'notes',
    reading: 'reading-list',
  }
  const chat = (
    <ProposalEnd
      tiles={{ ...mapped(ids, named), tidied: titleOf(engineering) }}
      fate={fate}
      undone={undone}
      at={at}
      onAccept={() => {
        setFate('accepted')
      }}
      onDiscard={() => {
        setFate('discarded')
      }}
      onUndo={() => {
        setUndone(true)
      }}
      onAgain={() => {
        setFate('open')
        setUndone(false)
      }}
    />
  )
  return (
    <GallerySection name="ProposalGhosts">
      <Ends
        chatLabel={m.crossing_state_proposal()}
        chat={chat}
        canvas={
          <CrossingCanvas
            system={system}
            view={view}
            onViewChange={setView}
            marks={{ ...marks, pointed }}
          />
        }
      />
    </GallerySection>
  )
}

function DraftingCrossing({ previewLimit }: { previewLimit: number }) {
  const [words, setWords] = useState({ title: tooling.title, preview: tooling.preview, body: '' })
  const [kind, setKind] = useState<TileKind>('branch')
  const [place, setPlace] = useState<Direction>(6)
  const [written, setWritten] = useState<Date>()
  const [view, setView] = useState<CanvasView>(startView)
  const draft = { kind, place, title: words.title }
  const { system, marks } = draftOnCanvas(draft, written?.getTime() ?? 0)
  const chat = (
    <DraftingEnd
      words={words}
      onWordsChange={setWords}
      where={{ parent: titleOf(engineering), kind, place, free: freeInEngineering }}
      onPlaceChange={setPlace}
      onKindChange={(next) => {
        setKind(next)
        // The canvas shows the ring the tile goes to: Software Engineering's Context, for a Context
        // Tile; its Children otherwise.
        setView(next === 'context' ? { ...startView, inner: 'context' } : startView)
      }}
      previewLimit={previewLimit}
      written={written}
      onCreate={() => {
        setWritten(new Date())
      }}
      onAgain={() => {
        setWritten(undefined)
      }}
    />
  )
  return (
    <GallerySection name="Drafting">
      <Ends
        chatLabel={m.crossing_state_drafting()}
        chat={chat}
        canvas={<CrossingCanvas system={system} view={view} onViewChange={setView} marks={marks} />}
      />
    </GallerySection>
  )
}

/** How long the sample Turn runs once sent, in ms: its working light, then its end. */
const sampleTurn = [0, 4000]

function NextTurnCrossing({ where }: { where: Where }) {
  const [view, setView] = useState<CanvasView>(startView)
  const [sent, setSent] = useState<{ id: string; at: number }>()
  const turn = useSteps(sampleTurn, sent?.at ?? 0)
  const working = sent !== undefined && turn === 0 ? sent.id : undefined
  const demo = useComposerDemo({ among: mentionables, listed: false })
  const center = view.center ?? ulysse.id
  // Where the Turn works, as Assistant decides it: the Tile the Message opens with, else the center.
  const location = where({ value: demo.value, links: demo.links }, center)
  const stop = () => {
    setSent(undefined)
  }
  const chat = (
    <ComposerEnd
      demo={demo}
      place={{ title: titleOf(location), first: location !== center }}
      running={working === undefined ? undefined : { stopping: false, stop }}
      onSend={() => {
        setSent({ id: location, at: Date.now() })
      }}
    />
  )
  const marks = { tile: (id: string) => (id === working ? { working: true } : undefined) }
  return (
    <GallerySection name="NextTurn">
      <Ends
        chatLabel={m.crossing_state_next_turn()}
        chat={chat}
        canvasLabel={m.crossing_state_canvas_center()}
        canvas={<CrossingCanvas view={view} onViewChange={setView} marks={marks} />}
      />
    </GallerySection>
  )
}

function MenuCrossing() {
  const [view, setView] = useState<CanvasView>(startView)
  const demo = useComposerDemo({ among: mentionables, listed: false })
  const acting = actingThroughChat({
    onAsk: (tile, where) => {
      demo.name(tile, {
        first: where === undefined ? '' : m.crossing_ask_for_one({ direction: where }),
      })
    },
    elsewhere: (said) => {
      toast(m.crossing_menu_elsewhere({ said }))
    },
  })
  return (
    <GallerySection name="MenuThroughChat">
      <Ends
        chatLabel={m.crossing_state_menu_chat()}
        chat={<ComposerEnd demo={demo} />}
        canvasLabel={m.crossing_state_canvas_menu()}
        canvas={<CrossingCanvas view={view} onViewChange={setView} {...acting} />}
      />
    </GallerySection>
  )
}

/** What the chat holds of the specimen's navigations: each run of gestures, and a Message between. */
type Entry = readonly ViewAction[] | 'said'

function NavigationCrossing({ tell }: { tell: Tell }) {
  const [view, setView] = useState<CanvasView>(startView)
  const [entries, setEntries] = useState<readonly Entry[]>([])
  const lines = entries.map((each) => (each === 'said' ? each : tell(each)))
  // A gesture joins the navigation under way, as home's sender merges it.
  const navigated = (next: CanvasView, action: ViewAction) => {
    setView(next)
    const last = entries.at(-1)
    const going = last === undefined || last === 'said' ? [] : last
    setEntries([...entries.slice(0, going.length === 0 ? entries.length : -1), [...going, action]])
  }
  const say = () => {
    setEntries([...entries, 'said'])
  }
  return (
    <GallerySection name="NavigationEntry">
      <Ends
        chatLabel={m.crossing_state_navigation_chat()}
        chat={<NavigationLines lines={lines} onSay={say} />}
        canvasLabel={m.crossing_state_canvas_navigation()}
        canvas={<CrossingCanvas view={view} onViewChange={navigated} />}
      />
    </GallerySection>
  )
}

function DropCrossing() {
  const [carried, setCarried] = useState<{ id: string; title: string }>()
  const demo = useComposerDemo({ among: mentionables, listed: false })
  const drop = () => {
    if (carried !== undefined) demo.name(carried, 'caret')
  }
  return (
    <GallerySection name="DropToName">
      <Ends
        chatLabel={m.crossing_state_drop_chat()}
        chat={<ComposerEnd demo={demo} carried={carried?.title} onDrop={drop} />}
        canvasLabel={m.crossing_state_canvas_drop()}
        canvas={<CarryFrame onCarry={setCarried} />}
      />
    </GallerySection>
  )
}

function PhoneCrossing() {
  const [view, setView] = useState<CanvasView>(startView)
  const [arrived, setArrived] = useState<Glint>()
  const { state: screen, actions: turning } = useScreenState()
  const demo = useComposerDemo({ among: mentionables, listed: false })
  const named = naming(ulysse, {
    center: (id) => {
      setView(centerOn(ulysse, id))
      setArrived({ id, key: Date.now() })
      turning.cross(m.crossing_phone_said({ title: titleOf(id) }))
    },
  })
  const canvas = (
    <Canvas
      system={ulysse}
      view={view}
      onViewChange={setView}
      marks={{ tile: glinting(arrived) }}
      className="flex-1 p-4 pb-8"
    />
  )
  return (
    <GallerySection name="PhoneGlance">
      <GalleryState label={m.crossing_state_phone()}>
        <Screen
          front={screen.front}
          onFrontChange={turning.turn}
          said={screen.said}
          className="h-[42rem] w-[23.4375rem] max-w-full"
          canvas={canvas}
          corner={
            <Rail
              steps={pathTo(ulysse, showView(ulysse, view).center.id)}
              onSelect={(tile) => {
                setView(centerOn(ulysse, tile))
              }}
            />
          }
          messages={
            <NamingLine near={named('projects')} deep={named('hexframe')} beside={named('notes')} />
          }
          composer={<ComposerEnd demo={demo} />}
        />
      </GalleryState>
    </GallerySection>
  )
}
