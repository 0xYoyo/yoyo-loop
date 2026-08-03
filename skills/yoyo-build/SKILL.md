---
name: yoyo-build
description: Claim the next safe agent-ready issue from Linear, implement it, and open a PR. Use when asked to run the yoyo loop's builder, work the approved queue, or fix yoyo review feedback. Designed for /loop; one pass does one unit of work.
---

# Yoyo-loop builder

One pass = one unit of work: fix review feedback on one existing PR, or build
one issue end to end. Under `/loop`, each iteration runs this skill once.

## 0. Preflight

Before changing Linear, GitHub, branches, or files:

- Confirm this is the intended GitHub repository and `origin` is reachable.
- Detect the repository's default branch with
  `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`; never
  assume it is `main`.
- Require a clean working tree (`git status --porcelain` must be empty). If it
  is dirty, report the paths and end the pass. Never stash, reset, overwrite,
  or commit unrelated work.
- With the tree clean, fetch and then check for unpushed work — before moving
  `HEAD`, because moving it is what would lose that work:

  ```bash
  git fetch origin
  git log --oneline HEAD --not --remotes
  ```

  If that prints any commits, a previous pass left work that exists on no
  `origin` ref: report those commits and end the pass. This check must run
  first. Once `HEAD` has moved, the commits are no longer reachable from it and
  the check reports nothing, so running it afterwards proves only that the
  detach already happened. Never force-reset to catch up.

- Only with that check clean, detach onto the default branch you just fetched.
  Never check out the local default branch: git refuses to have one branch
  checked out in two worktrees at once, and the primary clone already holds the
  default branch, so this worktree stays detached for its whole life.

  ```bash
  git switch --detach origin/DEFAULT_BRANCH
  ```

  Create every issue branch from `origin/DEFAULT_BRANCH` too, never from a
  local default branch. Nothing is lost by detaching — the tree is clean, every
  branch this loop creates is pushed, and the check above already cleared any
  local-only commits.

- Only after the unpushed-work check has passed, tidy merged issue branches in
  this worktree: for each local issue branch, check its PR with
  `gh pr view BRANCH --json state`. Only when the state is exactly `MERGED`,
  delete the local branch — `git branch -d BRANCH`, escalating to `-D` only
  when git refuses because the merge was a squash or rebase — then run
  `git remote prune origin`. Never delete a branch whose PR is open or
  closed-without-merging, a branch with no PR at all, or the default branch.
  When `gh pr view` fails or the state is ambiguous, leave the branch alone.

Then read `.claude/yoyo.md` for `repo_slug`, `linear_team`, `max_fix_rounds`,
`sensitive_paths`, and the project's check commands. Treat that file as missing
only when it is still absent after the sync above — a stale worktree is not an
uninitialised repository, and a checkout predating `yoyo-init` will otherwise
report a setup failure that syncing fixes. If it is genuinely absent, this
repository has not been initialised — say so and end the pass.

If at any point the guard hook denies a command with its escalation message,
do not retry it and do not work around it. Comment the exact command and why
it is needed on the Linear issue or the PR, apply `blocked` (issue) or
`needs-human-review` (PR) as appropriate — sending the matching Slack
notification described in steps 1 and 8 — and end the pass. When the denial
happens while repairing a PR, also remove `loop-changes-requested`, the same
as the other unfixable escalations: the guard denial will recur identically on
every retry, so the PR waits on a human.

## 1. Review feedback first

List open PRs labeled `loop-changes-requested`, including their labels:

```bash
gh pr list --state open --label loop-changes-requested --json number,title,headRefName,headRefOid,labels,updatedAt,url
```

Skip every PR carrying `loop-stuck`; it has left the automated repair queue
until a human resolves the escalation. Do not skip on `needs-human-review`
alone: that label gates the merge, not the repair, so a PR carrying both
labels is still the builder's to fix.

If any PR remains, choose the least recently updated one. Read its linked
Linear issue and latest `Yoyo-loop review of COMMIT_SHA` verdict. Check out its
branch, fix only the "Must fix before merge" items, run the relevant checks,
push, remove `loop-changes-requested`, and comment with what changed. End this
pass.

Repair pushes are append-only: fix commits go on top of the existing branch
history — never force-push, never rewrite already-reviewed commits. The
reviewer records verdicts against exact SHAs, and a history rewrite orphans
that evidence; squash-merge flattens the history at merge anyway.

Before fixing, count the fix rounds already spent on this PR: the number of
comments beginning `Yoyo-loop review of` that contain at least one entry under
"Must fix before merge". That count includes the verdict you are about to act
on, so compare it with `>`, not `>=`: only when it exceeds `max_fix_rounds`
from `.claude/yoyo.md` do you stop. With `max_fix_rounds: 2` the second repair
still happens and the third changes-requested verdict is the one that gives up.

When the count does exceed the cap, do not attempt another fix. Apply
`loop-stuck`, remove `loop-changes-requested`, comment listing the findings
that keep recurring, and end the pass. An agent should not argue with a
reviewer forever.

After applying `loop-stuck`, send a Slack notification. Read the webhook URL
from `~/.claude/yoyo-slack.webhook`; if that file does not exist, skip
notification silently and continue — notifications are optional. Send:

```bash
curl -m 5 -s -X POST -H 'Content-type: application/json' \
  --data '{"text":"🛑 [SLUG] PR #N loop-stuck — recurring findings URL"}' \
  "$(cat ~/.claude/yoyo-slack.webhook)" || true
```

substituting the `repo_slug`, the real PR number, a one-line summary of the
recurring findings, and the PR URL. A notification failure must never fail the
pass.

If a proposed fix would cross an issue non-goal, touch a path listed in
`sensitive_paths`, or requires a product decision, do not implement it.
Comment the exact conflict, add `needs-human-review`, remove
`loop-changes-requested`, and end the pass. This prevents the next loop
iteration from retrying a decision only a human can make.

After applying `needs-human-review`, send a Slack notification. Read the
webhook URL from `~/.claude/yoyo-slack.webhook`; if that file does not exist,
skip notification silently and continue — notifications are optional. Send:

```bash
curl -m 5 -s -X POST -H 'Content-type: application/json' \
  --data '{"text":"👀 [SLUG] PR #N needs-human-review — REASON URL"}' \
  "$(cat ~/.claude/yoyo-slack.webhook)" || true
```

substituting the `repo_slug`, the real PR number, a one-line reason, and the
PR URL. A notification failure must never fail the pass.

## 2. Pick

Using the Linear connector, list issues on team `linear_team` that meet every
condition:

- labeled `repo:SLUG`, using the `repo_slug` from `.claude/yoyo.md`
- labeled `agent-ready`
- unassigned
- not labeled `blocked`
- no unresolved blocker relation

The `repo:SLUG` filter is not optional. One Linear team serves several
repositories; without it you will claim work belonging to a different codebase
that you cannot see.

Sort by priority, then oldest first. If the queue is empty, say so and end the
pass. Do not invent work and do not pick a blocked issue.

Re-run this full sorted query fresh at the start of every pass — every label,
assignee, and blocker condition, priority then oldest first. A candidate is
never carried over from a previous pass, from memory, or from narrative
reasoning: "issue X just unblocked, so claim X" is not a pick — X competes in
the fresh sorted query like every other candidate.

Then verify the selection instead of trusting it: before claiming, fetch the
chosen candidate as a single issue with its relations included and inspect
every blocked-by relation. A candidate is claimable only after a per-issue
relations check proves every blocker is Done or canceled. "Done or canceled"
means the blocking issue's workflow status type is `completed` or `canceled`;
any other status — Backlog, Todo, In Progress, In Review — leaves the blocker
unresolved.

An unresolved blocker is a hard stop, never a judgment call. Do not override
it because the dependency looks soft, unrelated, or already satisfied by open
work in flight — deciding that a chain may run out of order is a human
decision, never the builder's. When the check fails, skip the candidate and
evaluate the next one in the sorted order; do not comment on or modify the
skipped issue.

## 3. Claim (the cooperative lock)

Assign yourself and move the issue to the team's started workflow state
(prefer `In Progress` when available). Claim before reading deeply or writing
code. Re-fetch the issue immediately after the update; if it is blocked,
assigned to somebody else, or no longer `agent-ready`, do not work it and
return to step 2.

The assignee prevents different people from taking the same issue. It is not
an atomic lock between simultaneous sessions authenticated as the same Linear
user, so only one builder loop may run per repository.

## 4. Read

Fetch the full issue including comments and relations. Implement only its
acceptance criteria. Non-goals are binding. Compare every `AC-N` against every
`NG-N` before editing. No unrelated changes and no opportunistic refactors.

If an acceptance criterion is ambiguous, conflicts with a non-goal, or depends
on an unresolved blocker, go to step 8. Never guess.

## 5. Build

- Fetch the latest default branch from `origin` and create or resume a branch
  named `TEAMKEY-NNN-short-slug` off `origin/DEFAULT_BRANCH` — never off a
  local default branch — where `TEAMKEY-NNN` is the issue's real identifier
  exactly as Linear returned it. Never hardcode a team key; it comes from
  `linear_team` in `.claude/yoyo.md`.
- Implement the acceptance criteria using the repository's existing style,
  architecture, and naming.
- Add or update tests when the change affects logic, data flow, permissions,
  integrations, or user-visible behavior.
- Preserve behavior outside the issue contract.

## 6. Verify

Run the project's relevant lint, typecheck, build, and narrowest useful tests.
Take each command from `.claude/yoyo.md`. Where `test_command`, `lint_command`,
or `typecheck_command` is blank or absent, detect it from the repository
instead — `package.json` scripts, `Makefile` targets, `pyproject.toml`,
`Cargo.toml`, a CI workflow, whatever this repo actually uses — and run what
you find. A value recorded in config always wins over detection.

Detection only reads what already exists. Never invent a command, never install
a test runner, and never create test infrastructure as a side effect of
verifying; that is a change to the repository, not a check of it. If a kind of
check is neither configured nor detectable, run nothing for it and say so
explicitly in the PR, naming which check was unavailable.

All checks attributable to this change must pass before opening a PR. If a
broad check has a pre-existing unrelated failure, run the relevant targeted
check, preserve the evidence, and disclose both results in the PR.

Review `git diff` and `git status` before shipping. Stop if the diff contains
unrelated work or generated secrets.

## 7. Ship

Push and open a PR with `gh pr create`. Its description must include:

- What changed and why
- `Closes TEAMKEY-NNN`, using the issue's real Linear identifier
- A scope ledger: one evidence line per `AC-N`, one preservation line per
  `NG-N`, and `Other behavior changes: None`
- Numbered manual test steps matching what was actually built
- Automated checks run and their results
- Risk: Low / Medium / High

If `Other behavior changes: None` is not true, stop and get the Linear issue
amended before opening the PR.

If the diff touches any path in `sensitive_paths`, apply `needs-human-review`
to the PR immediately. The reviewer will not approve it, and that is intended.

Comment the PR URL on the Linear issue. Move it to the team's review state if
one exists; otherwise leave it in the started state for the Linear-GitHub
integration to manage. Never merge and never enable auto-merge. End the pass.

## 8. Blocked

Comment one specific question a human can answer asynchronously, apply the
`blocked` label, and unassign yourself. Leave `agent-ready` in place: the pick
query explicitly excludes `blocked`, so the issue safely reappears only after
a human answers and removes that label.

After unassigning, re-fetch the issue and confirm the assignee actually
cleared. If the connector refused or the assignee persists, state it
explicitly in the pass output as a must-act failure — an assigned issue is
invisible to the pick query and strands silently — and include the failed
unassign in the blocked Slack notification below. Do not retry in a loop: one
re-fetch, one report.

After applying `blocked`, send a Slack notification. Read the webhook URL from
`~/.claude/yoyo-slack.webhook`; if that file does not exist, skip notification
silently and continue — notifications are optional. Send:

```bash
curl -m 5 -s -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚧 [SLUG] TEAMKEY-NNN blocked — QUESTION URL"}' \
  "$(cat ~/.claude/yoyo-slack.webhook)" || true
```

substituting the `repo_slug`, the issue's real identifier, a one-line version
of the question, and the issue URL. A notification failure must never fail the
pass.

Never use "this is unclear" as the question. State the exact decision, the
available options, and which acceptance criterion it affects. End the pass so
the next iteration can pick different work.
