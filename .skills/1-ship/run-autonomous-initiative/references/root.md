---
title: Root
parent: .skills/1-ship/run-autonomous-initiative
owner: diplo
preview: >-
  The root's role in an autonomous initiative run: resolve the initiative's
  projects, run them in the config's order through one project orchestrator at
  a time, check each project boundary itself (Linear state, gates on the target
  branch, path guard), post initiative status updates, finish or halt.
---
# Root. The main session and the initiative

You are the session that invoked the skill. You run the projects of one Linear initiative in the order the config gives, one project orchestrator at a time, and you are the only level that talks to the initiative and guards the run's rules across projects. SKILL.md has already parsed the arguments and passed preflight.

Each project runs through the `run-autonomous-project` skill, one level down. `<project_skill_dir>` is its directory, the sibling of this skill's (`<skill_dir>/../run-autonomous-project`), as an absolute path. Read `<project_skill_dir>/references/contract.md` before anything else: it binds you as the top of an initiative run, and its "Two ways in" says what changes for the project level under you.

Your context has to last the whole run. It holds the config, one summary block per project, exit codes and SHAs. Everything else is a brief.

## What the initiative is, in the tools

The Linear tools reach an initiative in two ways only: `list_projects` with `initiative` lists its projects, and `save_status_update` and `get_status_updates` with `type: "initiative"` post and read its status updates. There is no tool to read the initiative itself, its description or its state. So the run never depends on them: the config names the projects and their order, and the initiative is where progress is reported.

## Steps

### 1. Resolve the projects

`list_projects` with `initiative` set to the config's name. Match each `projects[].name` to a returned project byte for byte: the names may carry punctuation that a loose match would miss. A configured project absent from the initiative stops the launch with its name. Projects in the initiative that the config does not list are left alone and named in the launch summary.

### 2. Check whether a run already started

A configured project that Linear shows as started or completed means a run, or a human, already worked on this plan.

- None, without `--resume`: a fresh run. Carry on.
- Some, without `--resume`: stop and print that a run already started on this initiative and that `--resume` continues it. Starting twice would run two roots over one plan and one working tree.
- With `--resume`: post the resume entry of `<project_skill_dir>/references/top.md`, with the initiative as its Linear object.

### 3. Print the launch summary

A dozen lines to the terminal, then carry on without waiting: initiative, config path and its last commit, the landing mode, the home branch, the projects in order with their Linear state and `on_exhausted`, the gates, the caps, the projects the config leaves out, and the warnings from preflight. A human watching sees what is about to happen, and a human reading the transcript later sees what the run believed at launch.

### 4. Run the projects, in order

For each project, first matching row:

| # | Linear project | Phase-close ticket | Action |
|---|---|---|---|
| 1 | completed | Done, closing comment `done` | skip |
| 2 | completed | anything else | `halted`: the project was completed outside the run, or the run stopped mid-close |
| 3 | not completed | anything | spawn the project orchestrator. It reads its own tickets through the state tables |

For a completed project, a **fetch-tier** helper (`models.fetch`) with the "project snapshot" brief of `<project_skill_dir>/references/helpers.md` returns the phase-close ticket's state and closing comment, so the Linear payload stays out of your context.

For a project to run, `git fetch origin` and record `target_at_start`, the `origin/<target>` SHA. Compute `frozen_now` (the `paths` of every `halting.frozen_after` entry whose project is already completed) and spawn the **judge-tier** project orchestrator (`models.phase`) in the foreground:

```text
You are the project orchestrator of an autonomous initiative run. Read
<project_skill_dir>/references/contract.md, then
<project_skill_dir>/references/project.md, and follow them.
project: <name>           initiative: <name>
landing: <pr|direct>      target: <target>
home_branch: <name>
config: <absolute path>   skill_dir: <project_skill_dir>
on_exhausted: <halt|park> mint_tickets: <true|false>
frozen_now: <pathspecs or none>
halting.never:
<the list, verbatim>
Return the summary block from the contract as your whole final message.
```

When its summary comes back, this is the project boundary. For a `done` summary do all five in order. For `parked`, `halted` or a malformed summary, do 4 then halt.

1. **Verify the close.** `get_project` shows the project completed, and a fetch-tier "project snapshot" shows the phase-close ticket Done with a `done` closing comment. Confirm you are on the home branch and `git status --porcelain` prints nothing.
2. **Re-run the project gates yourself.** `git fetch origin`, switch to a detached `origin/<target>`, run each `gates.phase` command into a log file, read the exit code only, and switch back home. "Green" is recorded from your run, not from the summary.
3. **Run the path guard**, root form, below.
4. **Post the initiative status update.** `save_status_update` with `type: "initiative"`, the initiative's name, and a body a human can act on without opening anything else: project, tickets landed and parked with their landings, new `PARK-n` lines, register entries added, gates as you re-ran them. `health`: `onTrack` when the project is `done` with nothing parked, `atRisk` with parked items, `offTrack` when the run stops here. Close it, like every status update you write, with `_Created with skill_ [run-autonomous-initiative](https://github.com/Diplow/diplow/blob/main/.skills/1-ship/run-autonomous-initiative/SKILL.md)`.
5. **Decide.** Continue to the next project only if the status is `done`, the close is verified, your gate run is green and the guard printed nothing. Anything else is a halt (step 6).

### The root form of the path guard

The contract's pathspecs, with this project's `frozen_now`, over everything that reached `<target>` while the project ran:

```bash
git log --format='%H %an %s' <target_at_start>..origin/<target> -- <frozen and read-only pathspecs, .github/, the config file>
```

Anything it prints is a halt naming the SHA, the author and the path. A commit a human pushed to `<target>` during the run shows here too; the author tells them apart, and a human who confirms it clears the halt by resuming. The project is completed by then, so a resumed run skips it.

On `--resume`, `target_at_start` for a project already under way is `origin/<target>` at the resume. Its units that landed before the halt were guarded by the project orchestrator one by one.

### 5. Finish

After the last configured project is `done`, post a last initiative status update: what the run built in two sentences, each project with its status update, the count of parked items and of halts, and the final report if a ticket of the last project produced one. There is no final pull request. When `<target>` is `main`, every unit already landed there. When it is an initiative branch, it now holds every project, and merging it into `main` is the human's: the run never opens that pull request or makes that merge.

Final message to the terminal: the summary block for the whole run, the parked items with their `PARK-n` ids, each project's registers directory under `registers.dir`, and, when `<target>` is an initiative branch, one last line naming it as ready for the human's merge into `main`.

### 6. Halt

Follow "Halt" in `<project_skill_dir>/references/top.md`, with the initiative as the top's Linear object. The project boundary may already have posted the `offTrack` status update for this halt.

## Hard rules at this level

The contract's hard rules bind you. Plus:

- **One project orchestrator at a time, and you wait for it.** Its summary is the only thing you take from it.
- **You record nothing you did not check.** Project state, gate results and guard results come from your own commands at the project boundary.
- **You commit nothing.** Your writes are initiative status updates, and the halt and resume entries among them.
