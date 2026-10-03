---
title: The top of the run
parent: .skills/4-softeng/1-ship/run-autonomous-project
owner: diplo
preview: >-
  Read by the session that invoked an autonomous run, project or initiative:
  the preflight checks and warnings, how the landing mode, target branch and
  home branch are fixed, the resume entry, and the halt that hands the run to a human.
---
# The top of the run. Preflight, resume, halt

Read by the session that invoked the run: the project orchestrator of a project run, or the root of an initiative run (see "Two ways in" in `references/contract.md`). What it holds is the same for both; the few differences are marked per row. The top's Linear object is the project in a project run and the initiative in an initiative run.

## Preflight

Run these in order before creating anything. On the first failure, print what failed and the fix, and stop. Nothing has started, so there is nothing to resume.

| Check | Run | Command | Fix to print |
|---|---|---|---|
| inside the target repo, at its root | both | `git rev-parse --show-toplevel` equals the working directory | `cd` to the repo root and re-invoke |
| nothing uncommitted | both | `git status --porcelain` prints nothing | commit or discard the listed files |
| on a branch, which becomes the home branch | both | `git symbolic-ref --short HEAD` prints a name | switch to a branch; in Conductor, the workspace's own |
| the config exists, is tracked and unmodified | both | `git ls-files --error-unmatch <config>` and `git status --porcelain -- <config>` | commit the config to `main` first, through a reviewed pull request in `pr` landing |
| the config is one the run reads | both | `version` is `1`, and every key the contract marks `always` in its "Needed" column is present, plus those marked `initiative` in an initiative run and `pr` in `pr` landing | name the missing key |
| `main` is on the remote and is the default branch | both | `git ls-remote --heads origin main` and `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name` prints `main` | the run is trunk-based on `main`, or on a target branch cut from it |
| GitHub is reachable and authenticated | both | `gh auth status` and `gh repo view --json nameWithOwner` | `gh auth login` |
| `direct` landing can reach `main` | `direct`, `target` is `main` | in a Conductor workspace, `git -C "$CONDUCTOR_ROOT_PATH" symbolic-ref --short HEAD` prints `main`; elsewhere, `main` is not checked out in another worktree (`git worktree list`) | check out `main` in the original folder |
| Linear is reachable and the plan exists | both | project run: `list_projects` with the project's name returns it, byte for byte. Initiative run: `list_projects` with the initiative returns at least one project | connect the Linear MCP in this session; check the name |
| subagents can be spawned with a chosen model | both | the subagent tool is available in this session | run the skill from a main session, not from inside a subagent: a project run needs two levels below it, an initiative run three |

**The landing mode** comes before the config row, since it decides which keys are needed. Read the target repo's root `CLAUDE.md` and `STACK.md`. If either says changes land directly on `main`, `landing` is `direct`; otherwise it is `pr`. The repo's own rule wins over any habit of this skill.

**The target branch** is fixed right after the config row: `target` is `repo.target_branch`, or `main` when the key is absent. Once every check has passed, a target branch other than `main` that the remote lacks (a project branch, or an initiative branch) is created from `main`, the one thing preflight creates: `git fetch origin && git push origin origin/main:refs/heads/<target>`. The config names that branch and a human reviewed the config, so creating it needs no other go-ahead. A target branch that already exists is used as it is, even when it is behind `main`: bringing `main` into it is the human's call.

The last check sees one level only, and preflight cannot probe the deeper ones without spending a project. On a harness that offers fewer levels than the run needs, the first agent that finds itself without a subagent tool where its role file expects one returns `halted` with kind `harness-depth`, before it changes anything, and the top stops there.

## Warnings

Print each that applies, carry on, and repeat them in the launch summary:

- **No CI in `pr` landing.** `.github/workflows/` holds no workflow, so every CI wait will read `CI=none` and the local gates are the only check before a unit lands.
- **No review in `direct` landing.** Units land on `<target>` with no pull request, so no CI and no automated review run on them. The gates are the whole check.
- **A project orchestrator below judge tier.** Project run only, where this session is the project orchestrator. The contract makes that role judge tier, and `models.phase` cannot apply to a session already running. When this session's model is below the judge-tier mapping in `.skills/model-tiers.md`, or you cannot tell which model you run on, say so and name the tier to relaunch with.

In a Conductor workspace (`CONDUCTOR_WORKSPACE_PATH` is set) the run switches this workspace between many unit branches, which changes what the workspace shows in the app. Invoking the skill is the go-ahead for that. The run never creates a worktree, and it comes back to the home branch between units and at the end. The model is in `.skills/conductor-workspaces.md`.

## Resume entry

When `--resume` continues a run that already started, post the `resume` entry as a status update on the top's Linear object (format in the contract's "Registers"). It holds the last halt's reason, from `get_status_updates` on that object, then what changed since that halt: `git fetch origin`, then `git log --format='%h %an %s' --since=<halt time> origin/<target>`, merge commits aside, and the ticket state changes the fresh snapshot shows. The run lands nothing between halting and resuming, so those commits are a human's. A run that stopped without a halt entry (a crash, a closed session) has no such boundary: write that no halt was recorded, and list no commits.

## Halt

A `halted` or `parked` summary reaching the top stops the run: a human has to act. Make that cheap for them:

1. Post the `halt` entry as a status update on the top's Linear object, with `health: offTrack`: the reason, the evidence (SHA, path, log file, pull request) and what would unblock the run. Skip it if one was just posted for this halt.
2. Leave Linear states and branches exactly as they are. They are what `--resume` reads.
3. Switch to the home branch and confirm `git status --porcelain` prints nothing.
4. Print the summary block with `status: halted`, the resume command, and stop. Spawn nothing more.
