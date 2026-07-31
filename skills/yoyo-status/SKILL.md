---
name: yoyo-status
description: Read-only status of the yoyo loop for this repository — what the human must merge, approve, or answer. Use when asked for status, what's waiting, or what's on me.
---

# Yoyo-loop status

One pass produces one ordered list: everything in this repository's loop that
is waiting on the human, most urgent first. It reports; it never plans, and
it gives no advice beyond the list.

Read `.claude/yoyo.md` first for `repo_slug` and `linear_team`. If that file
is missing, this repository has not been initialised — say so and stop.

## Read-only, absolutely

This skill never mutates anything: no writes to Linear, no writes to GitHub,
no file edits, no changes to git state. `gh` reads and Linear reads only. No
claiming issues, no adding or removing labels, no posting comments, no
pulling, no pushing. If producing a status line would require any write, skip
the write, report what is visible, and move on.

## Gather

Using only reads:

```bash
gh pr list --state open --json number,title,labels,isDraft,headRefOid,mergeable,url
```

For PRs that land in categories 1 and 2 below, also read their comments to
find the latest one whose first line is `Yoyo-loop review of COMMIT_SHA` — it
records the reviewed SHA and, on escalations, the reason.

From Linear, via the connector: issues labeled `repo:SLUG` on the
`linear_team` team, with their labels, workflow states, latest comments, and
attachments as the categories below need them.

## The list

One ordered list, most urgent first:

1. **merge** — open PRs labeled `loop-approved` that are mergeable and whose
   latest verdict SHA equals the current head. The reviewer already found no
   must-fix issue at exactly this commit; only the human merge is left.
2. **read & resolve** — open PRs labeled `needs-human-review` or
   `loop-stuck`, with the escalation reason pulled from the latest verdict
   comment.
3. **answer** — Linear issues labeled `blocked` (with `repo:SLUG`), quoting
   the blocking question from the issue's latest comment.
4. **approve or discard** — issues with `repo:SLUG`, not labeled
   `agent-ready`, in backlog or todo states: spec-drafted work awaiting the
   human's `agent-ready` decision.
5. **investigate** — anything in progress or in review with no attached PR
   and no visible activity. State it neutrally — what is observed, e.g.
   "in progress, no PR attached, no activity visible" — never speculate
   about a cause.

Each line: identifier, title, one action verb, one URL.

After the list, exactly one summary line: the count in each category, and
whether the queue is empty — when all five categories are empty, the whole
report is that nothing is waiting on the human.

No advice beyond the list: no next steps, no recommendations, no plans.
