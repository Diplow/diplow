// The canvas's corner, top right: where you are. One thin line from the root down to the Tile you are
// on, a point per step, with hexframe's mark, the Sunstone, at its head, threaded on the line, so the
// corner reads as one mark rather than a sign beside a list; it turns whole at each thing done.
// With no step, the mark stands alone; the line and its points come down from it once there is one.
// Where its caller gives one, the mark is the way back to the reader's own System, from another;
// on another's System, the Tiles kept from the reader between its star and a step are one "…".
// Every part sits on the line's axis: the line is 1px wide and the mark and the points odd in size, so
// each centre falls on the line's centre and the line stays one crisp pixel. Under a finger, every
// step grows to a 44px target and the points spread to match. The point you are on is lit in the
// System's light, as its star is: amber on a person's, rose on an Organization's.
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import { Sunstone } from '../../layouts/screen/Sunstone'
import type { Sun } from '../view/tiles'

interface RailStep {
  id: string
  title: string
  /** Reached across Tiles kept from the reader, which a "…" stands for above it. */
  across?: true | undefined
}

interface RailProps {
  /** From the root down to the Tile you are on, which is the last; none, and the mark is alone. */
  steps: readonly RailStep[]
  /** A step up the path chosen: the caller centers the canvas on it. */
  onSelect: (id: string) => void
  /** How many things were done since the page opened: the mark turns whole at each. */
  turns?: number
  /**
   * The mark chosen, on another System than the reader's: the caller carries the canvas back to
   * their own Root. Without it, the mark is only hexframe's.
   */
  onHome?: (() => void) | undefined
  /** The light of the System's star, which the point you are on takes: a person's by default. */
  light?: Sun['light']
  className?: string
}

export function Rail({ steps, onSelect, turns = 0, onHome, light, className }: RailProps) {
  const mark = <Sunstone turns={turns} className="h-[23px] w-[21px]" />
  return (
    <div className={cn('relative w-[31px] pointer-coarse:w-11', className)}>
      {onHome === undefined ? (
        <span role="img" aria-label={m.screen_brand()} className={markPlace}>
          {mark}
        </span>
      ) : (
        <button
          type="button"
          aria-label={m.breadcrumb_home()}
          title={m.breadcrumb_home()}
          className={cn(
            markPlace,
            'cursor-pointer rounded-full outline-none focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-human',
          )}
          onClick={onHome}
        >
          {mark}
        </button>
      )}
      {steps.length > 0 && (
        <div className="motion-safe:animate-descend">
          {/* The line starts at the foot of the mark and fades out below the last point. */}
          <span
            aria-hidden
            className="absolute top-[29px] -bottom-[58px] left-[calc(50%-0.5px)] w-px bg-linear-to-b from-input from-75% to-transparent pointer-coarse:top-[33px]"
          />
          <nav aria-label={m.breadcrumb_label()}>
            <ol className="mt-[18px] flex flex-col gap-[25px] pointer-coarse:mt-1 pointer-coarse:gap-0">
              {steps.flatMap((step, index) => [
                ...(step.across === true ? [<Gap key={`gap:${step.id}`} />] : []),
                <Step
                  key={step.id}
                  step={step}
                  here={index === steps.length - 1}
                  light={light}
                  onSelect={() => {
                    onSelect(step.id)
                  }}
                />,
              ])}
            </ol>
          </nav>
        </div>
      )}
    </div>
  )
}

/** Where the mark sits, a 44px target under a finger. */
const markPlace = 'grid size-[31px] place-items-center pointer-coarse:size-11'

/**
 * The Tiles kept from the reader between two steps, one "…" on the line in a point's place, which
 * leads nowhere: nothing there may be centered, nor named.
 */
function Gap() {
  return (
    <li
      aria-label={m.breadcrumb_gap()}
      title={m.breadcrumb_gap()}
      className="relative flex h-[17px] items-center justify-center pointer-coarse:h-11"
    >
      <span
        aria-hidden
        className="bg-background px-px text-[13px]/[17px] font-light text-muted-foreground"
      >
        …
      </span>
    </li>
  )
}

interface StepProps {
  step: RailStep
  /** The Tile you are on: lit in its System's light, and read as where you are, not a way back. */
  here: boolean
  light: Sun['light'] | undefined
  onSelect: () => void
}

/** The point you are on, in each light a star has. */
const lit: Record<Sun['light'], string> = {
  human:
    'border-human bg-human shadow-[0_0_14px_2px_color-mix(in_oklab,var(--human)_70%,transparent)]',
  organization:
    'border-organization bg-organization shadow-[0_0_14px_2px_color-mix(in_oklab,var(--organization)_70%,transparent)]',
}

/**
 * A point on the line, its label 14px to its left, muted until it is where you are: the prototype's
 * faint reads at 3.1:1 on the ground, short of the 4.5:1 a label needs.
 */
function Step({ step, here, light = 'human', onSelect }: StepProps) {
  const label = cn(
    'absolute top-0 right-[calc(50%+17.5px)] h-full max-w-56 truncate text-[13px]/[17px] font-light whitespace-nowrap [text-shadow:0_0_12px_var(--background)] pointer-coarse:leading-11',
    here ? 'text-foreground' : 'text-muted-foreground',
  )
  return (
    <li className="relative flex h-[17px] items-center justify-center pointer-coarse:h-11">
      <span
        aria-hidden
        className={cn(
          'size-[7px] rounded-full border',
          here ? lit[light] : 'border-faint bg-background',
        )}
      />
      {here ? (
        <span aria-current="location" className={label}>
          {step.title}
        </span>
      ) : (
        <button
          type="button"
          aria-label={m.hex_tile_center({ title: step.title })}
          title={step.title}
          className={cn(
            label,
            'cursor-pointer text-left outline-none hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-human',
          )}
          onClick={onSelect}
        >
          {step.title}
        </button>
      )}
    </li>
  )
}
