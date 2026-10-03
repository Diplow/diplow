---
name: do-ticket
description: Start work on a Linear ticket. Given HEX-123 (or words to find it), delegate the setup to a subagent that fetches the ticket and its comments, names the branch {feat|fix|refactor|docs|chore}/hex-123-slug off origin/main (renamed in place in a Conductor workspace, a new worktree elsewhere), moves the ticket to In Progress and assigns you, and returns just the ticket. Then delegate the context sweep (the repo's CLAUDE.md chain and docs, related Linear tickets, open PRs nearby) to a subagent that returns a recap, discuss that recap with the user, ask how to proceed in one of five modes (autonomous, plan together, research first, do together, do & learn) and work in that mode. Land the work the repo's way. Through a PR into main, come back once it has run and triage every review comment, human or bot, replying on each thread and resolving the ones you settled, until it is green and nothing is left unanswered. Where the repo lands directly on main, fast-forward main instead. Use when someone says "start HEX-12", "pick up this ticket", "let's work on the OAuth ticket", "/softeng:ship:do-ticket", or begins work that has (or should have) a Linear ticket. If no ticket exists yet, mint one first with new-ticket.
title: do-ticket
parent: .skills/4-softeng/1-ship/do-ticket
owner: diplo
preview: >-
  Start work on a HEX ticket: fetch it, name the branch {type}/hex-{num}-{slug}
  off origin/main (renamed in place in Conductor), sweep context, agree a work
  mode, then land it. Through a PR with every review thread answered, or by
  fast-forwarding main where the repo lands there. Use on "start HEX-12" or
  "/softeng:ship:do-ticket".
---

# do-ticket. Branch, context, mode, landing

Turn a ticket key into a ready workspace **and** a shared understanding of how you'll work on it. Linear holds the intent; this skill sets up the code side so the chain `HEX-123 → branch → commit or PR` stays traversable end to end.

## 1. Set up the ticket in a subagent

Starting a ticket is mechanical: fetch it, name the branch, flip the Linear state. The main conversation should never pay for mechanical work. Delegate the whole of it to a **fetch-tier subagent** (cheap read-and-do, no judgment calls, Haiku on Claude Code; mapping in `.skills/model-tiers.md`), so the Linear payloads, script output and git plumbing stay in its context and only the ticket comes back. It needs **Bash and the Linear MCP**. A read-only agent can't run the script.

Given nothing, or the ticket doesn't exist: **stop and mint one first with the `softeng:ship:new-ticket` skill**. Work without a ticket leaves no trace in Linear. Otherwise hand the subagent what the user said (the key, or their words if there is no key), the absolute path to `scripts/start_ticket.sh`, and this brief:

1. **Resolve the ticket.** With a key: `mcp__hodor__Linear_mcp_Personal__get_issue` with `id: "HEX-123"`. With words ("the oauth scopes ticket"): `mcp__hodor__Linear_mcp_Personal__list_issues` with `team: "Hexframe"` and a `query`. If no single candidate is obviously right, **return the candidates and stop there**, changing nothing. Then read its comments (`mcp__hodor__Linear_mcp_Personal__list_comments` with `issueId`): the thread is where a scope cut or a decision that never made it into the description usually lives.
2. **Derive the branch coordinates.** *type* comes from the work's nature (`feat`, `fix`, `refactor`, `docs`, `chore`). *slug* is 2 to 5 words from the title, kebab-case. Report both with a one-line rationale rather than asking: the caller can `git branch -m` if the user disagrees, and a rename costs nothing before the first push.
3. **Name the branch** with the script, never by hand:
   ```bash
   bash "<skill-dir>/scripts/start_ticket.sh" HEX-123 --type feat --slug "oauth-scopes"
   ```
   It names the branch `{type}/hex-{123}-{slug}`, based on `origin/main`, and prints `WORKTREE=…` on its last line. Idempotent: re-run it safely after an interruption. It reuses an existing branch or worktree.
4. **Update the ticket state.** If the ticket isn't already yours and started: `mcp__hodor__Linear_mcp_Personal__save_issue` with `id`, `state: "In Progress"`, `assignee: "me"`. Linear should reflect reality now, not after the work lands.

Require as its return: the **ticket verbatim** (key, title, URL, and the full description; that description *is* the plan, so it must not be summarized away), its **comments** condensed to the decisions and constraints they carry (author, date, point; no pleasantries), the branch name and its rationale, the `WORKTREE=` path, what it changed on the ticket, and anything that failed or it skipped.

Then work in the returned `WORKTREE=` directory. Everything below happens there.

**Where the branch lives.** The rules are in `.skills/conductor-workspaces.md`. In short, the script checks `CONDUCTOR_WORKSPACE_PATH`:

- **Inside a Conductor workspace** the workspace already is a worktree, tracked by its branch name. The script never nests another one. It **renames the workspace's branch in place** (`git branch -m`; invoking this skill is the user's go-ahead for the rename) and fast-forwards it onto `origin/main` when it has no commits of its own. `WORKTREE=` is the workspace itself, so you are already in the right place. If the branch already exists elsewhere, the script stops: open that branch in its own workspace instead.
- **Outside Conductor** it cuts the branch off `origin/main` in a dedicated worktree (default `<repo-parent>/worktrees/hex-123-…`). Your main checkout stays on whatever you were doing, and parallel tickets never fight over one working tree.

Convention note: `{type}/hex-{num}-{slug}` is the only branch shape. The key in the branch name is how a branch, and the PR or commits it produces, trace back to their ticket. **Do not deviate.** Keep the branch short-lived: if the ticket turns out large, land it in several small steps rather than one long branch.

## 2. Gather context in a subagent, before writing anything

Delegate the sweep to a **dedicated fetch-tier subagent** (cheap read-and-summarize across docs, Linear and PRs, Haiku on Claude Code; mapping in `.skills/model-tiers.md`) instead of doing it inline. The raw material stays out of the main conversation: file excerpts, ticket threads, PR lists. Only a recap comes back, and the main agent keeps its context for the actual work.

Give the subagent the ticket key, title, full description and the comment recap you got back from §1, and the three corners to sweep, in proportion to the ticket's size (a one-line fix needs a glance; a feature needs the full sweep):

- **The repo's docs.** The `CLAUDE.md` chain from the repo root down to the folders the ticket touches, the root `STACK.md` if there is one, and any docs for the concepts the ticket names (grep by keyword). These say where things go and what the repo's rules are.
- **Related tickets.** `mcp__hodor__Linear_mcp_Personal__list_issues` with a `query` on the ticket's keywords; read its parent and siblings (`parentId`, `get_issue` with `includeRelations: true`). What was already tried, decided, or descoped?
- **Open PRs nearby.** `gh pr list --state open` (and recently merged, `--state merged --limit 20`) touching the same area: what will this work collide with or build on?

Require a **compact structured recap** as its only return: what it learned (with file, ticket and PR pointers), what's still unknown, the risks and possible collisions. No raw dumps. If a corner was unreachable (the Linear connector missing in its session, `gh` not authenticated), the recap must say so rather than silently skipping it.

If the ticket adds or moves business logic, the `softeng:review:domain-design` skill decides where it goes (the stance is in `4-software-engineering/2-principles/1-domain-driven-design/CLAUDE.md`). Invoke it from the main conversation, not from the subagent.

## 3. Discuss the recap, ask the mode, then honor it

**Relay the recap to the user before asking anything.** In your own words: what the sweep learned, what's still unknown, the risks. Misunderstandings are cheap at this point. Invite corrections, let the user fill gaps the sweep couldn't (a decision made out loud, a constraint not written anywhere), and send the subagent back if a corner needs more depth. Ask the mode only once the recap is communicated, and discussed if the user engages.

One question, five honest options:

| Mode | Contract |
|---|---|
| **Autonomous** | Run with sensible defaults end to end; report at checkpoints and at the finish. |
| **Plan together** | Co-write the plan first; implement only after sign-off. |
| **Research first** | No implementation yet. Deepen the context brief and come back with options. |
| **Do together** | Small steps, confirm at each fork; the user stays at the wheel. |
| **Do & learn** | Do the work while narrating the *why* as it happens: conventions, architecture, the reasons behind each choice. |

Then proceed in the chosen mode, working through the ticket's next-steps checklist. Tick items off in the description as they complete (`mcp__hodor__Linear_mcp_Personal__save_issue` with `id` and the updated `description`) so the ticket stays the live plan.

### Land it the repo's way

Before landing, check how the repo takes changes. Its `CLAUDE.md` chain or `STACK.md` says so.

- **A repo that lands directly on `main`** (not this diplow repo: it takes a pull request for every change, so the next bullet applies). No PR, no review loop, skip §4. Commit on the ticket branch with the key in the message, then fast-forward `main` in the checkout where it is checked out, as `.skills/conductor-workspaces.md` describes: `git -C "$CONDUCTOR_ROOT_PATH" merge --ff-only <branch>` in Conductor (outside it, the main checkout's path), then push `main`. Never move the ref with `git update-ref` or `git branch -f`. If the fast-forward fails because `main` moved, rebase the branch on `origin/main` and retry. Then tick the last checklist items and move the ticket to `Done`.
- **Otherwise, a PR into `main`.** Push the branch and open the PR with the `softeng:ship:pr-description` skill: the smallest visual that carries the change, why it exists, and `Closes HEX-123` so the chain `ticket → branch → PR` stays traversable. Then §4.

## 4. Once the PR is up, read what the reviewers said

The work isn't done when the branch is pushed. Opening the PR can fire checks and automatic reviewers, and a human may review too. Their comments land *minutes after* the push, so come back for them instead of ending the session on `gh pr create`. Handle **every review comment, human or bot**, the same way.

**Wait for the run to settle.** If the repo has checks, `gh pr checks <n> --watch` blocks until every one reports. Red checks come first: `gh run view <run-id> --log-failed`, fix, push.

**Collect every comment surface.** They live in three places and `gh pr view --comments` shows only one. Inline, line-anchored comments are invisible there:

```bash
gh pr view <n> --comments                       # issue-level: bot sticky comments, human notes
gh api repos/{owner}/{repo}/pulls/<n>/reviews   # review bodies (approve / request changes)
gh api repos/{owner}/{repo}/pulls/<n>/comments  # inline, line-anchored review comments
```

None of those three carries **resolution state**, so they cannot answer "what is still unresolved", the usual question on a PR that has been round-tripping. Only the GraphQL `reviewThreads` does, and it returns the thread ids you need to reply and resolve later (`gh repo view --json owner,name` gives `OWNER` and `REPO`):

```bash
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){
  pullRequest(number:$n){reviewThreads(first:100){nodes{
    id isResolved isOutdated path line comments(first:10){nodes{author{login} body}}}}}}}' \
  -F o=OWNER -F r=REPO -F n=<n>
```

Some bots wrap each finding in a long `<details>` analysis block. Strip those before reading, or the signal drowns.

On a long review, hand collection to a **fetch-tier subagent** (as in §1 and §2) and require one deduplicated list of *actionable* findings (source, file:line, severity, the claim), not the raw threads.

**Triage every finding explicitly**, one line each: fix / already handled / disagree-and-why / defer. A bot being wrong elsewhere doesn't make it wrong here, and "it's only a bot" is not a triage decision. Judge the claim.

**Verify before you decide.** Reviewers, bots most of all, assert things about code they half-read: a "fails open" claim that ignores the throw two lines down, a "remove this field" that would delete the feature's only delivery mechanism. Read the cited lines, and what the repo's `CLAUDE.md` chain and docs say about them, before agreeing *or* disagreeing. On a large review, fan the verification out by area to **work-tier** subagents, one per surface (the API layer, one domain, the tests), each asked to return VALID / PARTIALLY VALID / FALSE with file:line evidence, then decide from their findings. They sit a tier above the collection on purpose: judging whether a finding is real means reading the code and the decisions behind it, not summarizing threads (mapping in `.skills/model-tiers.md`). A wrong fix applied to a wrong finding is worse than the finding.

### Answer the threads, not just the findings

Triaging in your head or in the chat is not addressing the review. **Every thread gets a reply on the thread**, including the ones you fixed. The PR is where the next reader, the bot's next pass, and the merger all look.

- **Fixed.** Reply with what changed and the commit SHA. If the suggestion as written would have broken something, say so; that is the useful part.
- **Rejected.** Reply with the evidence (file:line), not just a verdict. "Not a regression" is an assertion; "`main` already rejects a negative amount before this call, `origin/main:src/domains/billing/invoice.ts:47`" is an answer.
- **Deferred.** The reply names the ticket. A defer without a ticket is a drop. A security finding you don't fix now gets its own ticket, never just a line in a summary.

**Then resolve what you settled**, and leave open only what is genuinely still open. A deferred thread stays open, so it stays visible until its ticket lands. Unresolved threads are the merge signal; a reviewer scanning "21 unresolved" cannot tell answered from ignored.

Neither `gh pr comment` nor `gh pr review` can reply to a specific thread or resolve one. Both need GraphQL:

```bash
# reply on a thread (thread ids: gh api graphql -f query='{repository(owner:"O",name:"R"){
#   pullRequest(number:N){reviewThreads(first:100){nodes{id isResolved path line}}}}}')
gh api graphql -f query='mutation($tid:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$tid,body:$body}){comment{url}}}' \
  -F tid="$THREAD_ID" -F body="$BODY"

# resolve it
gh api graphql -f query='mutation($tid:ID!){
  resolveReviewThread(input:{threadId:$tid}){thread{isResolved}}}' -F tid="$THREAD_ID"
```

On a review with many threads, script the loop over a file of `{id, body, resolve}` rather than hand-firing each one, then check the resulting unresolved count is exactly the set you meant to leave open.

A single summary comment (`gh pr comment`) is a good **complement** for a large pass: the disposition table, the ticket mapping, the one finding worth reading. It is not a substitute, because bots and reviewers track state per thread. Close that comment with the attribution line, so a reviewer who didn't run the skill can trace where the triage came from:

```markdown
_Created with skill_ [do-ticket](https://github.com/Diplow/diplow/blob/main/.skills/4-softeng/1-ship/do-ticket/SKILL.md)
```

The per-thread replies don't take it. They answer a specific reviewer, and a footer on each would be noise.

**Push the fixes, then look again.** Each push can re-trigger the checks and the bots, and a fix can surface a new finding. Loop until the PR is green and no finding is unanswered. Then tick the last checklist items, move the ticket state, and tell the user the PR is ready to merge. Merge it once green rather than letting it age; a PR that sits drifts from `main`.

## Notes

- **Scope.** This skill spans the whole ticket, from branch to landed work, including a review conversation answered *on the PR* (§4). The specialized reviews stay separate: `softeng:review:maintainability-review` and `softeng:review:domain-design` for a pass before the PR opens.
- **Cleanup.** In a Conductor workspace, archive the workspace from the app once the work has landed; Conductor removes the worktree. Outside Conductor the worktree is disposable by design: after the merge, `git worktree remove <dir>` and delete the branch. Stale worktrees defeat their point.
