// Mapping's entities, value objects and aggregate, with their invariants: a Tile and where it stands,
// a System as a reader finds it, the rows it is read from, what a Tile keeps from its files, what a
// Leaf may hold, and the rights on a Tile with the Grants they come from. Part of Mapping's door, so
// the front may import it (src/domains/CLAUDE.md, "The door").
export * from './kept/kept'
export * from './kept/naming'
export * from './leaves/leaves'
export * from './rights/reach'
export * from './rights/rights'
export * from './rights/seen'
export * from './rows'
export * from './system'
export * from './tile'
