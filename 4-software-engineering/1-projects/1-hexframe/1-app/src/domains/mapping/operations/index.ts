// Mapping's Operations, changes described as data, the events they make, and `decide` and `evolve`,
// the Decider the server and the client share. For now, where an operation puts a Tile. Part of
// Mapping's door, with `entities/index.ts` and `errors.ts`, so it stays as pure as they are: nothing
// reachable from it touches a repository, the application service, a concept folder, another
// domain, Node, the environment or the config.
export * from './placement'
