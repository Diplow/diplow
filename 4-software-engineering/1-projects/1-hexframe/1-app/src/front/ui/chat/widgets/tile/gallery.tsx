// The tile widget on /design-system, each state live on the fixture System: write a tile, pick its
// place on the map, create it and undo it; edit one, delete it; take the agent's draft; meet a tile
// changed meanwhile; import a vault and export a tile. What would reach the server shows in a toast.
import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../../atoms/controls/act'
import { toast } from '../../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../../gallery/frame'
import type { Place } from '../Places'
import { countOf } from '../count'
import {
  agentsEdit,
  faultPaths,
  leftOutPaths,
  longPreview,
  meanwhile,
  newBranch,
  parent,
  standing,
  tooling,
} from './fixtures'
import {
  previewLimit,
  type TileField,
  type TileKind,
  type TilePlace,
  type TileWords,
} from './parts'
import { TileProposal } from './Proposal'
import { TileWidget } from './TileWidget'
import { TileExport, TileImport } from './Transfer'

export function TileWidgetGallery() {
  return (
    <GallerySection name="TileWidget">
      <GalleryState label={m.gallery_state_tile_new()}>
        <Column>
          <NewTileSpecimen />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_context()}>
        <Column>
          <NewTileSpecimen kind="context" />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_refused()}>
        <Column>
          <NewTileSpecimen
            words={{ ...tooling, preview: longPreview }}
            refused={{ preview: m.error_mapping_preview_too_long() }}
          />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_edit()}>
        <Column>
          <EditSpecimen />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_changed()}>
        <Column>
          <ChangedSpecimen />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_draft()}>
        <Column>
          <ProposalSpecimen kind="draft" />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_proposed()}>
        <Column>
          <ProposalSpecimen kind="edit" />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_import()}>
        <Column>
          <ImportSpecimen />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_import_landed()}>
        <Column>
          <TileImport
            into={newBranch}
            phase="landed"
            tiles={14}
            leftOut={leftOutPaths.map((where, index) => ({
              where,
              why:
                [
                  m.system_import_reason_dot_file,
                  m.system_import_reason_excluded,
                  m.system_import_reason_binary,
                ][index]?.() ?? '',
            }))}
            {...importCalls}
          />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_import_refused()}>
        <Column>
          <TileImport
            into={newBranch}
            phase="refused"
            faults={faultPaths.map((where, index) => ({
              where,
              why:
                [m.system_import_fault_ring_overflows, m.system_import_fault_preview_too_long][
                  index
                ]?.() ?? '',
            }))}
            {...importCalls}
          />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_export()}>
        <Column>
          <ExportSpecimen />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_export_failed()}>
        <Column>
          <TileExport
            title={tooling.title}
            below={12}
            phase="failed"
            reason={m.error_mapping_tile_not_found()}
            onRetry={said(m.ui_retry())}
            onDismiss={said(m.ui_widget_dismiss())}
          />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <Column phone>
          <NewTileSpecimen words={tooling} />
        </Column>
      </GalleryState>
    </GallerySection>
  )
}

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

/** What a real page would send, said in a toast. */
const said = (what: string) => () => {
  toast(what)
}

/** The conversation's column, or a phone's. */
function Column({ phone = false, children }: { phone?: boolean; children: ReactNode }) {
  return (
    <div
      className={
        phone ? 'grid w-[23.4375rem] max-w-full gap-4' : 'grid w-[37.5rem] max-w-full gap-4'
      }
    >
      {children}
    </div>
  )
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

/** The places free for each kind under Software engineering: a Leaf's and a Context's are their own. */
const freeFor: Record<TileKind, readonly Place[]> = {
  branch: [4, 5, 6],
  leaf: [1, 2, 3, 5, 6],
  context: [2, 3, 4, 5, 6],
}

/** What Mapping would refuse before sending: no title, a preview past its limit. */
function refusalOf(words: TileWords): Partial<Record<TileField, string>> | undefined {
  const refused = {
    ...(words.title.trim() === '' && { title: m.error_mapping_title_missing() }),
    ...(countOf(words.preview, previewLimit)?.tone === 'over' && {
      preview: m.error_mapping_preview_too_long(),
    }),
  }
  return Object.keys(refused).length === 0 ? undefined : refused
}

// A new tile, live: its words, its kind and its place are the specimen's; Create checks what Mapping
// would, and either puts the words back with the refusal or leaves the receipt, which Undo takes back.
function NewTileSpecimen({
  kind: firstKind = 'branch',
  words: firstWords = { title: '', preview: '', body: '' },
  refused: firstRefusal,
}: {
  kind?: TileKind
  words?: TileWords
  refused?: Partial<Record<TileField, string>>
}) {
  const [words, setWords] = useState(firstWords)
  const [where, setWhere] = useState<TilePlace>({
    parent,
    kind: firstKind,
    place: freeFor[firstKind][0] ?? 6,
    free: freeFor[firstKind],
  })
  const [refused, setRefused] = useState(firstRefusal)
  const [created, setCreated] = useState(false)
  const [entrance, setEntrance] = useState(0)
  const again = () => {
    setCreated(false)
    setEntrance(entrance + 1)
  }
  return (
    <>
      {created ? (
        <TileWidget
          mode="done"
          did="created"
          title={words.title}
          where={where}
          at="14:06"
          onUndo={again}
        />
      ) : (
        <TileWidget
          key={entrance}
          mode="new"
          where={where}
          words={words}
          onWordsChange={(next) => {
            setWords(next)
            // A refusal clears from the field it named once that field changes, as a real form's does.
            setRefused(stillRefused(refused, words, next))
          }}
          refused={refused}
          onPlaceChange={(place) => {
            setWhere({ ...where, place })
          }}
          onKindChange={(kind) => {
            const free = freeFor[kind]
            setWhere({
              ...where,
              kind,
              free,
              place: free.includes(where.place) ? where.place : (free[0] ?? 6),
            })
          }}
          onCreate={() => {
            const refusal = refusalOf(words)
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

/** The refusals left once the fields they named have changed. */
function stillRefused(
  refused: Partial<Record<TileField, string>> | undefined,
  before: TileWords,
  after: TileWords,
) {
  if (refused === undefined) return undefined
  const left = Object.fromEntries(
    Object.entries(refused).filter(
      ([field]) => before[field as TileField] === after[field as TileField],
    ),
  )
  return Object.keys(left).length === 0 ? undefined : left
}

/** Fields that differ from what the tile held when the widget opened. */
const editedOf = (words: TileWords): TileField[] =>
  (['title', 'preview', 'body'] as const).filter((field) => words[field] !== tooling[field])

function EditSpecimen() {
  const [words, setWords] = useState({
    ...tooling,
    preview: tooling.preview.replace(', and why', ''),
  })
  const [state, setState] = useState<'editing' | 'saved' | 'deleted'>('editing')
  if (state !== 'editing') {
    return (
      <TileWidget
        mode="done"
        did={state === 'saved' ? 'edited' : 'deleted'}
        title={words.title}
        where={standing}
        at="14:08"
        onUndo={() => {
          setState('editing')
        }}
      />
    )
  }
  return (
    <TileWidget
      mode="edit"
      where={standing}
      words={words}
      onWordsChange={setWords}
      edited={editedOf(words)}
      refused={refusalOf(words)}
      onSave={() => {
        if (refusalOf(words) === undefined) setState('saved')
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

function ChangedSpecimen() {
  const [words, setWords] = useState({
    ...tooling,
    preview: tooling.preview.replace(', and why', ''),
  })
  const [comparing, setComparing] = useState(false)
  return (
    <TileWidget
      mode="edit"
      where={standing}
      words={words}
      onWordsChange={setWords}
      edited={editedOf(words)}
      onSave={said(m.system_save())}
      onCancel={said(m.ui_cancel())}
      changed={{
        by: meanwhile.by,
        fields: ['preview'],
        when: m.gallery_tile_a_minute_ago(),
        onSaveOver: said(m.widget_tile_save_over()),
        onTakeTheirs: said(m.widget_tile_take_theirs()),
        onCompare: () => {
          setComparing(!comparing)
        },
        compared: comparing ? meanwhile.compared : undefined,
      }}
    />
  )
}

// The agent's draft or edit: Accept leaves its receipt, Edit it hands it to the user's widget.
function ProposalSpecimen({ kind }: { kind: 'draft' | 'edit' }) {
  const [state, setState] = useState<'proposed' | 'taken' | 'accepted'>('proposed')
  const [words, setWords] = useState(tooling)
  const where = kind === 'draft' ? newBranch : standing
  if (state === 'accepted') {
    return (
      <TileWidget
        mode="done"
        did={kind === 'draft' ? 'created' : 'edited'}
        title={tooling.title}
        where={where}
        at="14:10"
        onUndo={() => {
          setState('proposed')
        }}
      />
    )
  }
  if (state === 'taken') {
    return (
      <TileWidget
        mode="edit"
        taken
        where={where}
        words={words}
        onWordsChange={setWords}
        edited={[]}
        onSave={() => {
          setState('accepted')
        }}
        onCancel={() => {
          setState('proposed')
        }}
      />
    )
  }
  const decisions = {
    where,
    onAccept: () => {
      setState('accepted')
    },
    onEditIt: () => {
      setState('taken')
    },
    onDiscard: said(m.widget_tile_discard()),
  }
  return kind === 'draft' ? (
    <TileProposal kind="draft" words={tooling} {...decisions} />
  ) : (
    <TileProposal kind="edit" title={tooling.title} changes={agentsEdit} {...decisions} />
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
  return (
    <TileImport
      into={newBranch}
      phase={phase}
      tiles={14}
      {...importCalls}
      onDrop={run}
      onPickFolder={run}
      onPickFile={run}
      onDone={() => {
        setPhase('choosing')
      }}
    />
  )
}

// An export: it works a moment, then leaves its receipt.
function ExportSpecimen() {
  const [phase, setPhase] = useState<'working' | 'done'>('done')
  const later = useLater()
  return (
    <>
      <TileExport
        title={tooling.title}
        below={12}
        phase={phase}
        file="tooling.zip"
        at="14:12"
        onRetry={said(m.ui_retry())}
        onDismiss={said(m.ui_widget_dismiss())}
      />
      <Again
        onAgain={() => {
          setPhase('working')
          later(() => {
            setPhase('done')
          }, 1400)
        }}
      />
    </>
  )
}
