// A star found, in the conversation: the app's own widget, so it carries no voice. Someone is named
// by their star, never by a UUID, so one field takes a few letters of its Title, or a link to any
// tile of its System pasted whole, and the stars it leads to show by their cards, each a Title and
// its Preview, so two of one name are told apart; a pick hands the star to whoever opened the widget,
// which shares a tile with it or names a member by it. A building block, not a flow of its own.
// Controlled: what is typed, where it leads and what a pick does are its caller's.
import { cn } from 'cn'
import { Sun } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { runsToCurve, toCurve } from '../../../../layouts/screen/state/useAlongCurve'
import { HexMark } from '../../../atoms/hex'
import { Widget } from '../../../layouts/Widget'
import { Field } from '../../fields'

/** A star as the widget shows it: its id, and its card, its Title and Preview. */
export interface StarShown {
  readonly id: string
  readonly title: string
  readonly preview: string
}

/**
 * Where what is typed leads: too short to look; on its way; the stars found, a link's one among them,
 * `stale` while they are the last search's, shown until the next answers; nowhere, a link to no tile
 * the user may see; or to the user's own star, which they never pick.
 */
export type StarsShown =
  | { readonly state: 'short' | 'looking' | 'nowhere' | 'own' }
  | { readonly state: 'found'; readonly stars: readonly StarShown[]; readonly stale?: boolean }

interface StarPickerProps {
  /** What a star is picked for, its caller's question: "Share Tooling with whom?" */
  title: string
  /** What is typed: a Title, a part of one, or a link. */
  typed: string
  onType: (typed: string) => void
  found: StarsShown
  /** A star picked, handed to whoever opened the widget. */
  onPick: (star: StarShown) => void
  onCancel: () => void
  /** Its field takes the focus as it opens, where a gesture of the user's opened it. */
  takesFocus?: boolean
}

/** What the widget says where what is typed leads to no star to pick, in place of the list. */
const said: Record<Exclude<StarsShown['state'], 'found'>, () => string> = {
  short: m.widget_star_short,
  looking: m.widget_star_looking,
  nowhere: m.widget_star_nowhere,
  own: m.widget_star_own,
}

/** The star picker: a Title or a link typed, and the stars it leads to, by their cards. */
export function StarPicker({
  title,
  typed,
  onType,
  found,
  onPick,
  onCancel,
  takesFocus = false,
}: StarPickerProps) {
  const stars = found.state === 'found' ? found.stars : []
  const stale = found.state === 'found' && found.stale === true
  const [only] = stars
  return (
    <Widget
      voice="app"
      icon={<Sun />}
      kicker={m.widget_star_kicker()}
      title={title}
      subtitle={m.widget_star_what()}
      actions={[{ label: m.widget_star_cancel(), onSelect: onCancel }]}
      onDismiss={onCancel}
    >
      <Field
        label={m.widget_star_field()}
        value={typed}
        onChange={onType}
        placeholder={m.widget_star_placeholder()}
        autoComplete="off"
        takesFocus={takesFocus}
        // Enter picks the one star found, never one among several, nor one the last search found.
        onEnter={
          !stale && stars.length === 1 && only !== undefined
            ? () => {
                onPick(only)
              }
            : undefined
        }
      />
      <p aria-live="polite" className="mt-2 text-xs font-light text-muted-foreground empty:hidden">
        {found.state === 'found'
          ? stars.length === 0
            ? m.widget_star_none()
            : m.widget_star_found({ count: String(stars.length) })
          : said[found.state]()}
      </p>
      {stars.length > 0 && (
        <ul className="mt-1.5 grid" aria-busy={stale}>
          {stars.map((star) => (
            <li
              key={star.id}
              ref={toCurve}
              className={cn(runsToCurve, 'border-t border-border last:border-b')}
            >
              <button
                type="button"
                onClick={() => {
                  onPick(star)
                }}
                className="group/star grid w-full cursor-pointer grid-cols-[0.875rem_1fr] gap-3 py-2.5 text-left outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-(--voice) pointer-coarse:py-3.5"
              >
                <HexMark className="mt-1 size-3.5 fill-foreground/9 stroke-input group-hover/star:stroke-foreground" />
                <span className="grid gap-0.5">
                  <span className="font-human text-[0.9375rem] leading-tight text-foreground decoration-input underline-offset-[3px] group-hover/star:underline">
                    {star.title === '' ? m.widget_star_untitled() : star.title}
                  </span>
                  {star.preview !== '' && (
                    <span className="line-clamp-2 text-[0.78125rem] leading-normal font-light text-muted-foreground">
                      {star.preview}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}
