// What a Tile keeps from the files it was imported from, so that an export writes the same vault back:
// its Name, its Tile config and the Frontmatter keys Mapping has no use for. Mapping never reads the
// last, but bounds all three before they are stored: each is a Schema whose branded type a write
// takes, so only a checked value is stored. Pure.
import { Effect, Schema, Struct } from 'effect'

import { NameInvalid } from '../../errors'
import type { KeptPart, Row, StoredConfig } from '../rows'

/** The most bytes a path segment holds, in UTF-8: what a file system allows one name. */
const segmentBytes = 255

const utf8 = new TextEncoder()

const bytes = (text: string) => utf8.encode(text).length

/** Whether a code point is a control character, C0, DEL or C1: a line break among them. */
const isControl = (code: number) => code <= 0x1f || (code >= 0x7f && code <= 0x9f)

/** Whether any code point of a text is one of those `refused` names. */
function holdsAny(text: string, refused: (code: number) => boolean): boolean {
  for (const character of text) if (refused(character.codePointAt(0) ?? 0)) return true
  return false
}

const slash = 0x2f
const backslash = 0x5c

/**
 * Whether a name is one path segment, safe to write under a folder: not empty, never `.` or `..`, no
 * `/`, `\` or control character, and at most 255 bytes. A Name and every name a Tile config sets are
 * checked when stored, and an export checks every segment it writes again, with this same function.
 */
export function isSegment(name: string): boolean {
  if (name === '' || name === '.' || name === '..' || bytes(name) > segmentBytes) return false
  return !holdsAny(name, (code) => code === slash || code === backslash || isControl(code))
}

const Segment = Schema.String.check(Schema.makeFilter(isSegment))

/**
 * A Name: the folder or file name a Tile was imported under (`STACK.md`, `3-games`, `-CLAUDE.md`), kept
 * so that it exports under it again and the `[[wikilinks]]` in Bodies still resolve. Editing the
 * Title never changes it.
 */
export const Name = Segment.pipe(Schema.brand('Name'))
export type Name = typeof Name.Type

/** What a folder pattern fills in: the Tile's Direction, and the slug of its Title. */
const placeholder = /<n>|<slug>/

/**
 * Whether a folder pattern fills in at least one placeholder, `<n>` or `<slug>`, the parts around them
 * each one path segment, and the pattern at most 255 bytes whole.
 */
export function isFolderPattern(pattern: string): boolean {
  const literals = pattern.split(placeholder)
  return (
    literals.length > 1 &&
    bytes(pattern) <= segmentBytes &&
    literals.every((literal) => literal === '' || isSegment(literal))
  )
}

/**
 * How the files of a Tile and of the Tiles below it are named, every part a Tile config may set: the
 * name of a folder's own file, `CLAUDE.md` by default, and the pattern of a Branch's folder,
 * `<n>-<slug>` by default.
 */
export type Naming = { readonly [Part in keyof StoredConfig]-?: string }

/** The check of each part a Tile config sets: every part its column holds, and no other. */
const namingParts = {
  fileName: Segment,
  folderPattern: Schema.String.check(Schema.makeFilter(isFolderPattern)),
} satisfies Record<keyof Naming, Schema.Top>

/**
 * A Tile config: what a `.hexframe/` folder holds in the app, for now the naming, inherited by
 * everything below the Tile until a Tile below sets its own. Either part not set is the Tile above's,
 * and a config sets at least one, since one that sets nothing is no config.
 */
export const TileConfig = Schema.Struct(Struct.map(namingParts, Schema.optionalKey))
  .check(Schema.makeFilter((config: object) => Object.keys(config).length > 0))
  .pipe(Schema.brand('TileConfig'))
export type TileConfig = typeof TileConfig.Type

/** The keys an export writes itself, from the Tile: never kept, since the Tile is what they say. */
export const reservedKeys: ReadonlyArray<string> = ['id', 'title', 'parent', 'preview', 'reference']

/**
 * A key Frontmatter may keep: of `[A-Za-z0-9_-]`, 64 characters at most, none an export writes, nor
 * `__proto__`, which a reader assigning keys one by one would take for the object's prototype.
 */
const isKeptKey = (key: string) =>
  /^[\w-]{1,64}$/.test(key) && !reservedKeys.includes(key) && key !== '__proto__'

/** A tab, and the two line breaks Unicode adds beyond the control characters: line, paragraph. */
const tab = 0x09
const lineBreaks = [0x2028, 0x2029]

/** A string on one line: no line break, nor any other control character but a tab. */
const isOneLine = (value: string) =>
  !holdsAny(value, (code) => code !== tab && (isControl(code) || lineBreaks.includes(code)))

/** The most keys a Tile's Frontmatter keeps, and the most bytes they take as JSON, in UTF-8. */
const frontmatterBounds = { keys: 32, bytes: 4_096 }

/**
 * Frontmatter: the keys an imported file carried that a Tile has no use for (`owner`, a skill's `name`
 * and `description`), kept as they came and written back on export. Each a key of `[A-Za-z0-9_-]` of
 * 64 characters at most, never one an export writes itself (`id`, `title`, `parent`, `preview`,
 * `reference`), holding a string on one line, a number or a boolean; 32 keys and 4 KB per Tile at most.
 */
export const Frontmatter = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String.check(Schema.makeFilter(isOneLine)), Schema.Finite, Schema.Boolean]),
)
  .check(
    // A Record lets a key its key Schema refuses pass unchecked, so each key is checked here.
    Schema.makeFilter((kept: object) => Object.keys(kept).every(isKeptKey)),
    Schema.isMaxProperties(frontmatterBounds.keys),
    Schema.makeFilter((kept: object) => bytes(JSON.stringify(kept)) <= frontmatterBounds.bytes),
  )
  .pipe(Schema.brand('Frontmatter'))
export type Frontmatter = typeof Frontmatter.Type

/** What a Tile keeps from its files, each part checked: what a write takes. */
export interface ToKeep {
  readonly name?: Name | undefined
  readonly config?: TileConfig | undefined
  readonly frontmatter?: Frontmatter | undefined
}

/**
 * Whether a value is what a Tile may keep, each part as its Schema checks it: a guard for a reader that
 * collects every fault before it refuses, where `named` and `configured` stop at the first.
 */
export const keepable = {
  name: Schema.is(Name),
  config: Schema.is(TileConfig),
  frontmatter: Schema.is(Frontmatter),
}

/** A Name, or `NameInvalid` on the field `name` when it isn't one path segment. */
export const named = (name: string) =>
  Effect.mapError(
    Schema.decodeUnknownEffect(Name)(name),
    () => new NameInvalid({ fields: ['name'] }),
  )

/**
 * A Tile config, or `NameInvalid` on the field `config` when the file name it sets isn't one path
 * segment, or its folder pattern fills in nothing or holds a part that isn't one.
 */
export const configured = (config: Partial<Naming>) =>
  Effect.mapError(
    Schema.decodeUnknownEffect(TileConfig)(config),
    () => new NameInvalid({ fields: ['config'] }),
  )

/** What a Tile keeps from its files, as a read finds it: each part only when its file carried it. */
export type Kept = { readonly [K in KeptPart]?: NonNullable<Row[K]> }

/** What a row keeps from its files, as a Tile shows it: a part its file carried nothing for is absent. */
export const keptOf = ({ name, config, frontmatter }: Pick<Row, KeptPart>): Kept => ({
  ...(name === null ? {} : { name }),
  ...(config === null ? {} : { config }),
  ...(frontmatter === null ? {} : { frontmatter }),
})

/** A row that keeps nothing from any file: a Tile made in the app, or read from Help's notes. */
export const keepsNothing = {
  name: null,
  config: null,
  frontmatter: null,
} as const satisfies Pick<Row, KeptPart>
