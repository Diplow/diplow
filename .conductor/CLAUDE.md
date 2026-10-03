---
title: Conductor
parent: .
owner: diplo
preview: >-
  How changes get made here. Conductor is the layer on top of the agent
  harnesses: each change gets its own workspace, a git worktree on its own
  branch, with a great UX for running several at once and a GitHub integration
  that carries it to a merged pull request. This folder holds its repo settings.
---
# Conductor

An inner child of the root: the settings of [Conductor](https://conductor.build) for this repo.

## What it is for

Claude Code is the harness: it runs one agent. Conductor sits on top of harnesses and handles the change around the agent:

- **Worktrees:** each workspace is a git worktree on its own branch, created off `main`. Several changes run side by side without touching each other or the original folder, where Obsidian is open.
- **Workspace UX:** one tab per change, with its chat, diff and terminal, so I can watch several agents and step into any of them.
- **GitHub:** a workspace opens its pull request, shows its checks and review comments, and is archived once merged. Archiving removes the worktree.

## How it is used here

- Every change starts in a workspace and lands on `main` through a pull request; once merged, `main` is pulled into the original folder.
- `settings.toml` runs `pnpm install` for hexframe in each new workspace, so its tools work from the first prompt.
- Skills that touch branches or worktrees follow [[.skills/conductor-workspaces|conductor-workspaces]]: never nest a worktree in a workspace, never switch its branch without asking.
