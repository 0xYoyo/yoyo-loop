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
- Fetch first — it moves no local ref and touches no file, so it is safe on
  any tree state, and every check below needs the fetched refs:

  ```bash
  git fetch origin
  ```

- Then check for unpushed work — before moving `HEAD`, because moving it is
  what would lose that work:

  ```bash
  git log --oneline HEAD --not --remotes
  ```

  If that prints any commits, a previous pass left work that exists on no
  `origin` ref: report those commits and end the pass. This check must run
  first. Once `HEAD` has moved, the commits are no longer reachable from it and
  the check reports nothing, so running it afterwards proves only that the
  detach already happened. Never force-reset to catch up.

- With that check clean, require a clean working tree: run
  `git status --porcelain`. Any modification to a tracked file makes the tree
  dirty, exactly as before. An untracked path does NOT make the tree dirty
  when either (a) `origin/DEFAULT_BRANCH`'s `.gitignore` — read with
  `git show origin/DEFAULT_BRANCH:.gitignore`, treating a missing file as
  empty — covers the path, or (b) the file is byte-identical to
  `origin/DEFAULT_BRANCH`'s tracked copy of the same path. Evaluate ignore
  rules against the fetched default branch, never this checkout's stale
  `.gitignore`: a checkout predating a merged `.gitignore` otherwise
  deadlocks — the dirt blocks the sync and only the sync removes the dirt.
  Tracked-file modifications and any untracked path failing both tests still
  end the pass exactly as before: report the paths and end the pass. Never
  stash, reset, overwrite, or commit unrelated work.

- Before detaching, delete only the untracked files that passed test (b) —
  they are byte-identical to the fetched default branch's tracked copies, and
  the checkout restores them tracked, so nothing is lost. Leave paths covered
  by (a) in place; the synced `.gitignore` keeps them invisible. Then detach
  onto the default branch you just fetched. Never check out the local default
  branch: git refuses to have one branch checked out in two worktrees at
  once, and the primary clone already holds the default branch, so this
  worktree stays detached for its whole life.

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
  delete the local branch with `git branch -d BRANCH` only — never
  `git branch -D` or any force-delete fallback — then run
  `git remote prune origin`. The confirmed `MERGED` state from GitHub is the
  merge evidence, and it has already passed by this point; a squash- or
  rebase-merged branch's tip is not an ancestor of the default branch, so
  `-d` routinely refuses on legitimately merged branches. When `-d` refuses
  after that confirmed `MERGED` state, leave the branch alone silently — no
  report, no force-delete; it is harmless clutter, not unmerged work.
  Never delete a branch whose PR is open or closed-without-merging, a branch
  with no PR at all, or the default branch. When `gh pr view` fails or the
  state is ambiguous, leave the branch alone.

Then read `.claude/yoyo.md` for `repo_slug`, `linear_team`, `max_fix_rounds`,
`sensitive_paths`, and the project's check commands. Treat that file as missing
only when it is still absent after the sync above — a stale worktree is not an
uninitialised repository, and a checkout predating `yoyo-init` will otherwise
report a setup failure that syncing fixes. If it is genuinely absent, this
repository has not been initialised — say so and end the pass.

If at any point the guard hook denies a command with its escalation message,
do not retry it and do not work around it. A guard denial is never an
invitation to rephrase the command into an equivalent the guard does not
recognise; escalate it or stop. Comment the exact command and why
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
until a human resolves the escalation. Skip a PR carrying
`needs-human-review` only when it does not also carry
`loop-changes-requested`. A PR carrying BOTH is a builder-escalated
sensitive-path PR that received a mechanical must-fix from the reviewer — a
merge conflict, a CI failure — and it is still the builder's to service: fix
only the "Must fix before merge" items, and never remove
`needs-human-review` during repair — it is the human MERGE gate, not a
repair freeze; only `loop-changes-requested` comes off after the fix. The
escalation constraint below applies unchanged: if the fix itself would touch
a `sensitive_paths` path, cross a non-goal, or requires a product decision,
escalate instead of implementing. Reviewer-applied `needs-human-review`
(scope conflict, no checks at all, a product decision) never carries
`loop-changes-requested` and remains a hard dead-end by design.

If any PR remains, choose the least recently updated one. Read its linked
Linear issue and latest `Yoyo-loop review of COMMIT_SHA` verdict. Check out its
branch, fix only the "Must fix before merge" items, run the relevant checks,
push, remove `loop-changes-requested`, and post the repair report: a comment
whose first line is exactly `Fix round N pushed as SHA` — `N` is the count of
prior fix-round comments plus one, `SHA` is the new head commit — followed by
what changed. That first line is the anchor the round counting below depends
on; never omit or reword it. End this pass.

Repair pushes are append-only: fix commits go on top of the existing branch
history — never force-push, never rewrite already-reviewed commits. The
reviewer records verdicts against exact SHAs, and a history rewrite orphans
that evidence; squash-merge flattens the history at merge anyway.

Before fixing, count the fix rounds already spent on this PR: the number of
existing builder comments whose first line begins `Fix round` — the repair
reports above, one per repair actually performed. That count is of completed
rounds, so compare it with `>=`: when it has reached `max_fix_rounds` from
`.claude/yoyo.md`, stop instead of fixing. With `max_fix_rounds: 2` the first
and second repairs happen and each posts its numbered comment; once two
fix-round comments exist, the next changes-requested verdict is the one that
gives up. Counting the builder's own repair reports — not reviewer verdicts —
means a superseded or duplicate verdict (for example a manual reroute posting
twice against the same SHA) cannot burn a round in which no repair happened.

When the count has reached the cap, do not attempt another fix. Apply
`loop-stuck`, remove `loop-changes-requested`, comment listing the findings
that keep recurring, and end the pass. An agent should not argue with a
reviewer forever.

After applying `loop-stuck`, send a Slack notification. Read the webhook URL
from `~/.claude/yoyo-slack.webhook`; if that file does not exist, skip
notification silently and continue — notifications are optional. Send:

```bash
http_status=$(curl -m 5 -s -o /dev/null -w "%{http_code}" -X POST \
  -H 'Content-type: application/json' \
  --data '{"text":"🛑 [SLUG] PR #N loop-stuck — recurring findings URL"}' \
  "$(cat ~/.claude/yoyo-slack.webhook)") || http_status="failed"
```

substituting the `repo_slug`, the real PR number, a one-line summary of the
recurring findings, and the PR URL.

These rules govern every Slack notification this skill sends, including step
8: a notification failure must never fail the pass. The pass output
must report the send truthfully — "Slack notification sent (HTTP 200)" or
"Slack notification FAILED (status/reason)" — and a send may never be claimed
without having run the command and read its status. A missing webhook file
remains a silent skip and is reported as "notifications not configured",
never as "sent". A send whose captured HTTP status is 2xx is final: never
run the same send again in the pass — not to double-check, not because the
response felt slow. Retry at most once, and only when the captured status is
non-2xx or the command failed or timed out; report both attempts' statuses.
The captured variable is `http_status`, never `status`: zsh reserves `status`
as a read-only parameter, so a `status=` assignment fails *after* the webhook
has already delivered, mis-scoring a delivered send as failed and triggering
a duplicate retry.

If a proposed fix would cross an issue non-goal, touch a path listed in
`sensitive_paths`, or requires a product decision, do not implement it.
Comment the exact conflict, add `needs-human-review`, remove
`loop-changes-requested`, and end the pass. This prevents the next loop
iteration from retrying a decision only a human can make.

After applying `needs-human-review`, send a Slack notification. Read the
webhook URL from `~/.claude/yoyo-slack.webhook`; if that file does not exist,
skip notification silently and continue — notifications are optional. Send:

```bash
http_status=$(curl -m 5 -s -o /dev/null -w "%{http_code}" -X POST \
  -H 'Content-type: application/json' \
  --data '{"text":"👀 [SLUG] PR #N needs-human-review — REASON URL"}' \
  "$(cat ~/.claude/yoyo-slack.webhook)") || http_status="failed"
```

substituting the `repo_slug`, the real PR number, a one-line reason, and the
PR URL.

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

The re-fetch also verifies the mutation itself: confirm the assignee and
workflow state actually changed to what was written. The connector is known to
silently keep the old value while reporting success. If a field did not
change, retry that mutation once and re-fetch again; if it still holds the old
value, report the discrepancy explicitly in the pass output instead of
assuming success. This applies to every Linear mutation that assigns,
unassigns, or changes state — here and in the blocked flow of step 8.

The assignee prevents different people from taking the same issue. It is not
an atomic lock between simultaneous sessions authenticated as the same Linear
user, so only one builder loop may run per repository.

## 4. Read

Fetch the full issue including comments and relations. Implement only its
acceptance criteria. Non-goals are binding. Compare every `AC-N` against every
`NG-N` before editing. No unrelated changes and no opportunistic refactors.

If an acceptance criterion is ambiguous, conflicts with a non-goal, or depends
on an unresolved blocker, go to step 8. Never guess.

### Bug issues

The `bug` label means exactly one thing: cause currently unknown. On a
claimed `bug` issue stating a symptom without a mechanism, FIRST check its
comments for one whose first line is exactly `Yoyo-diagnose report`:
present → skip diagnosis and implement using the report as the mechanism
map; absent → diagnose before fixing: reproduce first — offline from
logs, recordings, or fixtures where they exist, live only when nothing
recorded covers it — identify the cause, and post the diagnosis as a
comment on the Linear issue (symptom → evidence → cause). Then fix in the
same pass and ship normally. Symptom-shaped ACs ("searching X returns Y;
should return Z; repro steps") are valid contracts on `bug` issues. No
path re-diagnoses; no path skips a needed diagnosis.

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

UI gate: read ui_paths and ui_test_command from .claude/yoyo.md. If the
diff touches any path in ui_paths, this PR must add or update UI tests
covering the issue's 'How to verify' steps, and ui_test_command must pass
locally before shipping. Interactive browser exploration (browser tools or
MCP) is allowed and encouraged while developing and diagnosing, but it is
never evidence: anything discovered by exploring must be distilled into
committed tests, because a finding that lives only in a session is lost.
Visual snapshot baselines are the durable form of screenshot evidence.
One exception: when the issue itself establishes the UI test lane per its
acceptance criteria (first UI issue of a chain), the gate it creates
applies from the next UI pull request onward. If the diff touches ui_paths
but the issue's verify steps cannot be expressed as tests and the issue
does not establish the lane, go to step 8 — that is a spec defect to
resolve, not a reason to ship untested UI.

Design evidence: when the diff touches any path in ui_paths, also drive the
real rendered UI via the existing Playwright lane and attach screenshot
evidence to the PR: desktop + mobile viewports, RTL where applicable, and
each state the issue's How-to-verify names plus empty/loading/error. These
screenshots are design-review evidence for the reviewer's `[DESIGN]`
judgment against `docs/DESIGN.md`; they complement and never replace the
committed-test gate above. Missing screenshot evidence on a UI-touching PR
is a reviewer must-fix.

All checks attributable to this change must pass before opening a PR. If a
broad check has a pre-existing unrelated failure, run the relevant targeted
check, preserve the evidence, and disclose both results in the PR.

Regenerate the map when the tree changes. When the diff adds, removes, or
renames files and the repository has a generated repo map with a drift guard —
a map generator such as `scripts/repo-map.mjs`, detected from the repository
and never invented — regenerate the map and include the regenerated file in the
same commit before opening the PR. Run the generator after the added or renamed
files are staged or committed, because the generator lists tracked files only.
A stale map is a guaranteed CI failure, not a reviewer question.

Review `git diff` and `git status` before shipping. Stop if the diff contains
unrelated work or generated secrets.

## 7. Ship

Push and open a PR with `gh pr create`. Its description must include:

- What changed and why
- The issue link, using the issue's real Linear identifier: write
  `Closes TEAMKEY-NNN` only when this PR completes every remaining acceptance
  criterion of the issue. When the PR covers only a subset of the issue's
  acceptance criteria — a multi-PR issue, such as a hardening tail worked per
  its own sizing note — write `Part of TEAMKEY-NNN` instead: the Linear-GitHub
  integration auto-closes the issue at merge on `Closes`, and a mid-tail
  auto-close makes the remaining ACs invisible to the pick query. The PR title
  keeps naming the ACs it covers.
- A scope ledger: one evidence line per `AC-N`, one preservation line per
  `NG-N`, and `Other behavior changes: None`
- Numbered manual test steps matching what was actually built
- Automated checks run and their results
- Risk: Low / Medium / High
- For ui_paths diffs: which UI tests cover which verify steps (one line
  per step), the ui_test_command result, and the attached screenshot
  evidence per the design-evidence rule in step 6

If `Other behavior changes: None` is not true, stop and get the Linear issue
amended before opening the PR.

If the diff touches any path in `sensitive_paths`, apply `needs-human-review`
to the PR immediately. The reviewer will not approve it, and that is intended.
Send NO Slack notification at ship: review evidence does not exist yet — no
verdict, no CI result — so there is nothing for a human to decide on, and the
reviewer's verdict ping is the call to action. Immediate pings are reserved
for events that stop automated work — a `blocked` issue, `loop-stuck`, a
repair-pass escalation — which need the human now to keep the loop moving,
while merge-decision pings wait for the reviewer's completed verdict.

Comment the PR URL on the Linear issue. Move it to the team's review state if
one exists; otherwise leave it in the started state for the Linear-GitHub
integration to manage. Never merge and never enable auto-merge. End the pass.

## 8. Blocked

Comment one specific question a human can answer asynchronously, apply the
`blocked` label, and unassign yourself. Leave `agent-ready` in place: the pick
query explicitly excludes `blocked`, so the issue safely reappears only after
a human answers and removes that label.

After unassigning, re-fetch the issue and confirm the assignee actually
cleared. If the connector refused or the assignee persists, retry the
unassign once and re-fetch again. If it still persists, state it
explicitly in the pass output as a must-act failure — an assigned issue is
invisible to the pick query and strands silently — and include the failed
unassign in the blocked Slack notification below. Do not retry in a loop: one
retry, one report.

After applying `blocked`, send a Slack notification. Read the webhook URL from
`~/.claude/yoyo-slack.webhook`; if that file does not exist, skip notification
silently and continue — notifications are optional. Send:

```bash
http_status=$(curl -m 5 -s -o /dev/null -w "%{http_code}" -X POST \
  -H 'Content-type: application/json' \
  --data '{"text":"🚧 [SLUG] TEAMKEY-NNN blocked — QUESTION URL"}' \
  "$(cat ~/.claude/yoyo-slack.webhook)") || http_status="failed"
```

substituting the `repo_slug`, the issue's real identifier, a one-line version
of the question, and the issue URL.

Never use "this is unclear" as the question. State the exact decision, the
available options, and which acceptance criterion it affects. End the pass so
the next iteration can pick different work.
