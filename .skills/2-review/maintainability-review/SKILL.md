---
name: maintainability-review
description: "Hold a change to the maintainability bar and report a PASS/FAIL verdict with tagged findings. The bar: a small mental model, complexity at the altitude it belongs to, a model carried by names and types rather than prose, opinions enforced by a type, a lint or a check, and tests that pin behavior and survive refactors. Findings carry a tag (model, altitude, emergence, enforcement, lean, test, direction), a level, an MR-n id and a fix. Reviews a PR number, a branch, or the workspace diff against main. Use on \"/maintainability-review <PR#|branch>\", \"is this maintainable\", \"does this stay simple\". Not correctness, security, line-level cleanups, or layer placement (`domain-design`)."
allowed-tools: Read, Glob, Grep, Bash, Task
title: maintainability-review
parent: .skills/2-review/maintainability-review
owner: diplo
preview: >-
  Grades a pull request, a branch or the current workspace diff against the
  maintainability bar: seven tags, each with a pass/fail test. Writes the
  change's model in two sentences before reading the diff, then reports a
  PASS/FAIL verdict and up to eight findings, each with an MR-n id, a level, a
  location and a named fix.
---

# maintainability-review. The bar a change clears before it lands

This skill grades a change against one question: **will the next reader of this area hold less in their head after this change than the author did?** It reports a PASS or FAIL verdict and a list of findings. Each finding has a tag naming which part of the bar it fails, a level, an id and a fix. The definitions and the pass/fail test of every tag live in [`references/tags.md`](references/tags.md). Read that file before grading. Don't grade from memory of it.

The principle this skill enforces is `4-software-engineering/2-principles/5-maintainability/CLAUDE.md`. Its seven checks are the seven tags; if the two disagree, the principle wins and this skill needs fixing.

It reads and reports. It never edits code, commits, pushes, or posts to GitHub or Linear. The report goes to the terminal.

## What it reviews

One argument, three forms. The base is `main` unless a PR says otherwise.

| Argument | Head | Base |
|---|---|---|
| A PR number, `/maintainability-review 42` | `refs/pr/42`, fetched from the PR | the PR's `baseRefName` |
| A branch name, `/maintainability-review feat/hex-12-invoices` | that branch, local or `origin/<branch>` | `origin/main` |
| Nothing | the current workspace: `HEAD` plus uncommitted changes | `origin/main` |

The third form covers the trunk-based case: a repo that lands on `main` without a PR still gets its change reviewed before the fast-forward.

In every form the working tree stays on its branch. The skill never checks out another branch, which is what keeps it safe inside a Conductor workspace (`.skills/conductor-workspaces.md`).

## Workflow

Copy this checklist and tick items as you go:

```
- [ ] Step 0: Inputs and preflight
- [ ] Step 1: Context, code-blind (PR or commits, ticket, CLAUDE.md chain; file names, not hunks)
- [ ] Step 2: Write the model in two sentences, before any diff
- [ ] Step 3: Read the diff and grade against references/tags.md
- [ ] Step 4: Report
```

### Step 0. Inputs and preflight

Resolve the head, the base and the diff command for the argument's form. Below, `<head>` and `<diff>` stand for what this step sets.

- **PR number.** `gh auth status` must succeed; if it fails, print the command and stop. Read the base with `gh pr view <PR#> --json baseRefName`, then `git fetch origin <base>`. Fetch the PR head into a ref instead of switching branches: `git fetch origin pull/<PR#>/head:refs/pr/<PR#>`. `<head>` is `refs/pr/<PR#>`; `<diff>` is `git diff origin/<base>...refs/pr/<PR#>`.
- **Branch name.** `git fetch origin main`, and `git fetch origin <branch>` when the branch is on the remote. `<head>` is the local branch if it exists, else `origin/<branch>`; `<diff>` is `git diff origin/main...<head>`.
- **Nothing.** `git fetch origin main`. `<head>` is `HEAD`; `<diff>` is `git diff $(git merge-base origin/main HEAD)`, which includes uncommitted changes and leaves out whatever landed on `main` since the branch was cut. `git status --short` lists untracked files; read the new ones directly, they are part of the change. If the diff is empty, say so and stop.

Read surrounding code at `<head>`, not in the working tree, unless the form is "nothing": `git show <head>:<path>` and `git grep <pattern> <head> -- <path>`.

### Step 1. Context, code-blind

Read everything around the change before the change itself, so the model you write in Step 2 comes from intent, not from the code's shape. The one allowed peek at the diff is the **file list** (`<diff> --name-only`, plus untracked files in the "nothing" form), which you need to find the direction for the touched areas.

Delegate this sweep to one **fetch-tier** subagent (cheap read and summarize, Haiku on Claude Code; mapping in `.skills/model-tiers.md`) and work from the recap it returns, so the raw PR and ticket text stay out of your session. The subagent reads, in this order:

1. **The stated intent.** For a PR, `gh pr view <PR#>`: title, body, linked ticket. For a branch or the workspace, the commit messages, `git log --format='%s%n%b' origin/main..<head>`.
2. **The ticket.** The Linear key `HEX-123` comes from the branch name (`{type}/hex-{num}-{slug}`), the PR body or the commits. Fetch it with `mcp__hodor__Linear_mcp_Personal__get_issue`: the problem, the intent, what is out of scope. No key or no connector: one line saying so, and move on.
3. **The direction.** For each touched area, the `CLAUDE.md` chain from the repo root down to the touched directory, and a `STACK.md` on that path when there is one. Note whether the area has an enforced direction (a lint, an import boundary, a stated rule) or none.
4. **The file list.** Names only.

Show the recap to the caller, five lines at most.

### Step 2. Write the model, before any diff

From the recap only, write **two sentences**: what the change is, in the smallest big picture that is still true, and what larger thing it serves. If two sentences can't hold it, that is a `model` finding on the change's framing. Keep this text. It opens the report, and Step 3 measures the code against it.

### Step 3. Read the diff and grade

Read the full diff, `<diff>`. Read surrounding code when the diff calls something the recap didn't cover, and stay at the altitude of the model. You are not line-hunting for bugs or security holes; that is a separate review.

Grade against every tag in `references/tags.md` with its pass/fail test. A finding is one location, one sentence on what the reader is forced to hold, one sentence naming the fix. Level per the tag's rule: 🔴 **must-fix** when the test says so, else 🟡 **should-fix**. More than eight findings is itself a 🔴 `model` finding (split the change): keep the eight that cost the reader most and count the rest there.

Number the findings `MR-1`, `MR-2` and so on, in report order. An id is stable within the report: the verdict line, the model paragraph and any follow-up in the same conversation refer to a finding by it. A new run is a new report and numbers from `MR-1` again.

### Step 4. Report

Emit **one** report as your final message, in English, in the format below. The head SHA comes from `git rev-parse --short <head>`; in the "nothing" form, add `+ uncommitted` when the working tree is dirty. Voice per `.skills/writing-tone.md`: short sentences, concrete nouns, the fix named, no praise.

## Output format

```markdown
**Verdict: FAIL.** 2 must-fix (MR-1, MR-2). Reviewed `feat/hex-12-invoices` at `abc1234` against `main`.

**Model.** <sentence 1>. <sentence 2>. <one sentence on the diff: "The diff reads
as advertised." or exactly what forced the model to grow.>

### Findings

- **MR-1** 🔴 `altitude` · `src/domains/gateway/swap.ts:88`
  Every caller of `swap()` has to know the upstream credential is fetched
  lazily and can be `undefined`. Hide that behind `upstream.credential()` and
  return the resolved value or throw.
- **MR-2** 🔴 `enforcement` · `src/state/agents.ts:12`
  The change decides that state files never import from `src/components/`, and
  nothing enforces it. Add an `eslint-plugin-boundaries` rule in
  `eslint.config.mjs` for `src/state/**`.
- **MR-3** 🟡 `test` · `src/domains/gateway/swap.test.ts:40`
  The test asserts the private helper was called, so it survives a behavior
  change and dies on a rename. Assert on the response the caller sees instead.
- **MR-4** 🟡 `direction` · no line
  The PR body promises a follow-up for the area's `CLAUDE.md` and no ticket
  exists. Open it and link it, or drop the promise.

_4 findings (2 must-fix). Head `abc1234`._
```

Rules the format encodes:

- **Verdict** is `PASS` when there is no 🔴 finding, else `FAIL`. Never anything else.
- The verdict line names what was reviewed: `PR #42`, the branch, or `the workspace`, with the head SHA and the base.
- The verdict line, the `Model` paragraph and the roll-up line are always present. `### Findings` appears only when it has entries. A clean pass reads `**Verdict: PASS.** No findings.` plus what was reviewed, the model paragraph, and the roll-up.
- A finding is one header line (id, level emoji, tag in backticks, location) and one or two sentences. The location is `` `path:line` `` at the head, or the words `no line` for a finding about the change as a whole: its framing, a missing doc, a missing ticket. The text must stand alone without the header, so it can be pasted as a PR comment on that line. Levels and tags are data, so the emoji stay (see the exceptions in `.skills/writing-tone.md`).

## Notes

- **Advisory.** The verdict is for the human deciding whether the change lands. Nothing blocks on it.
- **Disagreeing is cheap.** A finding that is wrong for this change gets a one-line reason from the human, and that is the end of it. Don't argue it back.
- **Run it after a correctness review.** Correctness first, then this. It needs nothing from that review.
