// The YAML an export writes: a Markdown file's frontmatter, and a `.hexframe/config.yaml`. Written by
// a YAML serializer, never by joining strings, so no Title, Preview or kept value can open a key of
// its own or close the block: every value stays on its key's line, whatever line breaks it holds.
// The one module that imports the serializer (`dependency-cruiser.config.ts`). Pure.
import { Document, Scalar, visit } from 'yaml'

/** What a file's YAML says: scalar values by key, in the order they are written. */
export type Fields = Readonly<Record<string, string | number | boolean>>

/** The line separators the serializer writes raw, even in a double-quoted string. */
const lineSeparators = /[\u2028\u2029]/

/** Their escapes in a double-quoted YAML string. */
const escapes: Readonly<Record<string, string>> = { '\u2028': '\\L', '\u2029': '\\P' }

/**
 * `fields` as YAML, one key a line. No value is folded over lines nor written as a block, so a line
 * break in it is an escape. The serializer leaves the Unicode line and paragraph separators raw, which
 * a reader splitting lines (the shape's `linesOf`) would break on: a string holding one is written
 * double-quoted, and the separator escaped there, where YAML reads `\L` and `\P` back as them.
 */
export function yamlOf(fields: Fields): string {
  const document = new Document(fields)
  visit(document, {
    Scalar(_, scalar) {
      if (typeof scalar.value === 'string' && lineSeparators.test(scalar.value)) {
        scalar.type = Scalar.QUOTE_DOUBLE
      }
    },
  })
  return document
    .toString({ lineWidth: 0, blockQuote: false })
    .replace(new RegExp(lineSeparators, 'g'), (separator) => escapes[separator] ?? separator)
}

/** A Markdown file: its frontmatter, `fields`, between its two `---` lines, then its Body as given. */
export const markdownOf = (fields: Fields, body: string) => `---\n${yamlOf(fields)}---\n${body}`
