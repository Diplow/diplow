---
title: domains
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains
owner: diplo
preview: >-
  The business logic, one folder per domain (IAM, Mapping, Assistant), each in
  its language and in one shape: an application service, its errors, its
  entities and operations, pure, behind the door the front may import, and its
  concept folders. IAM, Mapping and Assistant's Conversation so far; beside
  the folders, kind.ts, the closed set of kinds a domain's error carries, and
  bus.ts, where a domain publishes its events.
---
# domains

The middle layer: one folder per domain, each in its own language, and each in the shape [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] gives every domain ("Domains"):

| Path | Holds |
|---|---|
| `<domain>.ts` | The application service, the domain's entry, which the API layer calls: Effect programs whose type lists the repositories' services they use, and `Bus` when they publish, which load, decide, write and publish. Impure |
| `errors.ts` | Its refusals, each with a kind (`kind.ts`) |
| `entities/` | Its entities, value objects and aggregate, with their invariants, behind an `index.ts`. Pure |
| `operations/` | Its Operations, changes described as data, the events they make, and `decide` and `evolve`, behind an `index.ts`. Pure |
| `<concept>/` | A sub-model with a life of its own, as Mapping's Help; one may hold a change of its own that the API layer calls as directly as the service, when the service's folder is full (Mapping's import, `mapping/landing/landing.ts`, `hexframe-app-import-export/decisions.md#DEC-11`) |

"Operation" names a change as data; the functions that run one are the application service's. A domain becomes a service of its own only when it holds state or configuration. It never opens a transaction: a change requires one (`InTransaction`), and the API layer opens it, as STACK tells it. Domains ignore each other; only [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] composes them. A domain grows the shape lazily: IAM gets `entities/` the day it has something to put there.

**The door.** A domain's `entities/index.ts`, `operations/index.ts` and `errors.ts` are the front's one way into it, so a rule, a value or a type of the domain's reaches the browser as the domain's own, never a copy. Nothing reachable through them touches a repository, the application service, a concept folder, another domain, Node, the environment or the config, not even through a type-only import: beside `effect`, they reach only the domain's own `entities/`, `operations/` and `errors.ts`, `kind.ts` and `bus.ts`. A domain declares the shapes it reads (Mapping's `entities/rows.ts`), and the repository's rows satisfy them. dependency-cruiser holds both sides, `no-front-past-a-domains-door` and `no-door-reaching-past-the-pure-model`, and `scripts/lint.test.ts` proves each fires.

| Folder | Holds |
|---|---|
| `iam/` | Identity and access: Accounts, their Sessions and their Keys, on Better Auth: [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE\|iam]] |
| `mapping/` | The core: an Account's System, a hierarchy of Tiles in six Directions and six Context slots, and the operations on it, over the tiles repository: [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE\|mapping]] |
| `assistant/` | A conversation with an agent that builds a System: for now the Conversation, one per Account, its Messages, every change to the System whoever made it, the imports and the user's merged navigations, over the conversations repository: [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE\|assistant]] |

| File | Holds |
|---|---|
| `kind.ts` | The closed set of kinds the client picks a channel by, shared by every domain because it sits beside them, not in one. A domain's error carries one of the first five (`kind('Conflict')`, `...invalid`); `Unexpected`, the sixth, is no domain's to declare: `run`, in the API layer, gives it to every defect and every failure it does not know |
| `bus.ts` | `Bus`, where a domain publishes a `DomainEvent`, a fact in its language declared with `Schema.TaggedClass`, for others to react to, and nothing of who acted: the API layer puts the actor on the envelope it carries the event in. The API layer builds the bus, holds an event published in a transaction until it commits, and wires who reacts: [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE\|api]], "The server bus" |
