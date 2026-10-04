---
title: domains
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains
owner: diplo
preview: >-
  The business logic, one folder per domain (IAM, Mapping, Assistant), as
  Effect programs in the domain's language. IAM and Mapping so far; beside the
  folders, kind.ts, the closed set of kinds a domain's error carries, and
  bus.ts, where a domain publishes its events.
---
# domains

The middle layer: one folder per domain, each in its own language. A domain's public entry is its module's operations, Effect programs whose type lists the repositories' services they use; a domain becomes a service of its own only when it holds state or configuration. It never opens a transaction: a change requires one (`InTransaction`), and the API layer opens it, as [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] tells it. Domains ignore each other; only [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] composes them.

| Folder | Holds |
|---|---|
| `iam/` | Identity and access: Accounts and their Sessions, on Better Auth: [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE\|iam]] |
| `mapping/` | The core: an Account's System, a hierarchy of Tiles in six Directions and six Context slots, and the operations on it, over the tiles repository: [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE\|mapping]] |

| File | Holds |
|---|---|
| `kind.ts` | The closed set of kinds the client picks a channel by, shared by every domain because it sits beside them, not in one. A domain's error carries one of the first five (`kind('Conflict')`, `...invalid`); `Unexpected`, the sixth, is no domain's to declare: `run`, in the API layer, gives it to every defect and every failure it does not know |
| `bus.ts` | `Bus`, where a domain publishes a `DomainEvent`, a fact in its language declared with `Schema.TaggedClass`, for others to react to. The API layer builds the bus and wires who reacts: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE\|api]], "The server bus" |
