---
title: Conductor workspaces
parent: .skills
owner: diplo
preview: >-
  The one reference for any skill that touches branches or worktrees: a
  Conductor workspace is a git worktree on its own branch, so never nest a
  worktree in it and never switch its branch without asking. Rename in place
  with git branch -m. How to detect a workspace, open an existing branch, clean up.
---
# Conductor workspaces

The reference for any skill that touches branches or worktrees. If Conductor's model or its environment variables change, fix it here, not in each `SKILL.md`.

## The model

[Conductor](https://conductor.build) is a Mac app that runs coding agents in parallel. Each **workspace is a git worktree on its own branch**, created by the app off the repo's base branch (`main`). Conductor **tracks the workspace by its branch name**: the branch is the workspace's identity in the app.

Two consequences for skills:

- **Never nest another worktree inside a workspace.** The workspace already is one. A nested worktree hides the work from Conductor, and nested workspaces are a known Conductor hazard. Work in the workspace itself.
- **Never switch the workspace to another branch** (`git checkout`, `gh pr checkout`, ...) without the user's explicit go-ahead. Repointing the branch repoints what the workspace is. Renaming the current branch in place (`git branch -m`) is the sanctioned move, for example to adopt a ticket's branch name.

## Detection

The session runs in a Conductor workspace when `CONDUCTOR_WORKSPACE_PATH` is set (it holds the workspace path). Related: `CONDUCTOR_WORKSPACE_NAME`, `CONDUCTOR_ROOT_PATH` (the repo's original checkout), `CONDUCTOR_DEFAULT_BRANCH`, `CONDUCTOR_PORT` (first of 10 allocated ports), `CONDUCTOR_IS_LOCAL`.

## Working with existing branches

To work on a branch that already exists (a PR to review, a branch created elsewhere), open it in its **own** workspace: in Conductor, new workspace, then "..." (or Cmd+Shift+N), then the Branches tab. Don't repoint an existing workspace at it.

## Landing on main

`main` is checked out in the original folder (`CONDUCTOR_ROOT_PATH`), so a workspace can't check it out. When a repo lands changes directly on `main` instead of through a PR, fast-forward it from the original folder: `git -C "$CONDUCTOR_ROOT_PATH" merge --ff-only <branch>`, then push. Don't move the ref with `git update-ref` or `git branch -f`: the original folder's files would not follow.

## Cleanup

Archive the workspace from the app; Conductor removes the worktree. Don't `git worktree remove` a workspace by hand.
