---
title: The PR loop
parent: .skills/4-softeng/1-ship/run-autonomous-project
owner: diplo
preview: >-
  How a unit branch lands on the target branch. In pr landing: open the pull
  request, check mergeability, wait for CI and automated reviews with bounded
  scripts, answer threads in capped rounds, merge and prove it. In direct
  landing: fast-forward the target branch and push.
---
# The PR loop. Open, wait, answer, merge

Shared by the unit agent (its own branch) and the project orchestrator (the phase-close ticket's fix branch). Every pull request goes into `<target>`, `main` unless the config names another target branch (the contract's "Trunk-based"). The caller supplies three things: `<branch>`, the ticket that owns the pull request, and its **fixer**. The unit agent fixes in its own context. The project orchestrator never edits code, so each of its fix rounds is one **work-tier** fix-up helper brief (`models.fixup`, see `references/helpers.md`).

The review discipline is `do-ticket`'s (`.skills/4-softeng/1-ship/do-ticket/SKILL.md`, its review loop once the PR is up): collect every comment surface, triage each finding, verify before you decide, answer on the thread. This file replaces what that skill assumes about a human: its uncapped "loop until green" becomes the caps below. The GraphQL calls the loop needs are in step 5, so this file stands on its own.

`<scripts>` is the `scripts/` directory of this skill. With `landing: direct` there is no pull request: skip steps 1 to 6 and land with "Direct landing" at the end.

## 1. Open the pull request

Push, then look before creating, since a resumed run or a flaked call may already have made one:

```bash
git push -u origin <branch>
gh pr list --head <branch> --state all --json number,url,state,baseRefName
```

If no open one exists (a merged one from before a repair does not count), write the body in the shape of the `pr-description` skill (`.skills/4-softeng/1-ship/pr-description/SKILL.md`) into a file, with `Closes <ticket>`, closed with the `run-autonomous-project` footer from the contract's "Linear conventions" in place of that skill's own. Skip that skill's step that shows the draft to the user, and create:

```bash
gh pr create --base <target> --head <branch> --title "<conventional title>" --body-file <file>
```

`gh pr create` goes through GraphQL and can fail while the pull request was in fact created. On any error, run the `gh pr list --head` line again first. Only if it still shows nothing, create through REST:

```bash
gh api repos/{owner}/{repo}/pulls -f title="<title>" -f head=<branch> -f base=<target> -F body=@<file>
```

Then set the ticket to `linear.state_in_review`.

**Done when** `gh pr list --head <branch>` shows exactly one open pull request whose `baseRefName` is `<target>`.

## 2. Check mergeability before waiting for anything

A pull request that conflicts with `<target>` runs no CI at all, and waiting on it looks exactly like a slow queue.

```bash
gh pr view <n> --json mergeable,mergeStateStatus
```

- `UNKNOWN`: GitHub is still computing. Ask again every 15 seconds, up to 2 minutes.
- `CONFLICTING`: merge `<target>` into the branch (`git fetch origin && git merge origin/<target>`), resolve, re-run the gates and the pre-landing path guard, push. Rebase is out: the branch is already pushed and a resumed run reads it. Units are small and land one at a time, so a second conflict on the same pull request takes the exhaustion path with kind `gate-exhausted` and the conflict as evidence.
- `MERGEABLE`: continue.

## 3. Wait for CI on the head commit

`gh pr checks --watch` returns before queued workflows appear, so the wait is on the runs attached to the head SHA:

```bash
bash <scripts>/wait_ci.sh "$(git rev-parse HEAD)"
```

One call blocks at most 9 minutes and ends with `CI=green`, `CI=red`, `CI=none` or `CI=pending` (the script's header documents each). If the harness blocks long foreground commands, run it in the background and read its last line.

- `pending`: call again. After 8 calls (about 70 minutes) park or halt with kind `ci-timeout`.
- `none`: no workflow picked the commit up. Re-check step 2 once. Still mergeable means the repo has no workflow for this change: record `ci: none` in the round comment and rely on the local gates.
- `red`: hand the failed run ids to a **fetch-tier** helper (`models.fetch`) and ask for a digest of `gh run view <id> --log-failed`: failing step, file:line, message, and whether the failure is in the code or in the infrastructure (registry login timeout, package mirror outage, lost runner). Infrastructure: `gh run rerun <id> --failed`, once per run id, then wait again. Code: that is a fix round, counted against `gates.fix_rounds_per_gate` as one more gate.
- `green`: continue.

## 4. Wait once for the automated reviews

Skip the wait when `reviews.automated` is empty. The local reviewer below still runs when the config sets one. With neither, go to step 5 only to answer threads a human may have left.

```bash
bash <scripts>/wait_reviews.sh <n> "$(git rev-parse HEAD)" "<reviews.automated joined by commas>" \
  [--clean-marker "<reviews.clean_marker>"]     # only when the config sets it
```

It ends with `REVIEWS=reported` or `REVIEWS=pending` and one line per reviewer. A reviewer's green check is not proof of a review: the script looks for the run, review or comment the reviewer left, and reports `commented` when an app posted only a summary or a skip notice. `reviewed:clean` is a finished review with no finding: the reviewer's comment carries `reviews.clean_marker` and names this head.

Call it at most twice (about 18 minutes). A reviewer still `commented` or `missing` after that is recorded, not waited for: one `PARK-n` entry of kind `review-missing` naming the reviewer and the pull request. The loop then continues with the reviews that did arrive.

### The local reviewer

When the config sets `reviews.local`, run that review too, on every pass through this step. Some reviewers ship a CLI that reviews the diff on this machine on a model the run already pays for, where their hosted review on the pull request bills another account. Hand it to a **fetch-tier** helper (`models.fetch`, the "local review" brief in `references/helpers.md`), never inline: a review takes minutes and its output runs to thousands of lines. The helper runs the command on `<branch>` at the head commit and returns `LOCAL <name> clean`, `LOCAL <name> findings` with the findings in the shape of the review threads brief, or `LOCAL <name> missing` when the command failed twice without findings (a crash, an expired login, a rate limit). `missing` is recorded like a reviewer that never came: one `PARK-n` entry of kind `review-missing` naming the command and the log path, and the loop carries on without it.

## 5. Answer the threads, in capped rounds

A round is: collect, triage, fix, reply, resolve, push, wait again (steps 2 to 4). `reviews.max_rounds` is the cap. On a resumed pull request, rounds already spent are the comments on it that start with `**Review round`. Automated review, with its feedback addressed automatically, is the norm here (`4-software-engineering/2-principles/2-ai-first/CLAUDE.md`), so every thread gets an answer and none waits for a human.

1. **Collect** through a **fetch-tier** helper (`models.fetch`, the "review threads" brief), never inline, since bot reviews run to thousands of lines. The three comment surfaces carry the text, and only GraphQL carries resolution state and the thread ids:

   ```bash
   gh pr view <n> --comments                       # issue-level comments
   gh api repos/{owner}/{repo}/pulls/<n>/reviews   # review bodies
   gh api repos/{owner}/{repo}/pulls/<n>/comments  # inline, line-anchored comments
   gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){
     pullRequest(number:$n){reviewThreads(first:100){nodes{
       id isResolved isOutdated path line comments(first:10){nodes{author{login} body}}}}}}}' \
     -F o=<owner> -F r=<repo> -F n=<n>
   ```

   The helper returns one deduplicated list of actionable findings with source, thread id, file:line, the reviewer's level and the claim. The local reviewer's findings from step 4 join that list, with `local` in place of a thread id.
2. **Triage** each finding in one line. The level comes from the reviewer (`must-fix`, `should-fix`, or the reviewer's own words for them, such as a blocking severity). A claim you doubt goes to a **judge-tier** reviewer helper (`models.reviewer`; judging a claim means reading the code behind it) for a VALID, PARTIALLY VALID or FALSE verdict with file:line evidence before you decide.
3. **Act** on `reviews.must_fix` and `reviews.should_fix`: a valid must-fix is fixed. A valid should-fix is fixed, or waived with the reason written on the thread. A false finding is answered with the evidence.
4. **Reply on every thread and resolve the ones you settled.** A fix reply carries the commit SHA. Neither `gh pr comment` nor `gh pr review` can reply to a thread or resolve one:

   ```bash
   gh api graphql -f query='mutation($tid:ID!,$body:String!){
     addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$tid,body:$body}){comment{url}}}' \
     -F tid="$THREAD_ID" -F body="$BODY"
   gh api graphql -f query='mutation($tid:ID!){
     resolveReviewThread(input:{threadId:$tid}){thread{isResolved}}}' -F tid="$THREAD_ID"
   ```

   A local finding has no thread. Its row in the round comment is its reply. The local reviewer starts from nothing on every pass, so a finding it reports again (same file, same claim) keeps the disposition an earlier round comment gave it: a waived or `FALSE` finding is carried over, not triaged again.

5. **Re-run the gates locally, push, and post the round comment**, whose first words are pinned because a resumed run counts them:

   ```markdown
   **Review round <k> of <max>**

   | Finding | Level | Disposition |
   |---|---|---|
   | <source, file:line, claim in a few words> | must-fix | fixed in <sha> |
   | ... | should-fix | waived: <reason> |

   ci: <green or none> · reviews: <reviewer states from wait_reviews.sh, then the LOCAL line when reviews.local is set>

   _Created with skill_ [run-autonomous-project](https://github.com/Diplow/diplow/blob/main/.skills/4-softeng/1-ship/run-autonomous-project/SKILL.md)
   ```

The loop ends when a wait comes back with CI green or `none`, no unresolved thread carrying a valid must-fix or an unanswered should-fix, and no such local finding. When the cap is reached first, with gates and CI green: waive the remaining should-fix threads with the reason "round cap reached", leave every remaining must-fix thread open with a reply naming its `PARK-n` entry (kind `review-exhausted`, thread URLs as evidence), and continue to the merge. A remaining local must-fix gets its `PARK-n` in the last round comment, whose URL is the evidence. Under `on_exhausted: halt`, return `halted` instead and merge nothing. A security finding left open also follows `registers.security_bugs` when the config sets it.

## 6. Merge and prove it

Merge only with the local gates green on the head commit, the pre-landing path guard silent, CI green or `none`, and the pull request `MERGEABLE`:

```bash
gh pr merge <n> --<repo.merge_strategy>
gh pr view <n> --json state,mergedAt,baseRefName     # MERGED into <target>
git switch <home_branch>
git status --porcelain                                # prints nothing
```

Keep the branch on the remote until the ticket's closing comment is posted: until then, a resumed run reads it as state.

## Direct landing

For `landing: direct`, after step 4 of the unit (gates green on a branch that contains `origin/<target>`, pre-landing guard silent). The branch is already pushed.

```bash
git fetch origin
git merge-base --is-ancestor origin/<target> HEAD    # must succeed; otherwise merge origin/<target>, re-run the gates, start over
```

When `<target>` is `main` in a Conductor workspace, `main` is checked out in the original folder. Move it there, never with `git update-ref` or `git branch -f`, so the files in that folder follow (`.skills/conductor-workspaces.md`, "Landing on main"):

```bash
git -C "$CONDUCTOR_ROOT_PATH" pull --ff-only origin main
git -C "$CONDUCTOR_ROOT_PATH" merge --ff-only <branch>
git -C "$CONDUCTOR_ROOT_PATH" push origin main
```

Otherwise, whether `<target>` is `main` outside Conductor or a project or initiative branch checked out nowhere, push the branch onto it: `git push origin <branch>:<target>`. The remote refuses anything but a fast-forward.

A refused fast-forward means `<target>` moved. Merge `origin/<target>` into the branch, re-run the gates and the guard, and try once more. A second refusal takes the exhaustion path with kind `gate-exhausted`. In the Conductor case, a failed `pull --ff-only` in the original folder means a human has work there that diverged from `origin/main`: return `halted` and name the folder.

Then prove it and go home:

```bash
git fetch origin
git merge-base --is-ancestor <branch> origin/<target>    # landed
git switch <home_branch>
git status --porcelain                                    # prints nothing
```

`landed` in the summary is `git rev-parse <branch>`.
