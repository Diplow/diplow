---
title: Skill review criteria
parent: .skills/3-meta/skill-reviewer
owner: diplo
preview: >-
  The bar skill-reviewer grades against, and this repo's standard for how to
  write a skill. Four hard rules (H1 to H4) and seven judgment calls (J1 to J7),
  each with its rule, its why, its check and examples, plus how a skill adds
  its own criteria in a meta-review.md, and how to keep the findings few and useful.
---
# How a skill here should be written. The review criteria

This is the checklist `skill-reviewer` grades against, and it doubles as this repo's standard for **how to write a skill**. If you are writing a skill, read this first; the reviewer will hold you to it.

A skill **orchestrates a process**. It is a set of instructions a capable agent follows to get a repeatable job done the way I want it done. Every criterion below serves one goal: keep the skill a thin, honest, current description of the process, and push everything else (fundamentals, reference data, tool setup) to where it belongs.

These eleven criteria apply to every skill of mine under `.skills/`. Vendored skills under `.skills/external/` keep their upstream format and are not graded. A skill that needs criteria only it can state, because its content has a shape the generic bar doesn't describe, adds them in a `meta-review.md` of its own; see "Skill-specific criteria" near the end.

## How the tiers work

- **Hard rule (🔴 Must-fix).** Checkable from the skill's text alone. The reviewer reports a violation with high confidence. These are close to lint rules.
- **Judgment call (🟡 Consider).** Needs a reading of the skill's intent. The reviewer raises it for the author to weigh and never asserts it as definitely wrong.

Every finding, in either tier, **states what to do instead**, not just what is wrong. A criterion that only forbids fails its own bar (see J3).

---

## H1. Every subagent names its cost tier *(hard)*

**Rule.** Wherever a skill delegates work to a subagent ("spawn a subagent", "delegate the sweep to …", a subagent tool call), it names the **cost tier** that subagent runs on: `fetch`, `work` or `judge`. The tiers and their model per harness live in `.skills/model-tiers.md`. Add one clause of why when the choice isn't obvious. Harness-specific machinery, such as an explicit `model:` parameter in a tool call, states the concrete model for its harness instead. That is the mapping applied.

**Why.** Model choice is a cost and quality decision the author makes whether they write it down or not. Naming it makes the decision reviewable and stops an expensive model doing a cheap job, or the reverse. Tier language keeps the prose true on every harness (Claude Code and Codex don't share model names); the tier file owns the translation.

**How the reviewer checks.** Grep the skill for delegation language, then for a tier or a concrete model nearby. A delegation with neither → 🔴. A prose delegation naming only a vendor model ("spawn a Haiku subagent") → 🟡: suggest tier language, with the concrete model as the Claude Code mapping in parentheses.

- ✅ "Delegate the sweep to a **fetch-tier** subagent (cheap read and summarize, Haiku on Claude Code; mapping in `.skills/model-tiers.md`)."
- ✅ A tool call carrying `model: haiku`. Claude Code machinery pinning the fetch tier's model for its harness.
- ❌ "Delegate the context sweep to a dedicated subagent that returns a recap." → **What to do instead:** name the tier, "… a dedicated **fetch-tier** subagent that returns a recap." Pick the cheapest tier that can do the job and say why if it isn't obvious.

---

## H2. House format is present *(hard)*

**Rule (hard part).** A skill is a folder under `.skills/`, outside `external/`, holding a `SKILL.md`. The folder name is the command (`/do-ticket`), so it is unique across the whole `.skills/` hierarchy. `.skills/sync` links every skill flat into `.claude/skills/` and exits on a duplicate name. `SKILL.md` opens with YAML frontmatter carrying:

- `name`, equal to the folder name;
- `description`, non-empty, saying **what job the skill is for and when to trigger it**, so the agent fires it at the right moment;
- the four fields every Markdown file in this repo carries (see `STACK.md`): `title`, `parent` (the skill's own folder from the repo root, such as `.skills/3-meta/skill-reviewer`), `owner`, and `preview` of at most 350 characters;
- `allowed-tools`, for a review skill.

`name` and `description` stay **single-line scalars**. Claude Code's frontmatter parser is line-based, so `description: >-` (a YAML block scalar) yields an empty description and the skill silently never fires. An unquoted value containing `: ` is the mirror trap: Claude Code accepts it, strict YAML parsers reject the whole block. `preview` is read by me and by agents browsing the repo, not by the skill loader, so `preview: >-` is fine.

Every other Markdown file the skill ships (`references/*.md` and the like) opens with the same four fields, `parent` pointing at the skill folder.

**Recommended (soft, raise as 🟡, not 🔴).**

- Explicit **trigger phrases** in the description ("Use when someone says …").
- Where a sibling is easy to confuse it with, a **boundary line** ("… that is `other-skill`").
- The skill is listed in its parent folder's `CLAUDE.md`, the table that presents the node's children.
- No `category:` field. The folder the skill sits in carries its category here; a leftover `category:` is noise.

**Why.** The `description` is what makes the agent trigger the skill; an empty or job-less description means the skill never fires. The four fields are how a reader, human or agent, decides whether to open a file without opening it. A duplicate name breaks `.skills/sync` for every skill. All of that is load-bearing, hence hard. Trigger phrasing and the parent listing are polish: helpful, not required. Nudge, don't block.

### The attribution footer is about artifacts, not about SKILL.md

`_Created with skill_ [<name>](<link to the skill's SKILL.md on GitHub>)` is an **attribution line on things a skill publishes outward**: a PR body or comment, a Linear ticket or comment, a committed report. It tells a reader who did not run the skill which skill produced what they are looking at, so they can run it themselves or fix it. GitHub, Linear and committed Markdown all take this standard Markdown form.

A footer at the bottom of SKILL.md serves nobody. The file is not an artifact the skill created, and its only readers are the agent, which needs no attribution, and the skill's author, who is standing in it. **Never nudge for a footer on SKILL.md.** If you see one, it is stray: the convention was misread.

**What to check instead.** For a skill that posts, comments, files or commits something a human will read elsewhere: does it tell the model to attribute that artifact? If it publishes outward with no attribution anywhere → 🟡 **Consider**. Terminal-only output is not a finding: nothing is left behind to attribute. A terminal report the skill invites the user to *paste* somewhere is an artifact, though, and the footer belongs in the pasted body.

**How the reviewer checks.** List the skill folders (`find .skills -path .skills/external -prune -o -name SKILL.md -print`) and compare folder names for a duplicate. Read the frontmatter of every Markdown file in the skill. Any of these → 🔴: a missing or duplicate name, a `name` that differs from the folder, a missing or empty `description` or one that doesn't say when to use the skill, a block-scalar or unquoted-`: ` `name` or `description`, a missing four-field block on any Markdown file, a `parent` that isn't the skill folder, a `preview` over 350 characters, a review skill without `allowed-tools`. A present-but-triggerless description, no boundary line against a near sibling, a skill missing from its parent `CLAUDE.md`, or a stray `category:` → at most 🟡, phrased as a nudge.

- ✅ A dense `description` with "Use when someone says 'start HEX-123' …" and boundary lines against sibling skills.
- ✅ A skill that opens a PR ends the PR body it writes with the footer, and puts it nowhere else.
- 🟡 A skill that opens a PR or comments on a Linear ticket with no attribution on the artifact. → **Consider:** add the footer line to what it publishes, so a reader who didn't run it can find the skill.
- ❌ `description:` empty or reading only "Does stuff." → **What to do instead:** write what the skill is for and when to use it, with trigger phrases.
- ❌ `references/tags.md` with no frontmatter. → **What to do instead:** open it with `title`, `parent` (the skill folder), `owner` and `preview`.

---

## H3. No vague qualitative term left un-concretized *(hard)*

**Rule.** Adjectives and adverbs that sound like instruction but carry no checkable meaning may not stand alone. If the skill says to do something "carefully", the very next clause says *what careful looks like here*.

**Why.** "Review it properly" tells the agent nothing it didn't already intend to do. Vague terms are where a process silently drifts. Two readers read "as needed" two different ways.

**How the reviewer checks.** Scan for the lexicon below, then ask, for each hit: *is it made concrete (a specific action, threshold or example) in the same sentence or the next one?* If yes, it passes. A vague-sounding word used as a lead-in to a concrete spec is fine. If it stands alone, it is a finding.

Lexicon (non-exhaustive): *carefully, properly, appropriately, correctly, as needed, as appropriate, robust, robustly, high-quality, thoroughly, sensibly, reasonable, clean, gracefully, where relevant, etc.*

- ✅ "Gather context **proportionally to the ticket's size (a one-line fix needs a glance; a feature needs the full sweep)**." The vague "proportionally" is concretized on the spot.
- ❌ "Handle errors gracefully." → **What to do instead:** name the errors and the behavior. "On a 404 from the API, tell the user the resource is gone and stop; on a 5xx, retry once then surface the status."

---

## H4. No mechanical tone tells *(hard)*

**Rule.** A skill's files carry none of the four mechanically checkable tells from the house tone reference, `.skills/writing-tone.md`: em dashes (its rule 13), curly quotes (19), Title Case Headings (17), decorative emoji in a heading or leading a bullet (18). That file is the standard; this criterion grades the part a grep can settle, and J7 grades the rest.

**Scope.** The whole skill, not just the diff. The skills here were written to the tone reference from the start, so there is no grandfathered backlog to be fair about: any hit is either new or a protected literal. That includes the places a skill's prose hides in plain sight, its frontmatter `description` and the output templates inside fenced blocks. Both are ordinary prose and both reach a human reader.

**Why.** These four are what a reader clocks before reading a word of content, and spotting them needs no judgment, which is what puts them in the hard tier.

**How the reviewer checks.** `grep -rn '—' <skill-dir>` plus a scan for curly quotes, Title Case headings, and emoji in headings or at the head of a bullet. Report **one finding per file**, with the count and the first two `path:line` examples, never one finding per instance. The Exceptions section of `.skills/writing-tone.md` says what is not a finding; in short:

- **Emoji that carry meaning**, such as the 🔴 / 🟡 / ✅ severity markers in a report. They are data, not decoration.
- **A string something else must match**: text a skill greps for (a marker a later run searches for in a previous report), product copy a test asserts on byte for byte, and code inside fenced blocks. The test is whether changing the character breaks a match. If the skill explains why the literal is pinned, that is the author doing this right, not a violation to report.
- **A line the diff touched only** to rename an identifier or renumber a criterion.
- **A tell quoted as the thing to fix**, such as the ❌ example below.

- ✅ A new paragraph that ends a clause with a period where an em dash would have gone, and a heading reading "How the reviewer checks".
- ❌ A change adds "The sweep is delegated — cheap, and it keeps context clean." → **What to do instead:** "The sweep is delegated, which is cheap and keeps context clean." Or split it in two sentences.

---

## J1. Orchestration vs. documentation split *(judgment)*

**Rule.** A skill orchestrates a process; the **fundamentals of what it orchestrates belong in documentation**, not inlined in the workflow. Documentation here means a `references/` file next to the skill, a shared reference at the root of `.skills/`, or the repo's own pages: the principles in `4-software-engineering/2-principles/`, a node's `CLAUDE.md`, `STACK.md`. Stated precisely: **if a skill integrates a loop, the loop's fundamentals are described in documentation as context for the rest of the loop, not inside the skill**. Inlining them is the fastest way to make them stale or inconsistent with the other places that describe the same thing.

**Why.** Fundamentals that live in five skills drift in five directions. Point to one source of truth and every skill stays consistent when it changes.

**How the reviewer checks.** Look for blocks of *domain knowledge*, such as architecture rules, design principles, or the anatomy of a shared concept, that read like reference material rather than steps. Check whether the skill instead **points** to a doc. A reference-style "living checklist" skill is the deliberate exception (the checklist *is* the artifact): note it, don't insist.

> **Verifying referenced docs exist.** Everything a skill here can point to lives in this repo, so check every path it cites: a backticked repo path, a `references/` path relative to the skill folder, or a `[[wikilink]]`, which resolves from the repo root with `.md` added. A cited path that doesn't exist is a 🟡 **Consider**: "referenced `4-software-engineering/2-principles/foo/CLAUDE.md` not found. Is the path right, or is the page still to be written?"
>
> **Test each path; never describe the layout from memory.** Existence is a fact, so establish it with a command, not an impression: `test -e "<path>"` per cited path, or one `find` whose output you actually read. Quote the path exactly as the skill writes it. A report that characterizes the tree ("the principles are flat now") without a listing behind it can invert the finding, telling the author to "fix" the paths that work and bless the ones that don't. If you did not run the check, say so instead of guessing.

- ✅ A review skill grades against the checks in `4-software-engineering/2-principles/5-maintainability/CLAUDE.md` and calls itself the per-PR projection of that page, instead of restating the convictions.
- ✅ A skill keeps its tag list in `references/tags.md` and reads it at the step that needs it.
- 🟡 A skill inlines the whole domain-driven design rulebook. → **Consider:** point to `4-software-engineering/2-principles/1-domain-driven-design/CLAUDE.md` (or a `references/` file) instead, so the two can't drift.

---

## J2. Context gathering is first, delegated, and shown to the user *(judgment)*

**Rule.** *If* a skill needs to gather broad context before acting, it (a) does so **first**, (b) delegates the sweep to a dedicated subagent so the raw material stays out of the main session, and (c) **shows the gathered context to the user** before going on.

**Why.** The user is often the best judge of context and can spot what's missing, but only if the skill shows them. And a sweep's raw dumps pollute the main session's judgment when they aren't delegated.

**How the reviewer checks.** Does the skill gather context at all? If so: is it up front, is it delegated (with a named tier, see H1), and is there an explicit "show it to the user" beat? A skill that sweeps inline and never surfaces the result is the finding.

> **Scope note, so the rule doesn't over-fire.** This targets *broad context sweeps*: reading across docs, tickets, neighboring code to orient before work. A skill reading the specific artifact it operates on (a review skill reading the diff it reviews; this skill reading the skill under review) is doing its job, not gathering context, and is out of scope.

- ✅ `do-ticket` delegates the sweep to a subagent, then opens its next step by relaying the recap to the user before asking anything, because that is the moment a misunderstanding is cheap.
- 🟡 A skill greps six sources inline and jumps straight to acting. → **Consider:** move the sweep into a dedicated subagent up front and add a beat that relays the recap to the user before the first change.

---

## J3. Prefer "what to do" over "what not to do" *(judgment)*

**Rule.** When a skill forbids something, check whether it can say what to do instead. A prohibition is fine when the positive is open-ended or the temptation is strong, but then **explaining why** beats the bare rule.

**Why.** "Don't do X" leaves the agent to guess the intended path. "Do Y" removes the guess. And a rule with its reason attached survives edge cases the author didn't foresee, because the agent can reason from the why.

**How the reviewer checks.** Find prohibitions ("never", "do not", "don't", "avoid", "NOT"). For each: could it be phrased as the positive action? If it must stay a prohibition, is the why given?

- ✅ "**Never** switch the workspace to another branch without the user's go-ahead: repointing the branch repoints what the workspace is." A strong prohibition, kept, with its reason (`.skills/conductor-workspaces.md`).
- 🟡 "Don't make the report too long." → **Consider:** say the target instead, "Keep the report under 15 lines; link to the full findings", which is actionable where the prohibition is not.

---

## J4. Tools and setup are verified up front *(judgment)*

**Rule.** A skill that depends on tools, credentials or environment (a CLI, an MCP server, an API key, network access) **verifies they are present before it relies on them**, ideally in a dedicated subagent so the probing stays out of the main session, and tells the user what to fix if something is missing.

**Why.** Discovering a missing login halfway through a run wastes the whole run and can leave the workspace half-changed. A preflight fails fast and cleanly.

**How the reviewer checks.** Does the skill assume a tool, a credential or network? Is there a preflight that checks for it and a clear "here's how to fix it" path? "Verify in a subagent" is a recommendation, not a hard rule: an inline preflight is acceptable, and is the right call for a short skill.

- ✅ A skill that opens PRs runs `gh auth status` first and, if it fails, tells the user to run `gh auth login`.
- 🟡 A skill calls the Linear MCP tools (`mcp__hodor__Linear_mcp_Personal__*`) with no check that they are loaded. → **Consider:** add an up-front check ("call `mcp__hodor__Linear_mcp_Personal__list_teams`; if the tool is missing or fails, tell the user to connect the MCP server that provides it") before the first dependent step.

---

## J5. Deliberate context handling for heavy skills *(judgment)*

**Rule.** For ambitious or heavy skills (many phases, large inputs, lots of reading), consider an **orchestrator-only top session** that delegates tasks to subagents and hands each exactly the context it needs, rather than doing every heavy phase inline and bloating one session.

**Why.** One session that reads everything and does everything runs out of clean context and starts making worse decisions. Splitting the work keeps each agent's context tight and its judgment sharp.

**How the reviewer checks.** Is this a heavy skill, with several large phases? Does it pour all of them into one session, or does it delegate phases to subagents, each with a named tier (H1)? This is a *scale* judgment. A short linear skill needs none of this and should not be nagged toward it.

- ✅ A skill that runs a whole Linear project keeps its top session as a coordinator and hands each ticket to a **work-tier** subagent with only that ticket's context, then a **judge-tier** subagent reviews each result.
- 🟡 A long skill runs five heavy phases inline in one session. → **Consider:** make the top session an orchestrator that delegates each phase to a subagent with just that phase's context.

---

## J6. Harness-neutral core; detect and adapt *(judgment)*

**Rule.** A skill's default flow assumes no particular harness or platform: not Conductor, not a given OS, not even Claude Code over Codex (both run SKILL.md files). Where a harness changes the right behavior, the skill **detects** it and adapts, layering the adaptation by reliability and token cost:

1. **Deterministic script detection** where a script already exists. An env-var branch in bash costs zero tokens and can't be skipped (a start script branching on `CONDUCTOR_WORKSPACE_PATH`, for example).
2. **One inline conditional line** in SKILL.md for what the *model* does differently when the harness is detected.
3. **A reference file** carrying the harness explanation, read only when the condition fires. Facts several skills share live at the root of `.skills/` (`.skills/conductor-workspaces.md`), so reorganizing one skill can't break another's pointer; a fact used by one skill stays in that skill's own `references/`.

The frontmatter `description` stays harness-neutral. Descriptions load into every session, whatever the harness.

**Why.** Most sessions here run in Conductor on Claude Code, but not all of them, and the skills should survive a change of tool. Inline harness prose taxes every invocation everywhere; detection limits the cost to the sessions it serves. And per J1, a harness fact explained in several skills drifts. One reference, pointed to.

**How the reviewer checks.** Harness or platform names in the `description` → 🟡. Steps in the default (undetected) path that require a specific harness → 🟡. Multi-paragraph harness explanations inline where a pointer to `.skills/conductor-workspaces.md` or another shared reference would do → 🟡 (J1 applied to harness facts).

- ✅ `do-ticket`'s start script detects Conductor itself; SKILL.md spends one paragraph on it and points to `.skills/conductor-workspaces.md` for the model.
- 🟡 A skill whose step 1 is "open the Conductor workspace" with no detection. → **Consider:** gate it on `CONDUCTOR_WORKSPACE_PATH` and give the plain git path as the default.

---

## J7. Human voice, in the skill and in what it publishes *(judgment)*

**Rule.** Prose reads like a person wrote it. The vocabulary, puffery, filler, hedging, passive-voice, abstract-metaphor and plain-speech rules in `.skills/writing-tone.md` apply to two things: the skill's own text, and every artifact the skill tells the model to write, meaning Linear tickets and comments, PR bodies and comments, committed reports, a terminal report a human will paste. A skill that composes outward text **points to the tone reference** rather than restating tone rules of its own, per J1.

**Why.** A skill's prose sets the register the agent then writes in, so a SKILL.md full of "crucial", "leverage" and "not just X but Y" produces tickets and PR comments full of them. Those leave the session: I read the ticket later, a reviewer reads the PR comment, anyone can read a committed report in this public repo. Tone is the part of a skill's output nobody can lint after the fact.

**How the reviewer checks.** Read the Language, Filler, Jargon and Plain speech sections of the tone reference, then scan the skill (the diff first, when there is one) for hits. Raise the **two or three strongest**, each quoting the phrase and giving the replacement. Don't list every "additionally": that is noise, and it buries the H findings. Separately: does this skill publish text? If so, does it defer to the tone reference, or has it grown a private tone section that will drift from it?

- ✅ A PR-description skill keeps one section on GitHub's own conventions (headings the PR template expects, closing keywords) and leaves voice to the tone reference.
- 🟡 A skill's report template opens with "This PR represents a pivotal step in enhancing the platform's billing landscape." → **Consider:** say what changed and what it fixes. "This PR rounds invoice totals per line, so a three-line invoice no longer drifts by a cent."
- 🟡 A skill writes its own six-line "keep the tone professional and concise" block. → **Consider:** replace it with a pointer to `.skills/writing-tone.md`, so the house voice has one home.

---

## Skill-specific criteria (`meta-review.md`)

H1 to J7 grade *any* skill, so they can only talk about the shape all skills share. Some skills carry content with a shape of its own (a set of scenario files, a generated report template, a checklist meant to be run verbatim) where "is this written well" has a concrete, local answer. A skill states that answer itself, in a **`meta-review.md`** in its own folder, and `skill-reviewer` grades it alongside H1 to J7 (its step 4).

**Where the file goes.** In the folder whose files it grades: it applies to that folder and everything below. `<skill>/scenarios/meta-review.md` grades the scenario files next to it; `<skill>/meta-review.md` grades the whole skill. A skill may ship several.

**What goes in it.** Numbered criteria `M1, M2, …`, each with the same four parts the criteria above use, so a finding is actionable without a conversation:

- **Rule.** One sentence, and the tier it grades at: *(hard)* → 🔴, *(judgment)* → 🟡. Say which; unmarked reads as judgment.
- **Why.** What breaks when the rule is broken. The reviewer quotes it back to the author, and it is what lets the reviewer reason about a case you didn't foresee.
- **How the reviewer checks.** The pass/fail test, applied to the file's text. A criterion the reviewer can't test from what is written is one it will skip or guess at, so write the test down.
- **✅ / ❌ examples**, ideally lifted from files the skill ships, with the ❌ carrying its *what to do instead*.

**What it may not do.** Criteria here **add** to H1 to J7. Where one contradicts a hard rule, the reviewer keeps H1 to H4 and flags the clash. The hard rules are the repo-wide floor, and a per-skill file that could waive them would make the floor a suggestion. Everything a criterion asserts must be checkable in the skill's own files: `meta-review.md` grades *writing*, like the rest of this file, and leaves runtime behavior to the skill's tests.

**The file is criteria, not process.** It opens with the four frontmatter fields like any Markdown file here, and the reviewer does not grade it against H1 to J7. Keep the why of the process itself in the SKILL.md or the reference it points to (J1): a meta-review names the properties a file must have; it is not a second home for the fundamentals.

- ✅ A `scenarios/meta-review.md` with two criteria on what makes a scenario a test (it asserts an action's effect; every step says why it is there), each with its check and examples from a scenario file next to it.
- ❌ A `meta-review.md` reading "M1. Scenarios should be well written *(hard)*." → **What to do instead:** name the property and its test. "M1. Every scenario step pairs an action with an assertion on what that action changed *(hard)*. Check: each numbered step contains both a verb on the product and an `Assert:` clause."

---

## Calibration. Keep the signal high

The reviewer's value is in findings an author will act on. So:

- **Only H1 to H4 are asserted with confidence.** J1 to J7 are raised as "Consider", phrased as a question the author is best placed to answer. A skill's own M criteria are asserted at the tier they declare. The author wrote them for this skill, so a hard M is as firm as an H.
- **Don't fire H3 on concretized uses.** A vague word that leads into a concrete spec passes. When unsure whether a term is concretized, leave it.
- **Respect deliberate exceptions.** A "living checklist" skill inlines its checklist on purpose (J1); a two-line skill needs no orchestrator (J5). Note the tension once; don't crusade.
- **Never invent compliance you can't see.** Say what you checked and what you couldn't, such as a path you didn't test (J1) or a tool you couldn't probe (J4).
