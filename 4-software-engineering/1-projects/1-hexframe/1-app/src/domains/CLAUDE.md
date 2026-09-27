---
title: domains
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains
owner: diplo
preview: >-
  The business logic, one folder per domain (IAM, Mapping, Assistant), as
  Effect services in the domain's language. For now it holds kind.ts, the
  closed set of kinds a domain's error carries, and bus.ts, where a domain
  publishes its events.
---
# domains

The middle layer: one folder per domain, each an Effect service in its own language, as [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] tells it. Domains ignore each other; only [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] composes them.

| File | Holds |
|---|---|
| `kind.ts` | The kinds a domain's error carries (`kind('Conflict')`, `...invalid`), shared by every domain because it sits beside them, not in one: the channel the client picks depends on it |
| `bus.ts` | `Bus`, where a domain publishes a `DomainEvent`, a fact in its language declared with `Schema.TaggedClass`, for others to react to. The API layer builds the bus and wires who reacts: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE\|api]], "The server bus" |
