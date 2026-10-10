// Assistant's entities, value objects and aggregate, with their invariants: the Conversation's
// Entries, a Message's links to Tiles, a merged navigation and its merge rule, a day as its reader asks
// for it, a Turn, and the Mode and the Proposal. Part of Assistant's door, so the front may import it (src/domains/CLAUDE.md,
// "The door").
export * from './day'
export * from './entry'
export * from './message/links'
export * from './navigation'
export * from './proposal/proposal'
export * from './turn/turn'
