---
title: domains
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains
owner: diplo
preview: >-
  The business logic, one folder per domain (IAM, Mapping, Assistant), as
  Effect services in the domain's language. IAM and Mapping so far; beside the
  folders, kind.ts, the closed set of kinds a domain's error carries, and
  bus.ts, where a domain publishes its events.
---
# domains

The middle layer: one folder per domain, each an Effect service in its own language, as [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] tells it. Domains ignore each other; only [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] composes them.

| Folder | Holds |
|---|---|
| `iam/` | Identity and access: Accounts and their Sessions, on Better Auth: [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE\|iam]] |
| `mapping/` | The core: an Account's System, a hierarchy of Tiles in six Directions and six Context slots, and the operations on it, over the tiles repository: [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE\|mapping]] |

| File | Holds |
|---|---|
| `kind.ts` | The kinds a domain's error carries (`kind('Conflict')`, `...invalid`), shared by every domain because it sits beside them, not in one: the channel the client picks depends on it |
| `bus.ts` | `Bus`, where a domain publishes a `DomainEvent`, a fact in its language declared with `Schema.TaggedClass`, for others to react to. The API layer builds the bus and wires who reacts: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE\|api]], "The server bus" |
