// The crossings on /design-system (HEX-108), where one side answers the other, both ways: each drawn
// with both ends side by side, the chat's where the screen has it, on the left, then the canvas's. The
// pieces stay in their sides (the grill of 2026-10-11, Q7): each end is its side's `crossings.tsx`, on
// the chat's pieces and the canvas's, and this file only joins them, as home joins them through its
// route and the client bus (HEX-109, HEX-110): what passes between two ends is this state, nothing
// else. It sits at ui's root, outside the tiers, as the theme does, the one module of ui/ that imports
// both sides; what ui/ can't reach, Mapping's limit and how the timeline tells a navigation, the route
// hands it.
import { useState, type ReactNode } from 'react'

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
  mentionablesOf,
  namedOf,
  proposalOnCanvas,
  startView,
  titleOf,
  turnOnCanvas,
  type Glint,
  type ProposalFate,
} from './canvas/crossings'
import { tooling, ulysse } from './canvas/fixtures'
import type { Direction } from './canvas/geometry/geometry'
import { Rail } from './canvas/layouts/Rail'
import { useSteps } from './canvas/tile/gallery'
import { pathTo, type TileNode } from './canvas/view/tiles'
import { centerOn, showView, type CanvasView, type ViewAction } from './canvas/view/view'
import { namedAt, namedFirst } from './chat/composer/commands'
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
import type { MentionProps } from './chat/text/Mention'
import type { TileKind } from './chat/widgets/tile/parts'
import { GallerySection, GalleryState } from './gallery/frame'
import { Screen } from './layouts/screen/Screen'
import { useScreenState } from './layouts/screen/state/useScreenState'

/** How the conversation's timeline tells a run of gestures on the canvas, which home's words say. */
export type Tell = (gestures: readonly ViewAction[]) => Happened

/**
 * The crossings, in the catalogue's order: from the chat to the canvas, then from the canvas to the
 * chat, then on a phone. `previewLimit` is Mapping's, `tell` the timeline's, both the route's.
 */
export function CrossingsGallery({ previewLimit, tell }: { previewLimit: number; tell: Tell }) {
  return (
    <>
      <PointingCrossing />
      <AgentAtWorkCrossing />
      <ProposalCrossing />
      <DraftingCrossing previewLimit={previewLimit} />
      <NextTurnCrossing />
      <MenuCrossing />
      <NavigationCrossing tell={tell} />
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

/**
 * A tile of the System as the chat names it, with its card, what a click on it and pointing at it do;
 * one not there yet, Tooling, is the agent's draft, violet.
 */
const naming =
  (system: TileNode, act: { center?: (id: string) => void; point?: (id?: string) => void }) =>
  (id: string): MentionProps => ({
    ...(namedOf(system, id) ?? { title: tooling.title, standing: 'draft' }),
    ...(act.center && { onCenter: () => act.center?.(id) }),
    ...(act.point && { onPoint: (pointing: boolean) => act.point?.(pointing ? id : undefined) }),
  })

const mentionables = mentionablesOf(ulysse)

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
    point: setPointed,
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

/** When each step of the agent's Turn comes, in ms from its start (`turnOnCanvas`, `TurnLines`). */
const turnSteps = [0, 900, 1900, 2900, 4600, 5800, 7000]

function AgentAtWorkCrossing() {
  const [run, setRun] = useState(0)
  const played = useSteps(turnSteps, run)
  const step = run === 0 ? 0 : played + 1
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const [keyed, setKeyed] = useState(false)
  const [view, setView] = useState<CanvasView>(startView)
  const [at] = useState(() => new Date())
  const { system, marks } = turnOnCanvas(step, seen, keyed)
  const named = naming(system, {})
  const ids = { engineering, projects: 'projects', principles: 'principles', notes: 'notes' }
  const tiles = { ...mapped(ids, named), tooling: named(tooling.id) }
  const chat = (
    <TurnLines
      step={step}
      tiles={tiles}
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
  const [fate, setFate] = useState<ProposalFate>('open')
  const [undone, setUndone] = useState(false)
  const [pointed, setPointed] = useState<string>()
  const [view, setView] = useState<CanvasView>(startView)
  const [at] = useState(() => new Date())
  const { system, marks } = proposalOnCanvas(fate, undone)
  const named = naming(system, { point: setPointed })
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
  const { system, marks } = draftOnCanvas({ place, title: words.title }, written?.getTime() ?? 0)
  const chat = (
    <DraftingEnd
      words={words}
      onWordsChange={setWords}
      where={{ parent: titleOf(engineering), kind, place, free: freeInEngineering }}
      onPlaceChange={setPlace}
      onKindChange={setKind}
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

function NextTurnCrossing() {
  const [view, setView] = useState<CanvasView>(startView)
  const [sent, setSent] = useState<{ id: string; at: number }>()
  const turn = useSteps(sampleTurn, sent?.at ?? 0)
  const working = sent !== undefined && turn === 0 ? sent.id : undefined
  const demo = useComposerDemo({ among: mentionables, listed: false })
  // The Tile the Message opens with: where the Turn works, as Assistant decides it.
  const first = demo.composer.marks.find((mark) => mark.kind === 'tile' && mark.from === 0)
  const opening =
    first &&
    mentionables.find(({ title }) => `@${title}` === demo.value.slice(first.from, first.to))
  const center = view.center ?? ulysse.id
  const stop = () => {
    setSent(undefined)
  }
  const chat = (
    <ComposerEnd
      demo={demo}
      place={{ title: opening?.title ?? titleOf(center), first: opening !== undefined }}
      running={working === undefined ? undefined : { stopping: false, stop }}
      onSend={() => {
        setSent({ id: opening?.id ?? center, at: Date.now() })
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
    onAsk: (title, where) => {
      const asked = namedFirst(
        demo.value,
        title,
        where && m.crossing_ask_for_one({ direction: where }),
      )
      demo.edit(asked.value, asked.caret, true)
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
type Told = readonly ViewAction[] | 'said'

function NavigationCrossing({ tell }: { tell: Tell }) {
  const [view, setView] = useState<CanvasView>(startView)
  const [told, setTold] = useState<readonly Told[]>([])
  const lines = told.map((each) => (each === 'said' ? each : tell(each)))
  // A gesture joins the navigation under way, as home's sender merges it.
  const navigated = (next: CanvasView, action: ViewAction) => {
    setView(next)
    const last = told.at(-1)
    const going = last === undefined || last === 'said' ? [] : last
    setTold([...told.slice(0, going.length === 0 ? told.length : -1), [...going, action]])
  }
  const say = () => {
    setTold([...told, 'said'])
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
  const [carried, setCarried] = useState<string>()
  const demo = useComposerDemo({ among: mentionables, listed: false })
  const drop = () => {
    if (carried === undefined) return
    const named = namedAt(demo.value, demo.caret, carried)
    demo.edit(named.value, named.caret, true)
  }
  return (
    <GallerySection name="DropToName">
      <Ends
        chatLabel={m.crossing_state_drop_chat()}
        chat={<ComposerEnd demo={demo} carried={carried} onDrop={drop} />}
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
