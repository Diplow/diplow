// Mapping's entities, value objects and aggregate, with their invariants: a Tile and where it stands,
// a System as a reader finds it, the rows it is read from, what a Tile keeps from its files and what a
// Leaf may hold. Pure, so the front may import them: this file is part of Mapping's door, with
// `operations/index.ts` and `errors.ts`, and nothing reachable from it touches a repository, the
// application service, a concept folder, another domain, Node, the environment or the config.
export * from './kept/kept'
export * from './kept/naming'
export * from './leaves/leaves'
export * from './rows'
export * from './system'
export * from './tile'
