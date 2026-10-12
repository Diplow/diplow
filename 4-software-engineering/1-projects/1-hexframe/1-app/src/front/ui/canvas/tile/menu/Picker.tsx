// A frame in small, inside a menu: where a tile is added or moved to, the place itself as the submenu
// (HEX-105's proposal, from components.html's #menu). Its heart, then its six: a free slot dashed with
// a plus, a taken one with its title, the tile acting marked "here". What each place offers is its
// caller's (`choose`); a place the hand can choose is a line of the menu (`MenuChoice`): ↑ and ↓
// reach it, Enter chooses it, and the line under the frame says what choosing it will do.
import { cn } from 'cn'
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { MenuChoice } from '../../../atoms/Menu'
import { directions, neighbor, type Direction, type Hex } from '../../geometry/geometry'
import { points } from '../light'
import type { Frame, Seat } from '../moving/move'

/** What a choice does, and its words, which the line under the frame says while it is lit. */
interface PickerChoice {
  label: string
  onSelect: () => void
}

/** A frame as a picker draws it: the tile at its heart, and what holds each of its Directions. */
export type PickerFrame = { hub: string } & Frame<Seat & { title: string }>

interface PickerProps {
  frame: PickerFrame
  /** Where the tile acting stands, when it is in this frame. */
  self?: Direction | undefined
  /** What choosing a place does, or nothing where it can't be chosen. */
  choose: (direction: Direction) => PickerChoice | undefined
}

const radius = 26
const width = 172
const height = 160
const origin = { x: 0, y: 0 }

/** Words cut to fit a small hex: past `room` letters, its first ones and an ellipsis. */
function cut(title: string, room: number): string {
  // By code point, so a letter outside the basic plane is never split in two.
  const letters = Array.from(title)
  return letters.length <= room ? title : `${letters.slice(0, room - 1).join('')}…`
}

export function Picker({ frame, self, choose }: PickerProps) {
  const [said, setSaid] = useState<string>()
  const heart = { center: origin, radius: radius * 1.06 }
  return (
    <div className="px-3.5 pt-2.5 pb-3">
      <div className="mb-2 font-mono text-[0.65625rem] text-faint">
        {m.tile_picker_in({ hub: frame.hub })}
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`${String(-width / 2)} ${String(-height / 2)} ${String(width)} ${String(height)}`}
        className="mx-auto block overflow-visible"
      >
        <Place hex={{ center: origin, radius }} look="hub" words={cut(frame.hub, 9)} />
        {directions.map((direction) => {
          const hex = { center: neighbor(heart, direction).center, radius }
          const member = frame.seats[direction]
          if (direction === self) {
            return <Place key={direction} hex={hex} look="self" words={m.tile_picker_here()} />
          }
          const choice = choose(direction)
          const place = (
            <Place
              hex={hex}
              look={member === undefined ? 'free' : 'taken'}
              words={member === undefined ? '+' : cut(member.title, 8)}
              chosen={choice !== undefined}
            />
          )
          return choice === undefined ? (
            <g key={direction}>{place}</g>
          ) : (
            <MenuChoice
              key={direction}
              label={choice.label}
              onSelect={choice.onSelect}
              onHighlight={(lit) => {
                setSaid(lit ? choice.label : undefined)
              }}
            >
              <g className="group/choice cursor-pointer outline-none">{place}</g>
            </MenuChoice>
          )
        })}
      </svg>
      <div
        aria-hidden
        className="mt-2 min-h-[1.5em] text-center text-xs font-light text-muted-foreground"
      >
        {said ?? ' '}
      </div>
    </div>
  )
}

const looks = {
  hub: 'fill-foreground/6 stroke-transparent',
  self: 'fill-transparent stroke-foreground/50',
  free: 'fill-transparent stroke-input [stroke-dasharray:2_4]',
  taken: 'fill-tile stroke-transparent',
} as const

const lit =
  'group-data-[highlighted]/choice:fill-human/16 group-data-[highlighted]/choice:stroke-human group-data-[highlighted]/choice:[stroke-dasharray:none]'

/** One hex of the frame, and its words. */
function Place({
  hex,
  look,
  words,
  chosen = false,
}: {
  hex: Hex
  look: keyof typeof looks
  words: string
  chosen?: boolean
}) {
  const { x, y } = hex.center
  return (
    <>
      <polygon
        points={points(hex)}
        vectorEffect="non-scaling-stroke"
        className={cn('transition-colors duration-200', looks[look], chosen && lit)}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn(
          'pointer-events-none font-sans text-[9px] fill-muted-foreground',
          look === 'free' && 'text-[13px] fill-faint',
          (look === 'hub' || look === 'self') && 'font-human text-[9.5px] italic fill-foreground',
        )}
      >
        {words}
      </text>
    </>
  )
}
