---
title: The maintainability bar
parent: .skills/4-softeng/2-review/maintainability-review
owner: diplo
preview: >-
  The seven tags maintainability-review grades against: model, altitude,
  emergence, enforcement, test, lean, direction. Each has a rule, a why, a
  check, a level rule for must-fix vs should-fix, and one example finding.
  Ends with calibration rules. Read in full before grading.
---

# The maintainability bar. Seven tags, each with its test

`maintainability-review` grades a change against these seven tags. Every finding carries exactly one. A tag names which part of the bar the change fails and, by naming it, which kind of fix applies. Read this file in full before grading.

The bar rests on the three convictions of `4-software-engineering/2-principles/5-maintainability/CLAUDE.md`, in order: the smallest mental model wins; complexity hides at the altitude it belongs to; simplicity emerges from the code and is enforced.

Each tag below has a rule, a why, the check, the level rule (when 🔴 must-fix, when 🟡 should-fix) and one example finding written the way the report wants it.

---

## `model`. The change can't be stated small

**Rule.** The two-sentence model written from context alone (Step 2) survives the diff. The diff may refine it; it may not replace it or double it.

**Why.** If the code surprises a reader who knew the intent, every later reader is surprised too, and the PR description, the ticket and the docs describe a different change than the one that ships.

**Check.** After reading the full diff, rewrite the model. Count the concepts the new version needs that the old one didn't. Zero or one is a pass. Two or more fails, and so does a change whose intent needs more than two sentences even from context. More than eight findings across all tags also fails here: the change is too big to hold, and the fix is a split.

**Level.** 🔴 when the model grew by two or more concepts, or the fix is to split the change. 🟡 when it grew by one concept that the PR description or the commit message could carry.

- `model` 🔴 `src/domains/billing/send-invoice.ts:1`
  The ticket says "send an invoice"; the diff also introduces draft versioning
  and a background reconciler, three concepts for one intent. Split the
  reconciler and the versioning into their own changes, or name the whole in
  the ticket and the description.

---

## `altitude`. Complexity leaks above where it belongs

**Rule.** A reader working at a given level (a router, a service, a component) does not have to hold a detail that belongs below it (a retry policy, a cache key format, a credential that may be missing).

**Why.** Leaked detail is paid on every read of the calling code, forever. Hidden detail is paid once, by whoever opens the interface.

**Check.** For each complication the diff made you hold, ask three things. At what level did I first need it? Can a named interface with clear arguments hold it one level down? Does the top level get simpler if it does? Yes to all three is a finding. Propose the interface in the repo's existing conventions (a method on an existing class, a function in the existing module), not a new pattern.

**Level.** 🔴 when the leak sits in code the next ordinary change to the area will call or edit: an exported service function, a shared hook, a router. 🟡 when it sits in a leaf a reader can skip.

- `altitude` 🔴 `src/domains/gateway/swap.ts:88`
  Every caller of `swap()` has to know the upstream credential is fetched
  lazily and can be `undefined`. Hide that behind `upstream.credential()` and
  return the resolved value or throw.

---

## `emergence`. The model lives in prose, not in code

**Rule.** What the change means is readable from names, signatures and types. A comment, a doc comment or a doc page may add the *why*; it may not be the only place the *what* exists.

**Why.** Prose goes stale the first time someone edits the code and not the sentence. A name or a type gets edited with the code, or the build breaks.

**Check.** Cover the comments and docs the diff adds and read the code alone. If you can no longer say what a function, field or component is for, prose is propping up the model. Also the reverse: a doc that restates what a clear signature already says is noise, and belongs in the finding as "delete".

**Level.** 🔴 when a public name or signature is wrong or empty (`data`, `handle`, `process`, an `any` or a `Record<string, unknown>` where a typed shape exists) and a comment does the job the name should. 🟡 when a private helper's name is weak, or a doc restates an interface.

- `emergence` 🔴 `src/state/agents.ts:31`
  `applyUpdate(payload: Record<string, unknown>)` needs its doc comment to say
  which keys it accepts. Type the payload as `AgentPatch` and drop the comment.

---

## `enforcement`. An opinion nothing keeps true

**Rule.** When the change decides how things are done in an area (a layering rule, a naming scheme, "state files never import components", "every router calls `requireWorkspace`"), something automated says no when the rule is broken. Cheapest first: a type or a lint rule (token-free, fails the build), then a CI check, then a doc that states the direction.

**Why.** An unenforced opinion is one option among the many an agent will pick from next week. Enforcement turns the opinion into the only way.

**Check.** List the rules the diff introduces or relies on. For each, name what fails when it is broken. "Nothing fails" is a finding only when the problem already exists: the diff does the thing two ways, or the repo has broken this rule before (a fix commit, a review thread, a stale doc). "This could drift" alone is not a finding; that is the `lean` tag applied to the reviewer. Propose the enforcement, name the file it lives in, and say in one clause why it earns its friction, since every check is a cost on everyone who works in the area.

**Level.** 🔴 when a type or a lint rule under roughly twenty lines would enforce it and the change added none. 🟡 when only a CI script or a doc can carry it.

- `enforcement` 🔴 `src/state/agents.ts:12`
  The change decides that state files never import from `src/components/`, and
  nothing enforces it. Add an `eslint-plugin-boundaries` rule in
  `eslint.config.mjs` for `src/state/**`.

---

## `test`. Tests that don't pin behavior, or don't survive refactors

**Rule.** A test added or changed by the diff fails when the behavior it covers changes, and passes when the implementation is rewritten with the same behavior. Both, not one.

**Why.** A test that mirrors the implementation is a second copy of it: it passes on a behavior regression and fails on every rename, so people delete it. A test that asserts nothing observable is documentation with a green badge.

**Check.** For each test in the diff, imagine two edits. Change the behavior: the test must fail. Rename or reorder the internals: the test must pass. Mocks of the unit's own private helpers, assertions on call counts of internals, and snapshots of internal structures fail the second edit. A behavior the change adds with no test at all fails the first.

**Level.** 🔴 when the change adds behavior a user or another module observes and no test would fail if that behavior broke. 🟡 when a test pins internals but another test already asserts the behavior it covers, or the rewrite touches one test file.

- `test` 🟡 `src/domains/gateway/swap.test.ts:40`
  The test asserts the private helper was called, so it survives a behavior
  change and dies on a rename. Assert on the response the caller sees instead.

---

## `lean`. Code for a problem nobody has yet

**Rule.** A caller in the change exercises everything the diff adds, or the ticket asks for it. A parameter, branch, flag, config knob, abstraction or extension point kept "for later" is not.

**Why.** Speculative code is paid for on every read and never pays back until the problem shows up, if it does. When it does, the shape it needs is rarely the one guessed. The cheapest time to solve a problem is the day you can see it.

**Check.** For each new parameter, branch, option or abstraction, grep its callers in the change. One value ever passed, a branch no test reaches, an interface with one implementation, a setting nothing reads: each is a finding, and the fix is delete. The ticket's stated scope counts as a caller.

**Level.** 🔴 when the unused path adds a concept to the model (an interface, a mode, a flag) that every reader of the area now has to hold. 🟡 when it is a dead parameter or branch a reader can skip.

- `lean` 🔴 `src/domains/billing/send-invoice.ts:14`
  `sendInvoice(invoice, { dryRun = false } = {})` has no caller passing
  `dryRun`, and the ticket does not ask for a preview. Delete the option and
  its branch.

---

## `direction`. The area has no stated direction, or the change moved it silently

**Rule.** The area the diff touches has a direction a reader can find: a `CLAUDE.md` on the path from the repo root to the touched directory, a `STACK.md`, an import boundary. If the change shifts that direction, the same change updates it.

**Why.** Agents read the `CLAUDE.md` chain before they read code. An area with no direction and a growing pile of generated code is where the next change picks a pattern at random. A direction the code no longer follows is worse than none.

**Check.** From the Step 1 recap: does the touched area have a direction? Does the diff follow it? Does the diff change what the direction should say (a new layer, a retired pattern, a new rule) without editing the file that says it? A missing `CLAUDE.md` is a finding when the diff adds more than a small edit, roughly fifty lines, to an area with no direction.

**Level.** 🔴 when the diff contradicts a stated direction, or changes it without updating the file. 🟡 when the area has no direction and the diff adds to it.

- `direction` 🔴 `src/domains/billing/CLAUDE.md:1`
  The diff moves payment retries out of `src/domains/billing/services/` into
  the payment repository, and this `CLAUDE.md` still says retries live in
  services. Update it in this change.

---

## Calibration

- One tag per finding. When two fit, pick the one whose fix you are proposing.
- Cite the line where the reader first pays, not every line that pays.
- A finding without a named fix is not a finding. Cut it or finish it.
- `lean` binds the reviewer too. Propose a mechanism (a lint, a check, an abstraction) only for a problem you can point at in this diff or this repo.
- The bar is the whole diff against the base, not the last commit.
- No praise. A clean pass says `PASS` and stops. What is good is what the verdict already says.
