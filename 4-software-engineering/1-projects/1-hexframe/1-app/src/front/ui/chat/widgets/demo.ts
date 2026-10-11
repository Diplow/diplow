// What the widgets' state hooks will do on a real page, for /design-system alone: which places a kind
// may take, what Mapping and IAM would refuse before writing, a refusal clearing from the field that
// changed, and the way around Help. `ui/` knows no domain, so the limits are mirrored here, as the
// composer's demo mirrors the feature's `@` rules: Mapping's `previewLimit`, IAM's Key name and
// password lengths. The builds read them from their domains.
import { m } from '#/paraglide/messages'

import type { HelpTopic } from './help/find'
import { lengthOf } from './count'
import { places, type Place } from './Places'
import type { Access } from './sign-in/SignInWidget'
import type { TileField, TileKind, TileWords } from './tile/parts'

/** Mapping's `previewLimit`: the most characters a Preview holds, as a reader counts them. */
export const previewLimit = 350

/** IAM's: the most characters a Key's name holds. */
export const nameLimit = 32

/** The places free for each kind under the sample tile: a Leaf's and a Context's are their own. */
export const freeFor: Record<TileKind, readonly Place[]> = {
  branch: [4, 5, 6],
  leaf: [1, 2, 3, 5, 6],
  context: [2, 3, 4, 5, 6],
}

type Refused = Partial<Record<TileField, string>>

/** What Mapping would refuse before writing a tile: no title, a preview past its limit. */
export function tileRefusalOf(words: TileWords): Refused | undefined {
  const refused: Refused = {
    ...(words.title.trim() === '' && { title: m.error_mapping_title_missing() }),
    ...(lengthOf(words.preview) > previewLimit && {
      preview: m.error_mapping_preview_too_long(),
    }),
  }
  return Object.keys(refused).length === 0 ? undefined : refused
}

/** The refusals left once the fields they named have changed, as a real form clears them. */
export function stillRefused(
  refused: Refused | undefined,
  before: TileWords,
  after: TileWords,
): Refused | undefined {
  if (refused === undefined) return undefined
  const left: Refused = {}
  for (const field of ['title', 'preview', 'body'] as const) {
    const said = refused[field]
    if (said !== undefined && before[field] === after[field]) left[field] = said
  }
  return Object.keys(left).length === 0 ? undefined : left
}

/** The fields that differ from what the tile held when its widget opened. */
export const editedOf = (words: TileWords, read: TileWords): TileField[] =>
  (['title', 'preview', 'body'] as const).filter((field) => words[field] !== read[field])

/** What IAM would refuse of a Key's name. */
export function nameRefusalOf(name: string): string | undefined {
  const length = lengthOf(name.trim())
  return length === 0 || length > nameLimit ? m.error_iam_key_name_invalid() : undefined
}

/** What IAM would refuse before signing anyone in: a malformed email, a password out of bounds. */
export function accessRefusalOf(
  access: Access,
  email: string,
  password: string,
): { email?: string; password?: string } | undefined {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { email: m.error_iam_email_malformed() }
  }
  const length = lengthOf(password)
  if (access === 'sign-up' && (length < 8 || length > 128)) {
    return { password: m.error_iam_password_length() }
  }
  return length === 0 ? { password: m.error_iam_credentials_rejected() } : undefined
}

/** A topic of Help and the six below it, as the route hands Help over. */
export interface HelpNode extends HelpTopic {
  readonly children: Partial<Readonly<Record<Place, HelpNode>>>
}

/** The topics a path of places leads through from Help's Root, the Root first; it stops at a gap. */
export function follow(help: HelpNode, path: readonly Place[]): HelpNode[] {
  const trail = [help]
  for (const place of path) {
    const next = trail.at(-1)?.children[place]
    if (next === undefined) break
    trail.push(next)
  }
  return trail
}

/** Every topic of Help, the Root first, then each topic's six in their order. */
export function topicsOf(node: HelpNode): HelpNode[] {
  return [
    node,
    ...places.flatMap((place) => {
      const child = node.children[place]
      return child === undefined ? [] : topicsOf(child)
    }),
  ]
}

/** The places that lead from the Root to a topic, by its id; none when Help holds no such topic. */
export function pathTo(node: HelpNode, id: string): Place[] | undefined {
  if (node.id === id) return []
  for (const place of places) {
    const child = node.children[place]
    const below = child === undefined ? undefined : pathTo(child, id)
    if (below !== undefined) return [place, ...below]
  }
  return undefined
}

/** The place `steps` further clockwise round a frame: after 6 west comes 1 north-west. */
export const around = (place: Place, steps: number): Place =>
  places[(places.indexOf(place) + steps) % places.length] ?? place

/** Where a topic leads: the topics below it, or, with none, the next two round its own frame. */
export function readOnOf(help: HelpNode, path: readonly Place[]): HelpNode[] {
  const trail = follow(help, path)
  const topic = trail.at(-1) ?? help
  const below = places.flatMap((place) => topic.children[place] ?? [])
  const parent = trail.at(-2)
  const here = path.at(-1)
  if (below.length > 0 || parent === undefined || here === undefined) return below
  return [1, 2].flatMap((steps) => parent.children[around(here, steps)] ?? [])
}
