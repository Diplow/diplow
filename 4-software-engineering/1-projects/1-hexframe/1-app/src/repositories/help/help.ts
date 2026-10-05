// Help's notes, as the build bundled them: the text of every `CLAUDE.md` under the app's `help/`, and of
// its French twin `CLAUDE.fr.md`, by language, then by the path of its folder from there, `''` for the
// Root. Vite's `import.meta.glob` reads them when it builds the server, `exhaustive` so the Context
// Tiles' dot folders come too; nothing reads the file system at request time. Vite takes a glob's
// arguments as literals only, hence one call per language, written out. Mapping decides what each
// note means (src/domains/mapping/help/).
import type { Language } from './note'

/** The folder a bundled file is the note of, from Help's folder: `''` for the Root. */
const folderOf = (file: string) =>
  file.replace(/^\/help\//, '').replace(/\/?CLAUDE(\.[a-z]+)?\.md$/, '')

/** The text of each note, by the path of its folder. */
const byFolder = (files: Record<string, string>): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(files).map(([file, text]) => [folderOf(file), text]))

/** The text of each of Help's notes, by language, then by the path of its folder from Help's folder. */
export const helpNotes: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  en: byFolder(
    import.meta.glob<string>('/help/**/CLAUDE.md', {
      query: '?raw',
      import: 'default',
      eager: true,
      exhaustive: true,
    }),
  ),
  fr: byFolder(
    import.meta.glob<string>('/help/**/CLAUDE.fr.md', {
      query: '?raw',
      import: 'default',
      eager: true,
      exhaustive: true,
    }),
  ),
}
