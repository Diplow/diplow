---
title: Project orchestrator
parent: .skills/1-ship/run-autonomous-project
owner: diplo
preview: >-
  The project orchestrator's role: load the project through a fetch helper,
  mint tickets when the config allows, run one unit agent per ticket so each
  lands on the target branch, verify every claim, then close the project with
  its gates run on the target branch. Writes briefs, never code.
---
# Project orchestrator. One project, its units landed on the target branch one by one

You take one Linear project from its tickets to all of them landed on `<target>`, or parked, with the project's gates green on `<target>`. In a project run you are the main session, started by this skill's `SKILL.md`. In an initiative run you are a level-one agent, spawned by the root. The steps are the same; the brief says which case you are in. You orchestrate. Unit agents do the tickets, helpers do everything else, and your own context holds only briefs, summaries, exit codes and one-line facts. Read `references/contract.md` before anything else.

## Your brief

`project`, `initiative` (`none` in a project run), `config` (absolute path), `skill_dir` (absolute path), `landing`, `target`, `home_branch`, `on_exhausted`, `mint_tickets`, `frozen_now`, and the `halting.never` list. A missing field is `halted` with its name, before you touch anything. Whether the run is resumed changes nothing at this level, except in a project run where you are also the top: the state tables read the same either way.

## Steps

### 1. Load the project

Spawn a **fetch-tier** helper (`models.fetch`) with the "project snapshot" brief from `references/helpers.md`. It returns the project id and state, the phase-close ticket, and every other ticket with its state, `blockedBy`, closing and park comment status, branch and pull request. You never call `list_issues` yourself: the payload is large and you need ten lines of it.

Identify the phase-close ticket by the title convention in the contract. Zero or several is `halted`.

**Done when** you hold an ordered unit list: a topological sort on `blockedBy`, ties broken by ascending ticket number, the phase-close ticket excluded.

### 2. Start the project

Pick the row of the project table in `references/state.md` and act on it. For a project to run, set it to started (`save_project` with `state: "started"`) if it is not, and the phase-close ticket to `linear.state_in_progress`.

### 3. Mint tickets, when the config says so

Only if `mint_tickets` is true and the snapshot shows the phase-close ticket as the project's single ticket. Spawn the **work-tier** planner (`models.planner`, brief in `references/helpers.md`). It reads the project description and the repo's `CLAUDE.md` files, creates unit tickets in this project only, chained with `blockedBy` in execution order, and makes the phase-close ticket blocked by all of them. Every ticket must trace to a line of the project description; work the description does not ask for is scope expansion and is left out.

Verify with a fresh project snapshot that each ticket the planner lists exists in this project, then post a project status update that links every minted ticket. Replace your unit list with the new order.

### 4. Run the units, one at a time

For each ticket in order, pick its row in the ticket table of `references/state.md`. Rows that skip cost nothing. Before a row that spawns, `git fetch origin` and record `target_before`, the `origin/<target>` SHA. Rows that spawn use the **work-tier** unit agent (`models.unit`) with this brief:

```text
You are a unit agent in an autonomous run. Read <skill_dir>/references/contract.md,
then <skill_dir>/references/unit.md, and follow them.
ticket: <id>              landing: <pr|direct>   target: <branch>
home_branch: <name>
project: <name>           initiative: <name or none>
config: <absolute path>   skill_dir: <absolute path>
on_exhausted: <halt|park> resume_at: <fresh|implement|review|close|repair>
frozen_now: <pathspecs>   parked_before: <ids or none>
halting.never:
<the list, verbatim>
Return the summary block from the contract as your whole final message.
```

When the summary comes back, verify it (contract, "Verify every claim"), then:

- **`done`**: confirm it landed, run `gates.unit` yourself on a detached `origin/<target>` into a log file, switch back home, and run the orchestrator form of the path guard from `target_before`. Green and no guard hit: next ticket. Red: spawn the unit agent once more for the same ticket with `resume_at: repair` and `repair_log`. If that repair does not return `done`, or your re-run is red again, return `halted`: a red `<target>` cannot be parked, since every later unit builds on it.
- **`parked`**: confirm the ticket's park comment holds the `PARK-n` entry, that you are on the home branch and that `git status --porcelain` prints nothing. Add the ticket to `parked_before`. Next ticket. A ticket whose blocker was parked still runs: `blockedBy` is the execution order, and the unit agent parks itself if the missing code stops it.
- **`halted`**, or a guard hit: stop the loop and return `halted` with the unit's first `interventions` line.
- **A malformed summary**: re-read the ticket's state from Linear and git, and act on the row it now selects, once. A second malformed summary is `halted`.

### 5. Close the project

1. **Project gates.** `git fetch origin`, switch to a detached `origin/<target>`, run `gates.phase` into a log file, and switch back home. Green: go to 3.
2. **Fix rounds.** Red: the phase-close ticket owns the fix. One **work-tier** fix-up helper (`models.fixup`) per fix round, given the log path, working on the phase-close ticket's branch (cut from `origin/<target>` on the first round, named from the branch pattern). Then land that branch the way a unit does: the PR loop in `references/pr-loop.md` with the phase-close ticket as owner and fix-up helpers as the fixer, or its "Direct landing". You run the loop's commands and spawn the fetch-tier, judge-tier reviewer and work-tier fix-up helpers it names; the fix-up helper that made a change writes the thread reply. Run the unit form of the path guard on the branch before landing. Then run `gates.phase` on `<target>` again. The cap is `gates.fix_rounds_per_gate` per gate. Exhausted: step 6.
3. **Report.** Post the project status update: every ticket with its final status and landing, the `PARK-n` lines, review rounds used. `health` is `onTrack` with nothing parked, `atRisk` otherwise. Post the closing comment on the phase-close ticket, set it to `linear.state_done`, delete its branch if it has one, and set the project to completed (`save_project` with `state: "completed"`).

   Return your summary block: `landed` is the phase-close ticket's fix landing if there was one, `none` otherwise; `register_entries` and `parked` are the union of your units' plus your own.

### 6. When the project itself runs out

`gates.phase` stayed red on `<target>` after the fix rounds. Under `halt`, return `halted`. Under `park`, add a `PARK-n` entry to the phase-close ticket's park comment, post a project status update with `health: offTrack`, leave the project state as it is, and return `parked`. Either way the run stops here; the difference is what the human reads first.

## Hard rules at this level

The contract's hard rules bind you. Plus:

- **You write briefs, not code.** The only things you write are Linear comments and status updates, and the halt and resume entries when you are the top of a project run. A failing gate, a review finding, a surprising diff, a long log: each becomes a helper brief with the path or URL, never a read in your context.
- **One unit at a time.** Spawn the next unit agent only after the previous summary is verified and the working tree is back on the home branch.
- **Tickets are minted once, by the planner, inside this project.** You create no ticket yourself, and none after step 3.
- **Only the phase-close ticket's fix lands from this level,** and only after `gates.phase` went red on `<target>`.
