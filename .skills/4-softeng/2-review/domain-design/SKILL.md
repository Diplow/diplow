---
name: domain-design
description: "Decide where a feature's logic belongs before building it (planning) or check it landed in the right place (review), for a layered codebase: API layer on top, domains in the middle, repositories below. Use when asked \"where should this live?\", \"is this in the right domain or layer?\", \"review the domain boundaries of this feature\", or when a feature bridges domains and you must place a decision, a read or a derived concept. It plans and reviews placement; it does not build the layers."
title: domain-design
parent: .skills/4-softeng/2-review/domain-design
owner: diplo
preview: >-
  Places a feature's logic in the right layer and domain. Planning mode turns a
  feature description into a placement map; review mode turns a diff into
  findings with location, reason and destination. A few mechanical questions,
  the failure modes they catch, and the direction from the domain-driven design
  principle.
---

# Domain design. Placing a feature's logic

This is not "apply DDD." It is a short set of mechanical questions that locate business logic and decide where it lives, the failure modes each one guards against, and one direction to hold. The questions are answerable in review ("does this API file import a repository?") rather than by taste. Two modes:

- **Planning.** Run the questions on a feature description before code exists. Output: a placement map, meaning which layer and domain each piece lives in, what each domain must expose, and where the decision lives.
- **Review.** Run them against a diff. Output: one finding per misplacement, as *location, why it is misplaced, where it goes*.

Be the adversary the author didn't have. Give the reason with every misplacement, not only a relocation order. And keep the honesty rails at the bottom in mind: this is a direction with examples, not a rulebook.

The why behind the direction is the principle page `4-software-engineering/2-principles/1-domain-driven-design/CLAUDE.md`. Read it first. This skill applies it; where the two disagree, the principle wins and this skill needs fixing.

cubic runs a condensed copy of the review mode on hexframe pull requests, `4-software-engineering/1-projects/1-hexframe/.cubic/domain-design.md`. A change to the review checks here changes that copy in the same commit.

## The direction

Three layers. The API layer is the thin one.

- **Repositories**, below the domains (`src/domains/<domain>/repositories/`). All the technical complexity: every query, read and write, caching, serialization, third-party clients. A repository never commits a transaction.
- **Domains**, in the middle (`src/domains/<domain>/entities/` and `services/`). All the business logic, written in the domain's own strict language, over plain entities that know nothing of the database. Pure where it can be. **A domain imports no other domain.** When it needs another domain's data, that data arrives as an argument. Each domain exposes a public entry (`src/domains/<domain>/index.ts`) with its entities, its service and a factory such as `createBillingService(db)`.
- **API**, above the domains (`src/api/`). Plumbing (middlewares, controllers, routers) and the **composition of domains**. It asks each domain's service for what it needs, passes one domain's output into another's input, and owns the transaction (`db.transaction(async (tx) => ...)`). It imports no repository, writes no query, and carries no business rule.

Resist adding machinery to look clean: ports, factories of factories, a `composition/` folder. That machinery is usually a sign that some logic is being kept out of the layer it belongs in.

### Rule 1. Presence vs meaning, between API and domain

The hard boundary is API against domain. The test that holds up:

- The API may branch on **composition**. Which source to ask, whether a source has data. "This member has a plan, so ask subscriptions. No active plan, so compose the empty view."
- The API may not branch on **meaning**, what a value implies. "Cancelled plan means blocked." "Covered means the plan's teams intersected with the member's teams." That lives in the domain.

The domain marks the boundary through what it returns. `null` means "no source here, compose the other path". A blocked or not-covered value means "the source applies and the answer is no". Review test: does this API file contain an `if` whose outcome is a policy choice made nowhere else? If yes, move it down. A guard for efficiency like `if (plan === null) return null` is fine. It is presence, and the meaning still lives in the domain.

### Rule 2. The API calls services, never repositories

When the API needs data a domain owns, it asks the domain's service, not its repository. If the read doesn't exist yet, add the method to the service. It may be a one-line delegate to the repository, and that's fine: the point is that the API depends on the domain's public entry, not on its infrastructure.

- Review smell: a file under `src/api/` importing from `src/domains/<domain>/repositories/`, or anything but `src/domains/<domain>/index.ts`. Repoint it to the service and its factory. An import-boundary lint makes this rule enforce itself.
- Honest cost: pure-read service methods are thin pass-throughs. You pay a ceremonial layer so the API never couples to persistence and one rule covers every case. Worth it here. A CQRS codebase might let queries hit a read model directly. Say so, don't pretend the alternative is wrong everywhere.

## Diagnostic questions

### Decision vs errand, for domain against repository

For each branch or statement ask "why is it this way?" A business, product or security answer makes it a **decision**, and it goes in the domain. A technical answer (how to fetch, how to serialize) makes it an **errand**, and it goes in the repository. Two cautions:

- This is the domain-vs-repository split, not API-vs-domain. Use presence vs meaning there. An errand's home is the repository, never a special folder in the API.
- It says nothing about size. Hoisting a one-line decision into its own module and test can cost more than the misplacement did. Weigh it.

### The persona test, an illustration and not a gate

If a rule restates as a story about a real person with no technical vocabulary ("when the account owner cancels the plan, the team loses exports"), it is domain logic. It belongs with the concept that person names, here the plan. A quick ownership check, not a rule that decides on its own.

### Pure functions first, a service only to interleave with I/O

Once the data is fetched, most decisions are pure: values in, values out. Put them in pure functions with plain unit tests and no fakes. Keep a service for orchestration that really interleaves with I/O. In the worked example below, `decideCoverage` and `gatePlanStatus` are pure; `subscriptionService.effectiveFeatures` is the thin orchestration that loads, then applies them.

## Where a decision lives

A derived or cross-cutting concept (authorization, pricing, eligibility) is a function of several domains' data. Don't reflexively give it a domain of its own that bridges the others. Ask:

1. **Decide vs compile.** Separate the *decision* (pure, abstract: "what does this grant?") from its *enforcement* (interpret it live, or compile it into a dumb artifact a fast runtime reads). Kept apart, one decision can feed several enforcement paths, and they can't disagree. A decision welded to one enforcement path usually wants splitting.
2. **Place the decision with the vocabulary it speaks.** The rule "covered means the plan's assigned teams intersected with the member's current teams" speaks plan words: `assignedTeamIds`, the plan status the account owner sets. So the decision belongs in `subscriptions`, even though an entitlements lens consumes it. Splitting a rule from the vocabulary it operates on is the boundary smell. It forces every decision to reach across.
3. **A derived concept belongs to the domain whose semantics define it; the consumer keeps only enforcement.** "Effective features", what a plan grants a member right now including coverage, is a `subscriptions` concept. "Entitlements", the compiled view a middleware checks, is the concept that consumes it. Subscriptions decides; entitlements compiles.
4. **The one cross-domain read that can't go away is essential, not a smell.** Effective access is policy times identity. You can't make the deciding domain autonomous without copying the other domain's state, a copy drifts, and a stale authorization copy is a security bug. So one cross-domain read stays: subscriptions needs team membership from `iam`, and the API reads it from `iam` and passes it in. Accept it. Don't snapshot to dodge it.
5. **Never duplicate a type and re-wrap it to keep domains apart.** A type whose comment says "mirrors X, lives here so we don't import the other domain", plus the loop that copies X into it, is the boundary smell. In TypeScript the consumer doesn't need the owner's type at all: it declares the narrow shape it reads, in its own words, and the owner's value satisfies it structurally. The API passes the value straight through, with no import and no conversion. If that narrow shape keeps growing until it mirrors the owner's type field for field, the boundary is wrong: the concept probably belongs to one domain, and the other should not be consuming it.

## Projection vs source of truth

When a unit produces derived state, ask whether it is a **rebuildable projection** (its freshness depends on several upstream sources) or a **source of truth** (it changes atomically with its own data). Naming it wrong makes the team expect the wrong bugs. A cached entitlements map feels like persisting a plan change, but it is a projection over plans, teams and memberships. Remove a member from a team and the map is stale with no plan changed. That is a security bug, not a data bug. Consequence: "what triggers a rebuild?" is a first-class domain responsibility, and no single upstream repository can own it.

## Placement is not correctness

Run correctness as a separate pass. Everything above rules on *where code lives*. None of it asks whether the rule is *right*, and for an authorization rule that matters most. Moving `decideCoverage` into a tidy pure function says nothing about whether "a plan assigned to zero teams covers nobody" is the intended fail-closed behavior. Check the boundary, empty-set and null cases of each decision, and label that pass apart from the placement pass, so a clean move never reads as a clean rule.

Give each decision a human may have to justify a reason, not a bare boolean. In TypeScript, a discriminated union:

```ts
type Coverage =
  | { kind: "covered"; teamIds: TeamId[] }
  | { kind: "notCovered" }
  | { kind: "planInactive" };
```

## What to run in each mode

- **Planning.** Decision vs errand, persona, decide vs compile, place the decision with its vocabulary, projection vs source of truth. Output: a placement map, each domain's exposed service reads, and the named rebuild triggers.
- **Review.** For each finding give location, why it is misplaced, and where it goes. Checks:
  - an API `if` that decides meaning rather than presence;
  - an API file importing a repository, or anything but a domain's public entry;
  - a domain file importing another domain;
  - a decision that is not pure, or not unit-tested;
  - a type duplicated and re-wrapped to keep domains apart;
  - a decision returning a bare boolean where a reason is owed;
  - a domain or repository owning a transaction, which only the API may do.

## Worked example, a first attempt and its fix

An illustrative case. The shape of the journey is the lesson, not the names.

**Concept.** *Effective features*, meaning "what can this member use right now, and why?", read two ways: a middleware enforces it on every request from a cached map, and the settings page displays it. One definition, so the page never shows a feature the middleware refuses.

**First attempt, the cautionary one.** The decision (team coverage, the active-plan gate, assembling the features) and a duplicate type, `FeatureGrantSpec`, lived in an `entitlements` domain that bridged the others. The cross-domain reads were pulled up into the API through injected ports, bound in a `src/api/composition/` folder full of inline queries. The tells: machinery (ports and a factory), queries in the API, and a type whose comment admitted it mirrored `PlanFeatureSet` "so entitlements doesn't import subscriptions".

**The fix.**

- The decision moved to where its vocabulary is authored, `subscriptions`. `decideCoverage` and `gatePlanStatus` are pure functions in `src/domains/subscriptions/services/coverage.ts`. `EffectiveFeatures` in `src/domains/subscriptions/entities/effective-features.ts` carries `PlanFeatureSet` directly. The entry point is `subscriptionService.effectiveFeatures(planId, memberTeamIds)`.
- `entitlements` kept only enforcement. `compileEntitlements` takes a narrow input type declared in `src/domains/entitlements/`, which `EffectiveFeatures` satisfies structurally, and compiles the cached map. `FeatureGrantSpec` and its re-wrap loop were deleted.
- The API composes services. `src/api/effective-access.ts` asks `iamService.memberTeamIds`, hands the result to `subscriptionService.effectiveFeatures`, and passes that to `entitlementsService.compile`, all inside one transaction. No repository, no query, branches on presence only.
- Net result: one type and one conversion fewer. Complexity went down.

## Honesty rails

- The direction's value is simplicity. Machinery added to look clean is usually logic escaping its layer. Challenge it before adding it.
- "The wiring has to live somewhere" is true. It lives in the API, as composition that calls services, under presence vs meaning. The gain is that constraint, not deleting a layer.
- The service pass-through tax and the one essential cross-domain read are real costs. Name them. Don't pretend they're free.
- The questions find candidates mechanically; ruling on them is still judgment. Whether "effective access" is a first-class concept or just subscriptions plus identity is a ubiquitous-language call, and the principle page gives it to the humans who own the domains. Ask.
- Placement is not correctness. Prove a move preserves behavior with a green typecheck and the test suites that cover the moved code. Never assert it.
