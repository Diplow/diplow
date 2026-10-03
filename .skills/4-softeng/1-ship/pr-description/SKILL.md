---
name: pr-description
description: Write a pull request description a reviewer can grasp at a glance, the smallest visual that carries the change, why it exists, and a link to the canonical artifact (Linear ticket, issue, doc) instead of restating it. Use when opening a PR, when asked to "write the PR description", or when do-ticket reaches the PR-open step. Reusable across any project.
title: pr-description
parent: .skills/4-softeng/1-ship/pr-description
owner: diplo
preview: >-
  Write a PR body a reviewer grasps at a glance: one small visual of the change,
  why it exists, how it was tested, and a link to the ticket (Closes HEX-123)
  instead of restating it. Opens the PR against main. Use when opening a PR or
  when do-ticket reaches that step. Not for repos that land directly on main.
---

# PR description. Visual first, linked, brief

A PR description is where the next reader, the reviewer, and the merger all decide *what this change is* before reading a line of the diff. It works when it opens the diff at a glance and **links the canonical artifact** rather than paraphrasing it: the ticket carries the intent, the description points to it and shows the shape of the change.

It is the natural close of [`do-ticket`](../do-ticket/SKILL.md)'s work. A repo that lands changes directly on `main` (its `CLAUDE.md` or `STACK.md` says so) has no PR, so this skill doesn't apply there.

## The shape

Lead with the smallest visual that carries the change, then the minimum prose around it:

- **What.** One or two sentences, then the visual. Reach for the view that matches the change: a file-tree `diff` for a new module or refactor, a call tree for a control-flow change, a `mermaid` sequence for a new interaction, a component-tree `diff` for UI. Pick one; don't stack them.
- **Why.** The reason this exists, in a sentence. If the reason is the ticket, link the ticket and stop.
- **Risks / testing.** What a reviewer should look at hardest, and how you verified it (checks passing, manual steps). Skip if genuinely trivial and say so.
- **Link the artifact.** Every PR links its ticket (`Closes HEX-123` / the issue) so the chain `ticket → branch → PR` stays traversable. A PR with no link is usually one hiding its intent.

A file-tree `diff` for a new domain module, as an example of the size to aim for:

```diff
 src/
   domains/
     billing/
+      invoice.ts
+      invoice.test.ts
       index.ts
```

## Rules

- **Show, don't restate.** If a diagram or a diff makes the point, use it instead of a paragraph. The description's job is the *shape* of the change; the diff is the detail.
- **One visual, the smallest that works.** More than one usually means the PR does more than one thing; consider splitting it, not adding a second diagram. Small PRs that merge fast beat one long branch.
- **Link, never paraphrase, the ticket.** Long context belongs in the Linear ticket or a doc; write it there, link it here.
- **Call out what the diff hides.** Facts the reviewer can't see from the diff: a version bump, a generated file regenerated, a migration, a config flag flipped.
- **Voice follows `.skills/writing-tone.md`**: no AI tells, plain words, a human register, in whatever language the repo's PRs use. Not restated here.

## Writing it

Draft the body and open the PR in one step, against `main`. Close it with the attribution footer, so a reviewer who didn't run the skill can trace where the description came from:

```bash
gh pr create --base main --title "<conventional title>" --body "$(cat <<'EOF'
## What
<one or two sentences>

<the smallest visual>

## Why
Closes HEX-123.

## Testing
<checks / manual steps, or "trivial, no behavior change">

_Created with skill_ [pr-description](https://github.com/Diplow/diplow/blob/main/.skills/4-softeng/1-ship/pr-description/SKILL.md)
EOF
)"
```

On an existing PR, `gh pr edit <n> --body "$(cat <<'EOF' … EOF)"` replaces the description in place. Show the draft to the user before pushing it if they're around; a PR description is outward-facing.
