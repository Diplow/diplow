// What the agent drafts for a tile, waiting on the user in its violet: a Proposal (`entries/`) whose
// changes are shown in full, a new tile's words read as they will be, or an edit where it falls, what
// goes struck in faint, what comes on a violet ground, its hex the place the tile goes. Accept takes
// it; Edit it hands it to the user's own widget; Discard asks first. Decided, it leaves the Proposal's
// receipt, its change folded under it.
import { HexagonIcon, Pencil } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { type Fate, Proposal } from '../../entries/Proposal'
import type { MentionProps } from '../../text/Mention'
import { weave } from '../../text/words'
import {
  Diff,
  fieldNames,
  PlaceMark,
  Read,
  whereOf,
  type Segment,
  type TileField,
  type TilePlace,
  type TileWords,
} from './parts'

/** What an edit does to one field, stretch by stretch. */
interface FieldChange {
  readonly field: TileField
  readonly segments: readonly Segment[]
}

interface Decisions {
  where: TilePlace
  /** The tile, named as the conversation names one, in the receipt's change. */
  tile: MentionProps
  fate: Fate
  at: Date
  undone?: boolean
  onAccept: () => void
  /** Takes the draft to edit it: the tile widget, in the user's voice, holding the agent's words. */
  onEdit: () => void
  onDiscard: () => void
  onUndo?: (() => void) | undefined
  pending?: boolean
}

interface Drafted extends Decisions {
  kind: 'draft'
  words: TileWords
}

interface Edited extends Decisions {
  kind: 'edit'
  changes: readonly FieldChange[]
}

/** The agent's draft of a new tile, or its edit of one, waiting on the user. */
export function TileProposal(props: Drafted | Edited) {
  const { where, tile, fate, at, undone, onAccept, onEdit, onDiscard, onUndo, pending } = props
  const drafted = props.kind === 'draft'
  const fields = drafted
    ? ''
    : props.changes.map(({ field }) => fieldNames[field]().toLocaleLowerCase()).join(', ')
  return (
    <Proposal
      title={tile.title}
      kicker={
        drafted
          ? m.widget_tile_drafted_kicker({ where: whereOf(where) })
          : m.widget_tile_proposed_kicker()
      }
      summary={drafted ? undefined : m.widget_tile_proposed_changes({ fields })}
      mark={<PlaceMark where={where} label={m.widget_tile_place()} />}
      changes={[
        drafted
          ? {
              icon: HexagonIcon,
              words: weave(m.widget_tile_change_create, { tile: { tile }, where: whereOf(where) }),
            }
          : { icon: Pencil, words: weave(m.widget_tile_change_edit, { tile: { tile }, fields }) },
      ]}
      detail={
        <div className="grid gap-3.5">
          {drafted ? (
            <>
              <Read label={m.system_field_preview()}>{props.words.preview}</Read>
              <Read label={m.widget_tile_page()} prose>
                {props.words.body}
              </Read>
            </>
          ) : (
            props.changes.map(({ field, segments }) => (
              <Diff
                key={field}
                label={fieldNames[field]()}
                segments={segments}
                prose={field === 'body'}
              />
            ))
          )}
        </div>
      }
      fate={fate}
      at={at}
      undone={undone}
      onAccept={onAccept}
      onEdit={onEdit}
      onDiscard={onDiscard}
      onUndo={onUndo}
      pending={pending}
    />
  )
}
