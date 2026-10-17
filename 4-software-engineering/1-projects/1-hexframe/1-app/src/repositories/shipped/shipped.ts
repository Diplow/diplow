// The notes of the Systems hexframe ships, as the build bundled them: the text of every `CLAUDE.md`
// under the app's `help/` and `tutorial/`, and of its French twin `CLAUDE.fr.md`, by System, by
// language, then by the path of its folder from the System's, `''` for the Root. Vite's
// `import.meta.glob` reads them when it builds the server, `exhaustive` so the Context Tiles' dot
// folders come too; nothing reads the file system at request time. Vite takes a glob's arguments as
// literals only, hence one call per language, each folder written out. Mapping decides what each note
// means (src/domains/mapping/shipped/).
import type { noteFiles, ShippedFolder } from './note'

/** The text of notes, by the path of each note's folder. */
type Notes = Readonly<Record<string, string>>

/** Every `CLAUDE.md` of the shipped folders, by its path from the app: the English notes. */
const english = import.meta.glob<string>(['/help/**/CLAUDE.md', '/tutorial/**/CLAUDE.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
  exhaustive: true,
})

/** Every `CLAUDE.fr.md` of the shipped folders, by its path from the app: the French notes. */
const french = import.meta.glob<string>(['/help/**/CLAUDE.fr.md', '/tutorial/**/CLAUDE.fr.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
  exhaustive: true,
})

/** The notes bundled under one System's folder, by the path of each note's folder from it. */
function under(files: Notes, folder: ShippedFolder): Notes {
  const prefix = `/${folder}/`
  return Object.fromEntries(
    Object.entries(files).flatMap(([file, text]) =>
      file.startsWith(prefix)
        ? [[file.slice(prefix.length).replace(/\/?CLAUDE(\.[a-z]+)?\.md$/, ''), text]]
        : [],
    ),
  )
}

/** One System's notes, in each language its notes are written in. */
const notesOf = (folder: ShippedFolder) => ({
  en: under(english, folder),
  fr: under(french, folder),
})

/**
 * The text of the notes of each System hexframe ships, by its folder, then by language, then by the
 * path of each note's folder from the System's.
 */
export const shippedNotes: Readonly<
  Record<ShippedFolder, Readonly<Record<keyof typeof noteFiles, Notes>>>
> = { help: notesOf('help'), tutorial: notesOf('tutorial') }
