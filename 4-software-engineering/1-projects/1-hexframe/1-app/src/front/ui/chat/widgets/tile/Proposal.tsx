// What the agent drafts for a tile, waiting on the user in its violet: a new tile's words read as
// they will be, or an edit shown where it falls, what goes struck in faint, what comes on a violet
// ground. Accept takes it; Edit it hands it over, the widget turning to the user's amber; Discard
// throws it away.
import { Fragment, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Widget } from '../../layouts/Widget'
import { PlaceMark, whereOf, type TileField, type TilePlace, type TileWords } from './parts'

/** A stretch of a field an edit keeps, takes out or puts in. */
export interface Segment {
  readonly kind: 'same' | 'gone' | 'added'
  readonly text: string
}

/** What an edit does to one field, stretch by stretch. */
interface FieldChange {
  readonly field: TileField
  readonly segments: readonly Segment[]
}

interface Decisions {
  where: TilePlace
  onAccept: () => void
  /** Takes the draft to edit it: the tile widget, in the user's voice, holding the agent's words. */
  onEditIt: () => void
  onDiscard: () => void
}

interface Drafted extends Decisions {
  kind: 'draft'
  words: TileWords
}

interface Edited extends Decisions {
  kind: 'edit'
  title: string
  changes: readonly FieldChange[]
}

const fieldNames: Record<TileField, () => string> = {
  title: m.system_field_title,
  preview: m.system_field_preview,
  body: m.widget_tile_page,
}

/** The agent's draft of a new tile, or its edit of one, waiting on the user. */
export function TileProposal(props: Drafted | Edited) {
  const { where, onAccept, onEditIt, onDiscard } = props
  const drafted = props.kind === 'draft'
  return (
    <Widget
      voice="agent"
      mark={<PlaceMark where={where} label={m.widget_tile_place()} />}
      kicker={
        drafted
          ? m.widget_tile_drafted_kicker({ where: whereOf(where) })
          : m.widget_tile_proposed_kicker()
      }
      title={drafted ? props.words.title : props.title}
      subtitle={
        drafted
          ? undefined
          : m.widget_tile_proposed_changes({
              fields: props.changes
                .map(({ field }) => fieldNames[field]().toLocaleLowerCase())
                .join(', '),
            })
      }
      actions={[
        {
          label: m.gallery_sample_accept(),
          shortcut: { key: 'Enter', mod: true },
          onSelect: onAccept,
        },
        { label: m.widget_tile_edit_it(), onSelect: onEditIt },
        { label: m.widget_tile_discard(), onSelect: onDiscard, apart: true },
      ]}
      onDismiss={onDiscard}
    >
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
    </Widget>
  )
}

/** A field read, not written: its label, then what it holds, the page in the user's serif. */
function Read({
  label,
  prose = false,
  children,
}: {
  label: string
  prose?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid gap-[3px]">
      <span className="text-[0.71875rem] text-muted-foreground">{label}</span>
      <p
        className={
          prose
            ? 'font-human text-[0.96875rem] leading-[1.55] font-light whitespace-pre-wrap text-muted-foreground'
            : 'text-sm leading-[1.55] font-light text-muted-foreground'
        }
      >
        {children}
      </p>
    </div>
  )
}

/**
 * A field's change where it falls: what goes struck in faint, what comes on the agent's violet ground,
 * each said to a screen reader, which shows neither.
 */
export function Diff({
  label,
  segments,
  prose = false,
}: {
  label: string
  segments: readonly Segment[]
  /** A page's, in the user's serif, its lines kept. */
  prose?: boolean
}) {
  return (
    <Read label={label} prose={prose}>
      {segments.map((segment, index) =>
        segment.kind === 'same' ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : segment.kind === 'gone' ? (
          <del
            key={index}
            className="text-faint decoration-destructive/60 decoration-from-font [text-decoration-line:line-through]"
          >
            <span className="sr-only">{m.widget_tile_gone()} </span>
            {segment.text}
          </del>
        ) : (
          <ins key={index} className="bg-agent/18 px-[0.15em] text-foreground no-underline">
            <span className="sr-only">{m.widget_tile_added()} </span>
            {segment.text}
          </ins>
        ),
      )}
    </Read>
  )
}
