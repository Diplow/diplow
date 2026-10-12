// What the widgets' state hooks will do on a real page, for /design-system alone, never for a build:
// which places a kind may take, what Mapping and IAM would refuse before writing, a refusal clearing
// from the field that changed. `ui/` knows no domain: Mapping's `previewLimit` and IAM's Key name
// bounds come from the route, which reads them at each domain's door; IAM's password rule, outside its
// door, is mirrored here as IAM states it, as the composer's demo mirrors the feature's `@` rules.
import { m } from '#/paraglide/messages'

import { lengthOf } from './count'
import type { Place } from './Places'
import type { Access } from './sign-in/SignInWidget'
import type { TileField, TileKind, TileWords } from './tile/parts'

/** The places free for each kind under the sample tile: a Leaf's and a Context's are their own. */
export const freeFor: Record<TileKind, readonly Place[]> = {
  branch: [4, 5, 6],
  leaf: [1, 2, 3, 5, 6],
  context: [2, 3, 4, 5, 6],
}

type Refused = Partial<Record<TileField, string>>

/** What Mapping would refuse before writing a tile: no title, a preview past `previewLimit`. */
export function tileRefusalOf(words: TileWords, previewLimit: number): Refused | undefined {
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

/** The fewest and the most characters a Key's name holds: IAM's, read by the route. */
export interface NameBounds {
  readonly min: number
  readonly max: number
}

/** What IAM would refuse of a Key's name, as IAM counts it: trimmed, as a reader counts it. */
export function nameRefusalOf(name: string, bounds: NameBounds): string | undefined {
  const length = lengthOf(name.trim())
  return length < bounds.min || length > bounds.max ? m.error_iam_key_name_invalid() : undefined
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
