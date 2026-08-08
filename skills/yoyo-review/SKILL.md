---
name: yoyo-review
description: Review open PRs against their linked Linear issues and required GitHub checks, then post a three-group verdict with loop labels. Use when asked to run the yoyo loop's reviewer or review its PR queue. Designed for /loop; never merges or pushes code.
---

# Yoyo-loop reviewer

One pass = one PR reviewed. Under `/loop`, each iteration runs this skill once.

First sync the clone — the user must never need to pull manually. If the
working tree is clean (`git status --porcelain` empty) and the checked-out
branch is the default branch, run `git pull --ff-only`. Never rebase and never
merge. If the fast-forward fails, report that and continue read-only on what
is checked out. If the tree is dirty or on another branch, skip the pull and
continue.

Then read `.claude/yoyo.md` for `linear_team` and `sensitive_paths`. Treat
that file as missing only when it is still absent after the sync above — a
stale clone is not an uninitialised repository. If it is genuinely absent, say
so and end the pass.

## 1. Find a PR needing review

```bash
gh pr list --state open --json number,title,labels,isDraft,headRefOid,updatedAt,url
```

Skip drafts. For each PR, find the latest comment whose first line is
`Yoyo-loop review of COMMIT_SHA`.

Skip a PR when that recorded SHA equals its current `headRefOid` and it already
has any verdict label — `loop-approved`, `loop-changes-requested`,
`needs-human-review`, or `loop-stuck`. A changed SHA always gets a fresh
review, including when `needs-human-review` sits alongside
`loop-changes-requested`: new commits pushed during a fix round are re-reviewed
like any others. If nothing needs review, say so and end the pass.

Make the skip decision against a re-fetch of the PR performed immediately
before deciding — never against the listing output from the start of the
pass; a same-pass race between listing and deciding has already produced a
stale skip once. This is the entry-side freshness check; the re-fetch before
posting in step 3 is the separate exit-side one.

## 2. Read the contract and code

- Parse the linked issue identifier from `Closes TEAMKEY-NNN` in the PR body,
  where `TEAMKEY` is `linear_team` from `.claude/yoyo.md`, and fetch the full
  Linear issue including comments and relations. No linked issue is a must-fix
  finding.
- Read the full diff and every changed file in context.
- Review only against the linked issue: acceptance-criteria gaps, defects,
  broken data flow, unnecessary scope expansion, security problems, missing
  loading/error states, and code future agents will struggle to modify.
- Do not suggest unrelated improvements unless they are severe.

Every must-fix code finding starts with one of:

- `[AC-N]` — the PR does not satisfy that acceptance criterion
- `[DEFECT]` — the implementation is broken while staying inside scope
- `[SECURITY]` — a severe security issue blocks shipping
- `[CI]` — a required GitHub check failed

The must-fix bar is crisp: a finding is must-fix when this PR's contract (an
AC or NG), correctness, or security is violated. Everything else worth doing
is a deferred finding — it does not block this merge, and it does not live in
verdict prose either. Deferred findings go to the milestone's hardening issue:

- The Linear issue linked from the PR belongs to a milestone chain; the
  hardening issue is that chain's tail — the issue whose title starts with
  `M` and contains `hardening`. Locate it by walking the chain's blocked-by
  relations or with a title search scoped to `repo:SLUG`. Never guess
  identifiers; use exactly what Linear returns.
- Append each deferred finding to that issue via the Linear connector as the
  next numbered AC, written spec-quality: file path, current behavior, target
  behavior, and a test expectation. You just read the code; you have all of
  this. The append must keep the issue self-consistent: an appended AC must
  never contradict the tail's existing scaffolding (Non-goals, Relevant
  files, Test expectations, How to verify) — each AC carries its own
  specifics instead of amending the scaffolding.
- Group 2 of the verdict is then one line per finding: the finding in one
  sentence plus `deferred to TEAMKEY-NNN AC-K`.
- If no hardening issue exists for the milestone — a chain specced before
  this mechanism — do NOT create one — creation is spec logic, not review
  logic. State plainly in the verdict that a deferred finding has no home,
  list it in group 2 in full, and send a Slack notification so a human
  creates the tail, using the webhook mechanism from step 4 with text
  `"🧰 [SLUG] PR #N deferred finding has no hardening issue — URL"`. This
  should only ever happen for pre-mechanism chains.
- Between milestones — when no milestone chain is active — deferred findings
  go to the standing interim tail: the issue titled `Post-MN hardening`
  (N is the last completed milestone), created by a human after the 🧰
  missing-tail ping. Append to it exactly as to a milestone tail. The next
  /yoyo-spec milestone session chains that interim tail rather than
  duplicating it.
- A finding judged not worth doing at all is neither fixed nor appended:
  state it in one line in group 2 with "not worth a change because X".

Nothing lands in limbo: every finding is fixed now, appended to the hardening
tail, or explicitly rejected with a reason.

Non-goals are binding. If fixing a finding would require behavior excluded by
an `NG-N`, do not prescribe code. Record
`[SCOPE-CONFLICT AC-N ↔ NG-N]` with the exact contradiction and mark the PR for
human escalation.

If the diff touches any path listed in `sensitive_paths`, mark the PR for human
escalation regardless of how clean the change looks.

UI gate: read ui_paths from .claude/yoyo.md. If the diff touches any path
in ui_paths and does not add or update UI tests covering the issue's
'How to verify' steps, that is a must-fix finding tagged [AC-N] against
the untested criteria — unless the issue itself establishes the UI test
lane per its acceptance criteria. Committed tests running in CI are the
only acceptable UI evidence; agent-reported walkthroughs, session
screenshots, or uncommitted artifacts are claims, not evidence, and do
not satisfy the gate.

## 3. Check merge evidence

Inspect the current PR head, mergeability, and checks:

```bash
gh pr view NUMBER --json headRefOid,mergeable,mergeStateStatus
gh pr checks NUMBER --json bucket,name,state,link
gh pr checks NUMBER --required --json bucket,name,state,link
```

The `--required` command exits 1 with `no required checks reported on the ...`
when the head commit has no required checks. That exit code is the answer to
the question, not a failure: it means "none are required", which is the normal
case on a free private repository, so record it and carry on. Distinguish it
from real errors by reading the message — authentication failures, network
failures, and a missing or unknown PR also exit non-zero, and those you must
report instead of treating as an empty required set.

Work out the gate from what exists right now, on every pass. Never read it
from config: a repository with no tests last week may have them today, and the
loop must notice that by itself.

- **Some checks are marked required** → those are the gate; all must pass.
- **Checks exist but none are required** → every check on the head commit must
  pass. Branch protection is unavailable on free private repositories, so this
  is the ordinary case, not a degraded one. It is marginally weaker because a
  PR could edit its own workflow, which is exactly why `.github/workflows/`
  sits in `sensitive_paths` and any diff touching it escalates to a human.
- **No checks at all** → the project has nothing automated yet. Review the code
  fully, then escalate to a human and say so plainly in the verdict: no
  independent evidence exists, so the human is the only gate. This is not an
  error and needs no reconfiguration; it stops happening the moment a merged
  PR adds a workflow.

Then:

- If checks are pending or mergeability is still unknown, report that
  the PR is waiting and end without posting a verdict or changing labels. A
  later loop pass will retry it.
- Failed checks are `[CI]` must-fix findings.
- A merge conflict is a `[DEFECT]` must-fix finding.

Review the exact `headRefOid` used for this evidence. Re-fetch it immediately
before posting. If it changed, discard the review and start again on a future
pass.

## 4. Post one verdict

Post one comment in this structure:

```md
Yoyo-loop review of COMMIT_SHA

CI: checks passed | failed | not configured
Mergeability: clean | conflicting

## Review

Summary: one or two plain-language sentences on what this PR does.

## 1. Must fix before merge

None.

## 2. Deferred findings

None.

## 3. Safe to merge

Yes — automated review evidence is complete. A human still makes the merge decision.
```

Then set labels based on the verdict, checking existing labels before removing
them so an absent label does not fail the command. `needs-human-review` and
`loop-changes-requested` may coexist: `needs-human-review` gates the merge,
not the repair.

- No must-fix and no new escalation: add `loop-approved`; remove
  `loop-changes-requested`. Preserve a pre-existing `needs-human-review` label
  because it may represent a separate high-risk human gate.
- Must-fix present: add `loop-changes-requested`; remove `loop-approved`;
  preserve a pre-existing `needs-human-review` label.
- Sensitive-path diff: add `needs-human-review`; remove `loop-approved`; set
  "Safe to merge" to `No — human decision required.` If there are also
  must-fix findings, add `loop-changes-requested` too and do not remove it:
  the PR stays in the automated repair queue while still requiring a human
  merge.
- Scope conflict, no checks at all, or a product decision: add
  `needs-human-review`; remove both `loop-approved` and
  `loop-changes-requested`; set "Safe to merge" to
  `No — human decision required.` Removing `loop-changes-requested` on
  escalation is reserved for these findings a builder cannot fix: those PRs
  wait entirely on a human.

When this verdict newly adds `loop-approved` or `needs-human-review` — the
label was absent before this pass — send a Slack notification; those are the
two verdicts that need a human. Do not re-notify when the label was already
present: a sensitive-path PR keeps `needs-human-review` across fix rounds, and
only the transition pings. Read the webhook
URL from `~/.claude/yoyo-slack.webhook`; if that file does not exist, skip
notification silently and continue — notifications are optional. Send:

```bash
status=$(curl -m 5 -s -o /dev/null -w "%{http_code}" -X POST \
  -H 'Content-type: application/json' \
  --data '{"text":"✅ [SLUG] PR #N loop-approved — TITLE URL"}' \
  "$(cat ~/.claude/yoyo-slack.webhook)") || status="failed"
```

using text `"✅ [SLUG] PR #N loop-approved — TITLE URL"` for `loop-approved`
and `"👀 [SLUG] PR #N needs-human-review — REASON URL"` for
`needs-human-review`, substituting the `repo_slug`, the real PR number, the PR
title or a one-line reason, and the PR URL. Do not notify on
`loop-changes-requested` — that stays inside the automated repair loop.

These rules govern every Slack notification this skill sends, including the
missing-tail notification in step 2: a notification failure must never fail
the pass. The pass output must report the send truthfully — "Slack
notification sent (HTTP 200)" or "Slack notification FAILED (status/reason)"
— and a send may never be claimed without having run the command and read its
status. A missing webhook file remains a silent skip and is reported as
"notifications not configured", never as "sent".

Only the unfixable escalations — scope conflict, no checks at all, a product
decision — deliberately leave the automated repair queue. For those, a human
must resolve the reason, change the issue or repository configuration as
needed, and remove `needs-human-review` before the reviewer looks at that
unchanged commit again. A sensitive-path escalation with must-fix findings
stays in the queue: the builder keeps fixing while the merge waits on a human.

### Reroute (escape hatch)

A human or a trusted operator can re-enter a PR into the automated repair
queue by posting a fresh `Yoyo-loop review of COMMIT_SHA` verdict comment and
swapping the labels to match it — for example adding `loop-changes-requested`
and removing `loop-stuck` once the underlying blocker is resolved. This is the
manual override for stranded states; the label rules above should make it
rare.

## 5. Tidy merged branches

At the end of the pass, prune what merging has already finished with:

- For each local branch other than the default branch, check its PR with
  `gh pr view BRANCH --json state`. Only when the state is exactly `MERGED`,
  delete the local branch with `git branch -d BRANCH` only — never
  `git branch -D` or any force-delete fallback. The confirmed `MERGED` state
  from GitHub is the merge evidence; a squash- or rebase-merged branch's tip
  is not an ancestor of the default branch, so `-d` routinely refuses on
  legitimately merged branches. When `-d` refuses after that confirmed
  `MERGED` state, leave the branch alone silently — no report, no alarm, no
  force-delete; it is harmless clutter, not unmerged work.
- Then run `git remote prune origin`.

Never delete a branch whose PR is open or closed-without-merging, a branch
with no PR at all, or the default branch. When `gh pr view` fails or the
state is ambiguous, leave the branch alone.

## 6. Hard limits

- Never merge or enable auto-merge.
- Never push commits to the PR branch.
- Never approve or request changes through a formal GitHub review. Use one
  comment plus labels because the loop may run on the PR author's token and
  GitHub rejects self-reviews.
- `loop-approved` is evidence for a human, not merge authorization.
- Never accept session claims or uncommitted artifacts as UI evidence.
