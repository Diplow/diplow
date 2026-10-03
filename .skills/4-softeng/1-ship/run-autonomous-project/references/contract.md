---
title: The run contract
parent: .skills/4-softeng/1-ship/run-autonomous-project
owner: diplo
preview: >-
  What every level of an autonomous run shares, read first by every agent: the
  two ways in, the landing modes, config keys, the five-field summary, claim
  verification, the hard rules, the path guard, registers, Linear conventions,
  branch names, delegation tiers and models.
---
# The run contract. What every level shares

Every agent in a run reads this file first, whatever its level: project orchestrator, unit agent, helper, and the initiative's root when there is one. It holds the rules that bind all of them, the summary every level returns, and the conventions the run reads state from. Your role file tells you what to do. This file tells you what stays true while you do it.

Paths such as `references/unit.md` are relative to `skill_dir`, this skill's directory, which every brief passes as an absolute path.

## Two ways in

A **project run** starts from `/softeng:ship:run-autonomous-project` on one Linear project. An **initiative run** starts from `/softeng:ship:run-autonomous-initiative`, whose root runs this skill once per project, in order. The files here serve both. What changes is who sits at the top.

| | project run | initiative run |
|---|---|---|
| top of the run, in the main session | the project orchestrator | the root |
| project orchestrator | level 0 | level 1, spawned by the root |
| unit agent | level 1 | level 2 |
| helpers | level 2 | level 3 |
| halt and resume entries | status updates on the project | status updates on the initiative |

The **top of the run** is the one agent with a terminal. It prints the launch summary and the final one, writes the halt and resume entries, and turns a `halted` summary into a stop. Its preflight, resume and halt steps, shared by both ways in, are in `references/top.md`.

## Trunk-based: every unit lands on the target branch

Every unit lands on one branch, the **target branch**, written `<target>` in commands: `repo.target_branch` from the config, `main` when the key is absent. The top resolves it once, in preflight, and passes `target` down in every brief. Each ticket is a short-lived branch cut from `origin/<target>`, and it lands back on `<target>` as soon as its gates are green. Later tickets start from a `<target>` that already holds the earlier ones. Several small landings beat one long branch.

When `<target>` is `main`, `main` is the only long-lived branch. When the config names another one, it is the one other long-lived branch, and it lives for one run: a **project branch** such as `project/design-system` in a project run, an **initiative branch** such as `initiative/hexframe-v0` in an initiative run, where the units of every project land on it one project after the other. The run never merges it into `main`: a human does, once the run is done (after the project's phase-close ticket, or after the initiative's last project). Inside an initiative run there is no branch per project: a project boundary is a gate run on `<target>`, not a merge.

How a unit lands depends on the target repo. The top decides it once, in preflight, and passes `landing` down in every brief:

| `landing` | When | How a unit lands | "Landed" means |
|---|---|---|---|
| `pr` | the default | a pull request into `<target>`, merged by the run once gates, CI and review rounds are done (`references/pr-loop.md`) | the pull request is `MERGED` into `<target>` |
| `direct` | the target repo's root `CLAUDE.md` or `STACK.md` says changes land directly on `main` | a fast-forward of `<target>` to the unit branch, then a push (`references/pr-loop.md`, "Direct landing") | the branch tip is an ancestor of `origin/<target>` |

In `direct` landing, every step that exists only for a pull request (CI wait, review wait, review rounds) is skipped. The local gates are the only check before `<target>`.

### The home branch

The working tree is shared, and the run switches it between unit branches. The **home branch** is the branch the top was on at launch: the workspace's own branch in a Conductor workspace (see `.skills/conductor-workspaces.md`). Between units, and whenever an agent returns, the tree sits on the home branch with nothing uncommitted. To look at `<target>` itself (gate re-runs, the path guard), use `git switch --detach origin/<target>` after `git fetch origin`, then switch back home. Never `git checkout <target>`: the tree belongs to the home branch, and in a Conductor workspace `main` is checked out in the original folder, where the checkout fails.

## The config is the only source of run settings

The run config is a YAML file committed in the target repo and named at invocation (`--config`). Read it from the working tree at the absolute path your brief gives you. A human reviews it before launch, so the run treats it as read-only: no agent edits it, and the path guard halts the run if a run commit touches it.

Keys, when each is needed, and who reads them. `always` keys are needed by both kinds of run, `initiative` keys by an initiative run only, `pr` keys by `pr` landing only.

| Key | Needed | Read by | Meaning |
|---|---|---|---|
| `version` | always | top | must be `1`; anything else fails preflight |
| `team` | always | all | Linear team, `Hexframe` here |
| `initiative` | initiative | root | Linear initiative name |
| `repo.branch_pattern` | optional | project, unit | defaults to `{type}/hex-{ticket}-{slug}`. `{type}` is one of `feat`, `fix`, `refactor`, `docs`, `chore`, chosen from what the ticket asks. `{ticket}` is the ticket number without the team key, `{slug}` is 2 to 5 lowercase words from the title joined by `-` |
| `repo.target_branch` | optional | top | the branch every unit branches from and lands on, `main` when absent. Any other value is a project branch in a project run, or an initiative branch in an initiative run, created from `origin/main` by preflight if the remote lacks it (`references/top.md`). The top passes the resolved value down as `target` |
| `repo.merge_strategy` | pr | unit, project | `merge` or `squash`, passed to `gh pr merge`. Never `rebase`: the path guard and state reads rely on one landing commit per pull request |
| `repo.working_tree`, `parallelism` | always | project | `shared` and `1`: one working tree, one unit at a time |
| `projects[]` | always | top | `name`, `on_exhausted` (`halt` or `park`) and `mint_tickets` per project. An initiative run takes them in this order; a project run reads the entry whose `name` is its project |
| `models.phase` | initiative | root | the model of the project orchestrator the root spawns |
| `models.*`, the rest | always | whoever spawns | the concrete model for each role; see "Delegation" below |
| `gates.unit`, `gates.phase`, `gates.fix_rounds_per_gate` | always | unit, project, root | shell commands that must exit 0, and the fix-round cap. `gates.phase` is the project's gate set, run on `<target>` once its units have landed |
| `reviews.automated`, `reviews.max_rounds`, `reviews.must_fix`, `reviews.should_fix` | pr | unit, project | the automated reviewers to wait for (an empty list skips the wait), the round cap, and the reviewer levels that count as must-fix and should-fix |
| `reviews.clean_marker` | optional | unit, project | the phrase an app reviewer writes in its summary comment when it found nothing, for reviewers that report a clean review only that way |
| `halting.never`, `halting.frozen_paths`, `halting.read_only_paths` | always | all | the `never` list, frozen paths, read-only paths |
| `halting.frozen_after` | optional | top | paths frozen once a given project is completed |
| `registers.dir`, `registers.files` | always | all | the directory and files where the run writes its deliverables, one subdirectory per project (see "Registers") |
| `registers.security_bugs` | optional | unit | a rule for security findings left open, applied as written |
| `summary_schema` | always | all | the five fields below |
| `linear.*` | always | all | the state names to use, and when status updates are posted |

The keys named `phase` belong to the project level. In an initiative each project is a phase, and the names stay so that a config written for an initiative run keeps working unchanged.

A key the run needs that is absent from the config is a halt, not a guess. An optional key is used when present.

## The summary every level returns

Each agent's final message to its parent is this block and nothing else. A parent that receives a transcript, a narrative or a block with a missing field treats it as a false claim (see "Verify every claim").

```yaml
status: done | parked | halted
landed: <pull request URL (pr landing), commit SHA on <target> (direct landing), or none>
register_entries: [<path>#<entry id>, ...]   # entries this level added, path under registers.dir
parked: [<ticket>#PARK-n: <one line>, ...]    # everything left for a human
interventions: [<one line>, ...]             # what only a human can do next, or did
```

| `status` | Means | The parent then |
|---|---|---|
| `done` | this level's work landed on `<target>` with gates green. For a project: every unit is done or parked, and `gates.phase` is green on `<target>`. `parked` may still list smaller items left behind | verifies the claim, then continues |
| `parked` | the cap ran out under `on_exhausted: park`. Nothing landed; the branch, and its pull request if any, stay open. One `PARK-n` entry with evidence exists | verifies the entry exists, then continues with the next ticket |
| `halted` | the run must stop. The first `interventions` line says why and what would unblock it | stops spawning and returns `halted` upward with the same line |

What gets parked is the smallest item that failed, and code lands only while its gates are green. A unit whose gates stay red is parked whole and does not land. A unit whose gates are green but whose review threads outlive the round cap lands, returns `done`, and parks the unresolved threads. Under `on_exhausted: halt` both cases return `halted` instead and nothing lands.

A project returns `parked` only when `gates.phase` stays red on `<target>` after the fix rounds. An initiative's later projects build on that code, so the root stops the run on a `parked` project the same way it does on `halted`.

## Verify every claim

A subagent's summary is a claim, and claims have been false before. Before a parent records anything from a summary it re-derives the fact itself:

- "landed", `pr`: `gh pr view <url> --json state,mergedAt,baseRefName` shows `MERGED` into `<target>`.
- "landed", `direct`: after `git fetch origin`, `git merge-base --is-ancestor <sha> origin/<target>` exits 0.
- "gates green": the parent fetches, switches to a detached `origin/<target>`, and runs the gate commands itself, then switches back home. Send the output to a log file and read only the exit code, so a long log never enters an orchestrator's context:
  `mkdir -p "$(git rev-parse --git-dir)/run-logs"; <cmd> > "$(git rev-parse --git-dir)/run-logs/<name>.log" 2>&1; echo "exit=$?"`.
- "ticket Done, comment posted": `get_issue` and `list_comments` show it.
- "parked with evidence": `list_comments` on the ticket shows the park comment holding the `PARK-n` entry.

A claim that fails verification gets one repair attempt, described in the role file. A second failure is `halted`.

## Hard rules

These hold at every level and in every brief. Each role file adds the few that only bite at its level.

1. **Every line of `halting.never` in the config is a hard rule.** Read the list now. When you write a brief, paste the list into it verbatim, because a helper sees only its brief.
2. **Land only your own branch, only on `<target>`, only when green.** A unit lands its own branch once its gates are green, and in `pr` landing once CI and review rounds are done too. No agent force-pushes, pushes to a branch the run did not create other than `<target>`, or lands anything that bypasses its own gates. In `direct` landing the only push to `<target>` is the fast-forward in "Direct landing". When `<target>` is not `main`, nothing the run does reaches `main`.
3. **Linear writes stay inside the plan.** The run updates the state and comments of tickets that already belong to its projects, mints tickets only through the planner inside the current project, posts status updates, and moves a project between started and completed. It creates no project and edits neither an initiative nor any project description. The Linear tools here cannot read or write an initiative at all, only list its projects and post its status updates, so nothing depends on its description.
4. **Frozen and read-only paths stay untouched.** `.github/`, the config file, every `halting.frozen_paths` and `halting.read_only_paths` entry, and every `halting.frozen_after` entry whose project is completed. The check is mechanical, see "Path guard". When the ticket cannot be finished without such an edit, stop and take the exhaustion path with kind `forbidden-path`. A gate stays as strict as the run found it: the fix for a red gate is in the code under test.
5. **Decide or park, never ask.** Nobody is watching the session. Wherever a supervised skill such as `do-ticket` would ask the user (which ticket, which mode, is this recap right, may I post), take the answer from the config, the ticket or the repo's `CLAUDE.md` files. When none of them answers and the choice changes what ships, park the item with the question written in the entry.
6. **Orchestrators delegate, leaves work.** The root and the project orchestrator never read diffs, logs, review threads or Linear list payloads in their own context and never edit product code. Work they did not expect becomes a helper brief. This is what keeps a run that lasts days inside one context window per orchestrator.
7. **Commit early, leave the tree as you found it.** The working tree is shared. Commit work in progress to your own branch rather than stashing or resetting it, and before you return, switch to the home branch and confirm `git status --porcelain` prints nothing. `git reset --hard`, `git clean`, `git stash`, force pushes and extra worktrees are out: the next agent trusts what it finds.
8. **Secrets stay out of every artifact.** A token, key or password never appears in a commit, log excerpt, comment, pull request, screenshot or summary. Quote the variable name, not the value.

## Path guard

Build the pathspec list from `halting.frozen_paths`, `halting.read_only_paths`, the config file's own path, `.github/`, and `frozen_now`: the `paths` of every `halting.frozen_after` entry whose project is completed, which the top of the run computes and passes down in every brief. Prefix each with `:(glob)` so `**` and `*` behave as written in the config.

```bash
# unit, before every commit: staged files that match must be none
git diff --cached --name-only -- ':(glob).github/**' ':(glob)<entry>' ...

# unit, before landing: what the branch changes since it left <target> must match none
git diff --name-only origin/<target>...HEAD -- <pathspecs>

# project orchestrator, after a unit lands: commits that reached <target> since the unit started
git log --format='%H %an %s' <target_before>..origin/<target> -- <pathspecs>
```

`<target_before>` is the `origin/<target>` SHA the project orchestrator recorded right before spawning the unit. An initiative's root runs the same `git log` form over a whole project, described in the `run-autonomous-initiative` skill.

Anything these print is a violation, and the level that sees it returns `halted`, naming the SHA (or file) and the path. The `git log` form also lists a commit a human pushed to `<target>` during the run. The halt names the author so a human can tell. A human who confirms the commit is theirs clears the halt by resuming: the unit is already Done, so a resumed run does not check it again.

## Registers

`registers.dir` holds the run's deliverables, one markdown file per name in `registers.files`, stored by project in `<registers.dir>/<project slug>/`. `<project slug>` is the Linear project's name in lowercase, every run of characters outside `a-z0-9` replaced by one `-`, with no `-` at either end: `API response typing` gives `api-response-typing`. `<project registers>` below means `<registers.dir>/<project slug>`.

What belongs in a register, and its entry format, comes from the ticket and the repo's `CLAUDE.md` files. The run only requires that an entry rides the branch of the unit that found it, lands with it, and is listed in that unit's summary. `registers.security_bugs` is a rule for those entries, apply it as written.

Create a file with a one-line heading if it is missing, and number its entries from the highest id already in that file. An id is unique within its file only, so wherever an entry is cited outside it (a summary, a status update, a comment, a pull request) cite it as `<path under registers.dir>#<id>`, for example `api-response-typing/decisions.md#DEC-2`.

### What the run records in Linear, not in git

With no long-lived run branch, nothing can carry a record of a unit that did not land. So the run's own two records live in Linear.

**Park entries.** One park comment per ticket (the phase-close ticket for a project-level park), posted by whichever level parks something, and edited in place to add later entries. Its first line is pinned, because a resumed run finds it by matching it. Entries are numbered within the ticket and cited as `<ticket id>#PARK-<n>`, for example `HEX-42#PARK-1`:

```markdown
**Parked**

### PARK-<n> <title>
- when: <ISO date>
- kind: gate-exhausted | review-exhausted | review-missing | forbidden-path | ci-timeout | open-question | harness-depth
- evidence: <the failing command and its last lines, or the thread URLs, or the question>
- state left: <branch, pull request URL and whether it is open or merged>
- to pick it up: <what a human or a later run would do first>
```

**Halt and resume entries.** Status updates on the top's Linear object (the project in a project run, the initiative in an initiative run), written by the top only. Number them from the highest `INT-n` among that object's earlier status updates. First line pinned:

```markdown
**INT-<n> halt** | **INT-<n> resume**

- reason: <why a human had to act, from the halting summary>
- needed: <what would unblock the run>            # halt entries
- found on resume: <commits on <target> and ticket state changes since the halt>   # resume entries
```

## Linear conventions

The Linear tools are the personal Linear MCP's, with the prefix `mcp__hodor__Linear_mcp_Personal__`. Below they go by their short names: `get_issue`, `save_issue`, `list_issues`, `list_comments`, `save_comment`, `list_projects`, `get_project`, `save_project`, `list_issue_statuses`, `save_status_update`, `get_status_updates`. There is no initiative tool: `list_projects` with `initiative` lists an initiative's projects, and `save_status_update` and `get_status_updates` with `type: "initiative"` post and read its status updates. Pass `team` from the config when `save_issue` creates a ticket.

- **States** come from `linear.state_in_progress`, `linear.state_in_review` and `linear.state_done`. A ticket in a canceled or duplicate state is skipped.
- **The phase-close ticket.** Each project has exactly one ticket whose title ends with the words `phase close`, compared case-insensitively after trimming, for example `Billing A: phase close`. It is blocked by every unit ticket of the project, it owns the project close (the `gates.phase` run on `<target>` and any fix it takes), and it is the last ticket the project closes. Zero or several matches in a project is a plan error the run cannot repair, so the project returns `halted`.
- **The closing comment.** One per ticket, posted by the agent that owns the ticket when it reaches `done`, `parked` or `halted`. Its first line is pinned, because a resumed run finds the comment by matching it:

  ````markdown
  **Run summary**

  ```yaml
  <the summary block>
  ```

  _Created with skill_ [run-autonomous-project](https://github.com/Diplow/diplow/blob/main/.skills/4-softeng/1-ship/run-autonomous-project/SKILL.md)
  ````

- **Status updates** take the same footer. The footer names the skill whose level wrote the artifact: an initiative's root links [`run-autonomous-initiative`](https://github.com/Diplow/diplow/blob/main/.skills/4-softeng/1-ship/run-autonomous-initiative/SKILL.md) on its own status updates. Their voice, like every comment and pull request the run writes, follows `.skills/writing-tone.md`.

## Branch names

Fill `repo.branch_pattern` (or its default) with the ticket's type, number and a slug. To find a branch that may already exist, match on the ticket number, not on the type or slug, since two agents can derive two slugs from one title:

```bash
git ls-remote --heads origin "*/hex-<ticket>-*"      # the pattern with {type} and {slug} replaced by *
```

One match is the branch. Several matches is `halted` with the names listed.

Push a unit branch only once it holds its first commit. In `direct` landing a pushed branch whose tip is on `<target>` reads as landed, and an empty branch would read that way too.

## Delegation

Spawn with the harness's subagent tool (`Agent` on Claude Code, agent type `general-purpose`) and wait for the result in the foreground: the run is sequential by design. The harness allows three subagent levels below the main session, and a level-three agent has no subagent tool, so helpers are leaves. An initiative run uses all three levels, a project run two. Reading a skill's files adds no level: the agent that follows them is the one doing the work.

That depth is a property of the harness the skill targets, and preflight can only see the first level. When your role file tells you to spawn a subagent and you have no subagent tool, the harness is shallower than the hierarchy needs: change nothing, and return `halted` with kind `harness-depth` and your level in the summary. Doing a child's work in your own context instead is the failure this hierarchy exists to prevent.

| Role | Tier | Model key |
|---|---|---|
| project orchestrator, when the root spawns it | **judge** | `models.phase` |
| unit agent | **work** | `models.unit` |
| planner, fix-up | **work** | `models.planner`, `models.fixup` |
| reviewer | **judge** | `models.reviewer` |
| fetch and lookup | **fetch** | `models.fetch` |

The project orchestrator is judge tier because it rules on its units' claims and decides whether a whole project continues, parks or halts. In a project run it is the main session, whatever model that runs. Pass the config's value as the spawn's `model` parameter. When a key is absent, or the harness cannot pin a model, use the tier's mapping in `.skills/model-tiers.md` and still delegate.

Every brief, at every level, carries these lines before its task: the absolute path of this skill's directory, the absolute config path, `landing`, `target`, `home_branch`, the initiative (`none` in a project run), the project, `on_exhausted`, `frozen_now`, the `halting.never` list verbatim, and the instruction to read this file first and to return the summary block, or the helper's own return format, as its whole final message.
