// A name as a server function takes it, a Key's or a Group's: bounded here, in UTF-16 units, so
// nothing unbounded reaches IAM, which counts its characters as a reader does and says what a name
// must be, on the field. The bound leaves room for its most characters, emoji each, and their spaces.
import { Schema } from 'effect'

/** The most UTF-16 units a reader's character takes here: an emoji is up to 19 (a family, skin toned). */
const unitsPerCharacter = 32

/** A name of at most `most` characters as a reader counts them, as the wire bounds it. */
export const nameOnTheWire = (most: number) =>
  Schema.String.check(Schema.isMaxLength(most * unitsPerCharacter))
