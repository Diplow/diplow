---
name: skill-reviewer
description: Adversarially review HOW a skill in this repo is written. Tier-named subagents (fetch/work/judge), house frontmatter, specificity, "what to do" over "what not to do", context gathering shown to the user, tool preflight, deliberate context handling, a harness-neutral core, and the house writing tone in both the skill and what it publishes, plus any criteria the skill ships in its own meta-review.md files. Reviews one skill, several, or every skill a diff touches. Use when someone says "review this skill", "is this skill well written", "check my SKILL.md", "/skill-reviewer", or after writing or editing a skill under .skills/. It grades the WRITING of a skill, the process it encodes, not product code (that is maintainability-review or domain-design). It reports findings and does not edit skills.
allowed-tools: Read, Glob, Grep, Bash
title: skill-reviewer
parent: .skills/3-meta/skill-reviewer
owner: diplo
preview: >-
  Grades how a skill is written against references/criteria.md: four hard rules
  (tier-named subagents, house frontmatter, no vague terms, no tone tells) and
  seven judgment calls, plus the skill's own meta-review.md criteria. Run it on
  one skill, several, or a diff to .skills/. Reports findings; edits nothing.
---

# skill-reviewer. Challenge how a skill is written

A skill is a process encoded as instructions. This skill **analyzes** whether that process is written the way this repo writes skills and reports findings. It does not edit, fix or approve anything. It is **advisory**: the author decides what to act on.

The bar lives in [`references/criteria.md`](references/criteria.md): eleven criteria, H1 to H4 hard rules and J1 to J7 judgment calls. That file is also this repo's standard for how to write a skill; read it to understand any finding. A skill can add criteria that only make sense for it by shipping a `meta-review.md` in its own folder (step 4 below).

The workflow is linear and runs in one session. Reading the skill you review is your job, not a context sweep (see the J2 scope note in `criteria.md`), so it needs no delegation.

## Workflow

Copy this checklist and tick items as you go:

```
- [ ] Step 1: Determine which skills to review
- [ ] Step 2: Read the criteria (references/criteria.md)
- [ ] Step 3: Read each skill's WHOLE folder (SKILL.md + every subfolder)
- [ ] Step 4: Load each skill's own extra criteria (every meta-review.md it ships)
- [ ] Step 5: Grade each skill against H1 to J7, then against its M criteria
- [ ] Step 6: Produce one report in the output format below
```

### Step 1. Scope

A skill is a folder under `.skills/` holding a `SKILL.md`, and the folder name is its command. Vendored skills under `.skills/external/` keep their upstream format and are out of scope; if the user points at one, say so and stop.

- **One or several named skills.** Find each folder with `find .skills -path .skills/external -prune -o -type d -name <name> -print`. No hit → tell the user and list the skill names you do find.
- **A branch, a diff, or "my changes".** Resolve `<base>` as `main` if that is a local ref, else `origin/main`, unless the user names another base, so repeated runs resolve scope the same way. If neither resolves, ask the user for the base rather than letting `git diff` fail. Then list the changed files, committed and not:

  ```bash
  git diff --name-only "$(git merge-base <base> HEAD)" -- .skills ':!.skills/external'
  git ls-files --others --exclude-standard -- .skills ':!.skills/external'
  ```

  Map each file to the nearest folder above it that holds a `SKILL.md`; those folders are the scope. A changed file at the root of `.skills/` (`writing-tone.md`, `model-tiers.md`, `conductor-workspaces.md`) belongs to no skill: grade it on H4 and J7 only, in its own block.
- If the scope is still unclear, ask which skill.

### Step 2. Load the bar

Read [`references/criteria.md`](references/criteria.md) in full before grading. Don't grade from memory of it. The criteria carry the exact pass/fail tests and the lexicon H3 depends on.

### Step 3. Read the whole skill, not the diff

For each skill in scope, read its **entire folder**: `SKILL.md`, every file under `scripts/` and `references/`, any other subfolder or asset it ships. How a skill is written is a property of the whole skill; the diff only tells you where to look first. When the scope came from a diff, run `git diff "$(git merge-base <base> HEAD)" -- <skill-dir>` to see what changed, then read the rest for context.

### Step 4. Load the skill's own extra criteria (`meta-review.md`)

Glob `<skill-dir>/**/meta-review.md` and read **every** hit, in path order. Each file declares numbered criteria `M1, M2, …` that you grade alongside H1 to J7: skill-specific rules the generic bar can't express, such as what makes a scenario file a real test. A file applies to the files in **its own folder and everything below it**: a root `meta-review.md` grades the whole skill, `scenarios/meta-review.md` grades `scenarios/*.md`. No hit → grade on H1 to J7 alone and drop the M rows from that skill's table.

A `meta-review.md` is *input to* the review, the way `criteria.md` is. It carries criteria, not process, so you don't grade it against H1 to J7. Two things to check on it, both 🟡:

- A criterion with no pass/fail test you can apply from the skill's text → ask the author for the test.
- A criterion that contradicts H1 to H4 → keep the H rule, apply the rest of the meta-review, and say which criterion clashes. Meta-review criteria **raise** a skill's bar; the H rules stay the repo-wide floor so no single skill can opt itself out of them.

How to write one is in `criteria.md` § "Skill-specific criteria (`meta-review.md`)".

### Step 5. Grade against H1 to J7, then the M criteria

Walk every criterion for every skill:

- **H1 to H4 (hard rules).** Assert with confidence. A subagent with no tier (H1), a broken frontmatter or a job-less `description` (H2), a standalone vague term (H3), an em dash or curly quote or Title Case heading anywhere in the skill (H4) is a 🔴 **Must-fix**. H4 covers the whole skill, frontmatter and fenced output templates included, and reports one finding per file rather than one per instance. Read its protected-literal list before firing: a pinned string a skill greps for or a test asserts on is not a violation. H2's soft items (trigger phrases, boundary line, parent listing, stray `category:`) are only 🟡 nudges. **Never nudge for a `_Created with skill_` footer on SKILL.md**: that footer attributes *artifacts a skill publishes* (PR bodies and comments, Linear tickets, committed reports), not the skill file itself.
- **J1 to J7 (judgment calls).** Raise as 🟡 **Consider**, phrased as a question the author is best placed to answer. Respect the deliberate exceptions the criteria name (living-checklist skills for J1, short skills for J5).
- **M1 to Mn (the skill's own criteria, when it ships a `meta-review.md`).** Grade each file in scope against each criterion. Use the tier the criterion declares: *hard* → 🔴 **Must-fix**, *judgment* → 🟡 **Consider**; a criterion that declares neither is a judgment call. Cite the offending file, not the meta-review file.

Follow the calibration section at the end of `criteria.md`: don't fire H3 on concretized terms, test every cited path before calling it missing (J1), and prefer a few high-signal findings over a long noisy list. Every finding cites `path:line` and **says what to do instead**.

### Step 6. Report

Emit **one** report as your final message, in the format below.

## Output format

For each skill reviewed (the H1 to J7 rows mirror the headings in `references/criteria.md`; if a criterion is added, renamed or retired there, update these rows to match. The M rows come from the skill's own `meta-review.md` files, so they differ from skill to skill):

```markdown
### `<skill-name>`

| Criterion | Verdict |
|-----------|---------|
| H1 tier-named subagents | ✅ / 🔴 / n-a |
| H2 house format | ✅ / 🔴 (soft H2 issues keep ✅, surface under Consider) |
| H3 no vague terms | ✅ / 🔴 |
| H4 no mechanical tone tells | ✅ / 🔴 |
| J1 orchestration vs docs | ✅ / 🟡 / n-a |
| J2 context shown to user | ✅ / 🟡 / n-a |
| J3 what-to-do over what-not | ✅ / 🟡 |
| J4 tool preflight | ✅ / 🟡 / n-a |
| J5 deliberate context handling | ✅ / 🟡 / n-a |
| J6 harness-neutral core | ✅ / 🟡 / n-a |
| J7 human voice | ✅ / 🟡 |
| M1 <criterion name, from the skill's meta-review> | ✅ / 🔴 / 🟡 / n-a |

**🔴 Must-fix**
- `SKILL.md:42`, <problem> → <what to do instead>

**🟡 Consider**
- `SKILL.md:88`, <observation, phrased as a question> → <suggested direction>

_Skill: `<skill-name>`, N must-fix, M consider._
```

One M row per criterion the skill's `meta-review.md` files declare, in file then number order, after J7. Omit the M rows entirely for a skill that ships none. When several meta-review files apply, qualify the id with the file's folder (`scenarios/M1`) so two files' `M1`s stay distinct.

If a skill is clean, say so plainly. An empty findings list with all ✅ is a valid and welcome report. When several skills are in scope, write one `###` block per skill, then a final one-line roll-up.

The report is terminal output, so it carries no `_Created with skill_` footer. If the user wants to paste it into a PR or a Linear comment, end the pasted body with `_Created with skill_ [skill-reviewer](https://github.com/Diplow/diplow/blob/main/.skills/3-meta/skill-reviewer/SKILL.md)`. The `_Skill: <name>, N must-fix, M consider._` line is a per-skill roll-up of what was reviewed, not provenance.

## Notes

- **Advisory, never blocking.** Report findings. Leave editing, committing and commenting on Linear or GitHub to the author, who owns the skill and weighs each finding.
- **Scope.** This reviews the *writing* of a skill, the process it encodes. Whether product code is maintainable is `maintainability-review`; whether its domain boundaries hold is `domain-design`.
- **Dogfooding by construction.** A change to this skill or to `criteria.md` is reviewed by its own new rules, because you read the criteria from the working tree.
