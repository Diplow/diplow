// The tile widget on /design-system, each state live on the chat's sample tiles: a new account's
// pseudo; write a tile in the place clicked, its preview then its page coming as each is validated,
// create it and undo it; edit one, delete it; take the agent's draft; meet a tile
// changed meanwhile; import a vault and export a tile. What would reach the server shows in a toast;
// what Mapping would refuse is the demo's (`../demo.ts`).
import { ClientOnly } from '@tanstack/react-router'
import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../../atoms/controls/act'
import { Skeleton } from '../../../atoms/skeleton'
import { GalleryColumn, GallerySection, GalleryState } from '../../../gallery/frame'
import { said, sampleTiles } from '../../samples'
import { editedOf, freeFor, stillRefused, tileRefusalOf } from '../demo'
import {
  agentsEdit,
  agentsWords,
  faultPaths,
  leftOutPaths,
  longPreview,
  meanwhile,
  newBranch,
  standing,
  tooling,
  yours,
} from './fixtures'
import type { TileField, TilePlace, TileWords } from './parts'
import { TileProposal } from './Proposal'
import { TileWidget } from './TileWidget'
import { TileExport, TileImport } from './Transfer'

/** The tile widget's section, the Preview's limit Mapping's, which the route reads at its door. */
export function TileWidgetGallery({ previewLimit }: { previewLimit: number }) {
  return (
    <GallerySection name="TileWidget">
      <GalleryState label={m.gallery_state_tile_name()}>
        <GalleryColumn>
          <NameSpecimen />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_new()}>
        <GalleryColumn>
          <NewTileSpecimen previewLimit={previewLimit} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_widget_context()}>
        <GalleryColumn>
          <NewTileSpecimen
            previewLimit={previewLimit}
            where={{ ...newBranch(), kind: 'context', place: 2, free: freeFor.context }}
          />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_widget_refused()}>
        <GalleryColumn>
          <NewTileSpecimen
            previewLimit={previewLimit}
            words={{ ...tooling(), preview: longPreview() }}
            refused={{ preview: m.error_mapping_preview_too_long() }}
          />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_edit()}>
        <GalleryColumn>
          <EditSpecimen previewLimit={previewLimit} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_changed()}>
        <GalleryColumn>
          <ChangedSpecimen previewLimit={previewLimit} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_widget_draft()}>
        <GalleryColumn>
          <ProposalSpecimen kind="draft" previewLimit={previewLimit} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_proposed()}>
        <GalleryColumn>
          <ProposalSpecimen kind="edit" previewLimit={previewLimit} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_import()}>
        <GalleryColumn>
          <ImportSpecimen />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_import_landed()}>
        <GalleryColumn>
          <TileImport
            into={newBranch()}
            phase="landed"
            tiles={14}
            leftOut={leftOut()}
            {...importCalls}
          />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_import_refused()}>
        <GalleryColumn>
          <TileImport
            into={newBranch()}
            phase="refused"
            faults={faultPaths.map((where, index) => ({ where, why: faults[index]?.() ?? '' }))}
            leftOut={leftOut()}
            {...importCalls}
          />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_export()}>
        <GalleryColumn>
          <ExportSpecimen />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_export_failed()}>
        <GalleryColumn>
          <ExportSpecimen failed />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <NewTileSpecimen previewLimit={previewLimit} words={tooling()} />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

const leftOutReasons = [
  m.system_import_reason_dot_file,
  m.system_import_reason_excluded,
  m.system_import_reason_binary,
]
/** What the sample import left out, each path with why. */
const leftOut = () =>
  leftOutPaths.map((where, index) => ({ where, why: leftOutReasons[index]?.() ?? '' }))
const faults = [m.system_import_fault_ring_overflows, m.system_import_fault_preview_too_long]

/** The sample tile as the conversation names it: a click says the canvas would center on it. */
const toolingNamed = () => sampleTiles().tooling.tile

/** Runs a step after a moment, the one before it dropped, and none once the page leaves. */
function useLater() {
  const waiting = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(waiting.current)
    },
    [],
  )
  return (step: () => void, ms: number) => {
    clearTimeout(waiting.current)
    waiting.current = setTimeout(step, ms)
  }
}

/** Comes in again, to see its entrance, or after its receipt. */
function Again({ onAgain }: { onAgain: () => void }) {
  return (
    <Act className="justify-self-start" onClick={onAgain}>
      <RotateCcw className="size-3" />
      {m.gallery_widget_replay()}
    </Act>
  )
}

// A new tile, live: its words, its kind and its place are the specimen's; Create checks what Mapping
// would, and either puts the words back with the refusal or leaves the receipt, which Undo takes back.
function NewTileSpecimen({
  previewLimit,
  where: firstWhere = newBranch(),
  words: firstWords = { title: '', preview: '', body: '' },
  refused: firstRefusal,
}: {
  previewLimit: number
  where?: TilePlace
  words?: TileWords
  refused?: Partial<Record<TileField, string>>
}) {
  const [now] = useState(() => new Date())
  const [words, setWords] = useState(firstWords)
  const [where] = useState(firstWhere)
  const [refused, setRefused] = useState(firstRefusal)
  const [created, setCreated] = useState(false)
  const [entrance, setEntrance] = useState(0)
  const again = () => {
    setCreated(false)
    setEntrance(entrance + 1)
  }
  return (
    <>
      {/* One widget, by one key, from form to receipt, so the receipt can take the form's focus. */}
      {created ? (
        <TileWidget
          key={entrance}
          mode="done"
          did="created"
          tile={{ ...toolingNamed(), title: words.title }}
          where={where}
          at={now}
          onUndo={again}
        />
      ) : (
        <TileWidget
          key={entrance}
          mode="new"
          where={where}
          takesFocus={entrance > 0}
          words={words}
          previewLimit={previewLimit}
          onWordsChange={(next) => {
            setWords(next)
            setRefused(stillRefused(refused, words, next))
          }}
          refused={refused}
          onCreate={() => {
            const refusal = tileRefusalOf(words, previewLimit)
            setRefused(refusal)
            if (refusal === undefined) setCreated(true)
          }}
          onImport={said(m.system_import_here())}
          onExpand={said(m.widget_tile_expand())}
          onCancel={again}
        />
      )}
      <Again onAgain={again} />
    </>
  )
}

/** A new account's first question, its pseudo, then the receipt naming its own tile. */
function NameSpecimen() {
  const [now] = useState(() => new Date())
  const [name, setName] = useState('')
  const [named, setNamed] = useState(false)
  const [entrance, setEntrance] = useState(0)
  const again = () => {
    setNamed(false)
    setName('')
    setEntrance(entrance + 1)
  }
  return (
    <>
      {named ? (
        <TileWidget
          key={entrance}
          mode="done"
          did="named"
          tile={{ title: name }}
          at={now}
          onUndo={again}
        />
      ) : (
        <TileWidget
          key={entrance}
          mode="name"
          name={name}
          onNameChange={setName}
          onName={() => {
            if (name.trim() !== '') setNamed(true)
          }}
          onLater={again}
          onImport={said(m.widget_tile_name_import())}
          takesFocus={entrance > 0}
        />
      )}
      <Again onAgain={again} />
    </>
  )
}

function EditSpecimen({ previewLimit }: { previewLimit: number }) {
  const [now] = useState(() => new Date())
  const [words, setWords] = useState(yours)
  const [state, setState] = useState<'editing' | 'saved' | 'deleted'>('editing')
  if (state !== 'editing') {
    return (
      <TileWidget
        mode="done"
        did={state === 'saved' ? 'edited' : 'deleted'}
        tile={{
          ...toolingNamed(),
          title: words.title,
          ...(state === 'deleted' && { standing: 'gone' }),
        }}
        where={standing()}
        at={now}
        onUndo={() => {
          setState('editing')
        }}
      />
    )
  }
  return (
    <TileWidget
      mode="edit"
      where={standing()}
      words={words}
      previewLimit={previewLimit}
      onWordsChange={setWords}
      edited={editedOf(words, tooling())}
      refused={tileRefusalOf(words, previewLimit)}
      onSave={() => {
        if (tileRefusalOf(words, previewLimit) === undefined) setState('saved')
      }}
      onDelete={{
        below: 4,
        confirm: () => {
          setState('deleted')
        },
      }}
      onCancel={said(m.ui_cancel())}
    />
  )
}

function ChangedSpecimen({ previewLimit }: { previewLimit: number }) {
  const [words, setWords] = useState(yours)
  const [comparing, setComparing] = useState(false)
  const { by, compared } = meanwhile()
  return (
    <TileWidget
      mode="edit"
      where={standing()}
      words={words}
      previewLimit={previewLimit}
      onWordsChange={setWords}
      edited={editedOf(words, tooling())}
      onSave={said(m.system_save())}
      onCancel={said(m.ui_cancel())}
      changed={{
        by,
        fields: ['preview'],
        when: m.gallery_tile_a_minute_ago(),
        onSaveOver: said(m.widget_tile_save_over()),
        onTakeTheirs: said(m.widget_tile_take_theirs()),
        onCompare: () => {
          setComparing(!comparing)
        },
        compared: comparing ? compared : undefined,
      }}
    />
  )
}

// The agent's draft or edit: Accept leaves its receipt, Edit it hands it to the user's widget, whose
// Save leaves the user's own receipt.
function ProposalSpecimen({
  kind,
  previewLimit,
}: {
  kind: 'draft' | 'edit'
  previewLimit: number
}) {
  const [now] = useState(() => new Date())
  const [state, setState] = useState<'open' | 'accepted' | 'discarded' | 'taken' | 'saved'>('open')
  const [words, setWords] = useState(kind === 'draft' ? tooling : agentsWords)
  const where = kind === 'draft' ? newBranch() : standing()
  const tile = toolingNamed()
  if (state === 'taken' || state === 'saved') {
    return state === 'saved' ? (
      <TileWidget
        mode="done"
        did={kind === 'draft' ? 'created' : 'edited'}
        tile={tile}
        where={where}
        at={now}
        onUndo={() => {
          setState('open')
        }}
      />
    ) : (
      <TileWidget
        mode="edit"
        taken
        where={where}
        words={words}
        previewLimit={previewLimit}
        onWordsChange={setWords}
        edited={[]}
        onSave={() => {
          setState('saved')
        }}
        onCancel={() => {
          setState('open')
        }}
      />
    )
  }
  const decisions = {
    where,
    tile,
    fate: state,
    at: now,
    onAccept: () => {
      setState('accepted')
    },
    onEdit: () => {
      setState('taken')
    },
    onDiscard: () => {
      setState('discarded')
    },
    onUndo: () => {
      setState('open')
    },
  }
  return kind === 'draft' ? (
    <TileProposal kind="draft" words={tooling()} {...decisions} />
  ) : (
    <TileProposal kind="edit" changes={agentsEdit()} {...decisions} />
  )
}

const importCalls = {
  onDrop: said(m.system_import_working()),
  onPickFolder: said(m.system_import_pick_folder()),
  onPickFile: said(m.system_import_pick_zip()),
  onAgain: said(m.system_import_again()),
  onDone: said(m.keys_done()),
}

// An import into a free place: a pick or a drop works a moment, then lands.
function ImportSpecimen() {
  const [phase, setPhase] = useState<'choosing' | 'importing' | 'landed'>('choosing')
  const later = useLater()
  const run = () => {
    setPhase('importing')
    later(() => {
      setPhase('landed')
    }, 1600)
  }
  const again = () => {
    setPhase('choosing')
  }
  return phase === 'landed' ? (
    <TileImport into={newBranch()} phase="landed" tiles={14} leftOut={leftOut()} onDone={again} />
  ) : (
    <TileImport
      into={newBranch()}
      phase={phase}
      onDrop={run}
      onPickFolder={run}
      onPickFile={run}
      onDone={again}
    />
  )
}

// An export: it works a moment, then leaves its receipt; or it fails, and Try again works again. Only
// the browser draws it, as the receipt's time is the reader's.
function ExportSpecimen({ failed = false }: { failed?: boolean }) {
  const [now] = useState(() => new Date())
  const [phase, setPhase] = useState<'working' | 'done' | 'failed'>(failed ? 'failed' : 'done')
  const later = useLater()
  const run = () => {
    setPhase('working')
    later(() => {
      setPhase(failed ? 'failed' : 'done')
    }, 1400)
  }
  return (
    <ClientOnly fallback={<Skeleton className="h-12 w-full" />}>
      <TileExport
        tile={toolingNamed()}
        below={12}
        phase={phase}
        file="tooling.zip"
        reason={m.error_mapping_tile_not_found()}
        at={now}
        onRetry={run}
        onDismiss={said(m.ui_widget_dismiss())}
      />
      {!failed && <Again onAgain={run} />}
    </ClientOnly>
  )
}
