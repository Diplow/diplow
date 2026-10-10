import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { merged, Navigation, type Step, stepsKept } from './navigation'

// The merge rule, on gestures made by hand: consecutive navigations become one Entry, the latest
// gestures kept in order, every one counted; and what the schema lets a browser send.

const step = (tile: string, gesture = 'center'): Step => ({ gesture, tile })

/** The navigation these gestures merge into, one after another. */
const mergedAll = (steps: ReadonlyArray<Step>) =>
  steps.reduce<Navigation | undefined>(merged, undefined)

describe('the merge rule', () => {
  it('starts a navigation with its first gesture', () => {
    expect(merged(undefined, step('a'))).toEqual({
      _tag: 'Navigation',
      steps: [step('a')],
      gestures: 1,
    })
  })

  it('adds each gesture after the ones before it, counting them', () => {
    const steps = [step('a'), step('b', 'expand'), step('b', 'collapse'), step('a')]
    expect(mergedAll(steps)).toEqual({ _tag: 'Navigation', steps, gestures: 4 })
  })

  it('keeps the latest gestures only, and still counts every one', () => {
    const steps = Array.from({ length: stepsKept + 3 }, (_, n) => step(`tile-${String(n)}`))
    const navigation = mergedAll(steps)
    expect(navigation?.steps).toEqual(steps.slice(3))
    expect(navigation?.gestures).toBe(stepsKept + 3)
  })

  it('makes a navigation its schema takes, however long the user goes on', () => {
    const steps = Array.from({ length: 40 }, (_, n) => step(`tile-${String(n)}`, 'show-context'))
    expect(Schema.is(Navigation)(mergedAll(steps))).toBe(true)
  })
})

describe('a navigation, as a browser sends it', () => {
  const decoded = (input: unknown) => Schema.decodeUnknownResult(Navigation)(input)
  const sent = (more: object) => ({ _tag: 'Navigation', steps: [step('a')], gestures: 1, ...more })

  it('takes a gesture in the canvas’s words, on a Tile by its id', () => {
    expect(decoded(sent({ steps: [step('a', 'show-leaves-around')] }))._tag).toBe('Success')
  })

  it('refuses no gesture, too many, a word the canvas would not write, or an empty Tile', () => {
    const refused = [
      sent({ steps: [] }),
      sent({ steps: Array.from({ length: stepsKept + 1 }, () => step('a')), gestures: 20 }),
      sent({ steps: [step('a', 'Center')] }),
      sent({ steps: [step('a', 'center now')] }),
      sent({ steps: [step('a', 'x'.repeat(33))] }),
      sent({ steps: [step('')] }),
      sent({ steps: [step('x'.repeat(101))] }),
    ]
    for (const input of refused) expect(decoded(input)._tag, JSON.stringify(input)).toBe('Failure')
  })

  it('refuses a count below the gestures it kept, or past what it counts', () => {
    expect(decoded(sent({ steps: [step('a'), step('b')], gestures: 1 }))._tag).toBe('Failure')
    expect(decoded(sent({ gestures: 0 }))._tag).toBe('Failure')
    expect(decoded(sent({ gestures: 1.5 }))._tag).toBe('Failure')
    expect(decoded(sent({ gestures: 1_000_001 }))._tag).toBe('Failure')
  })
})
