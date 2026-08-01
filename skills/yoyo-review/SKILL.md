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
has `loop-approved`, `loop-changes-requested`, `needs-human-review`, or
`loop-stuck`. Review it again when new commits landed after the recorded SHA.
If nothing needs review, say so and end the pass.

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

Non-goals are binding. If fixing a finding would require behavior excluded by
an `NG-N`, do not prescribe code. Record
`[SCOPE-CONFLICT AC-N ↔ NG-N]` with the exact contradiction and mark the PR for
human escalation.

If the diff touches any path listed in `sensitive_paths`, mark the PR for human
escalation regardless of how clean the change looks.

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

## 2. Should fix soon

None.

## 3. Safe to merge

Yes — automated review evidence is complete. A human still makes the merge decision.
```

Then set labels based on the verdict, checking existing labels before removing
them so an absent label does not fail the command:

- No must-fix and no new escalation: add `loop-approved`; remove
  `loop-changes-requested`. Preserve a pre-existing `needs-human-review` label
  because it may represent a separate high-risk human gate.
- Must-fix present: add `loop-changes-requested`; remove `loop-approved`.
- Scope conflict, sensitive path, or no CI: add `needs-human-review`; remove
  both `loop-approved` and `loop-changes-requested`; set "Safe to merge" to
  `No — human decision required.`

The escalation path deliberately leaves the automated repair queue. A human
must resolve the reason, change the issue or repository configuration as
needed, and remove `needs-human-review` before the reviewer looks at that
unchanged commit again.

## 5. Tidy merged branches

At the end of the pass, prune what merging has already finished with:

- For each local branch other than the default branch, check its PR with
  `gh pr view BRANCH --json state`. Only when the state is exactly `MERGED`,
  delete the local branch — `git branch -d BRANCH`, escalating to `-D` only
  when git refuses because the merge was a squash or rebase (the `MERGED`
  state from GitHub is the authority, not git's ancestry check).
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
