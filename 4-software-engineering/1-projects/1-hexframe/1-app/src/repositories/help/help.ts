// Help's notes, as the build bundled them: the text of every `CLAUDE.md` under the app's `help/`, by
// the path of its folder from there, `''` for the Root. Vite's `import.meta.glob` reads them when it
// builds the server, `exhaustive` so the Context Tiles' dot folders come too; nothing reads the file
// system at request time. Mapping decides what each note means (src/domains/mapping/help/).
const files = import.meta.glob<string>('/help/**/CLAUDE.md', {
  query: '?raw',
  import: 'default',
  eager: true,
  exhaustive: true,
})

/** The folder a bundled file is the note of, from Help's folder: `''` for the Root. */
const folderOf = (file: string) => file.replace(/^\/help\//, '').replace(/\/?CLAUDE\.md$/, '')

/** The text of each of Help's notes, by the path of its folder from Help's folder. */
export const helpNotes: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([file, text]) => [folderOf(file), text]),
)
