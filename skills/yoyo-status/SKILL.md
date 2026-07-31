---
name: yoyo-status
description: Read-only status of the yoyo loop across all factory projects — what the human must merge, approve, or answer. Use when asked for status, what's waiting, or what's on me.
---

# Yoyo-loop status

One pass produces one ordered list: everything in the loop that is waiting on
the human, most urgent first, merged across every factory project. It reports;
it never plans, and it gives no advice beyond the list.

## Discover projects

With no argument, do not require the current directory to be an initialised
repository. Instead scan for factory projects: list the immediate
subdirectories of the current repository's parent directory (falling back to
`~/repos` if the current directory is not inside a repository) and keep every
directory that contains `.claude/yoyo.md`. Exclude `*.build` worktrees — a
directory whose name ends in `.build` is a builder worktree, not a project.

For each discovered project, read `repo_slug` and `linear_team` from that
project's `.claude/yoyo.md`, and determine its GitHub repository from that
project's git origin:

```bash
git -C PROJECT_DIR remote get-url origin
```

Always run git with `-C PROJECT_DIR`; never `cd` into a project. If a
project's config or origin cannot be read, note it in one line and continue
with the others.

With an explicit argument — a project slug — report only that project: find
the directory whose `.claude/yoyo.md` has that `repo_slug` (or the current
repository if it matches) and produce the list for it alone. If no discovered
project matches the slug, say so and stop. If no argument is given and no
project is found at all, say so and stop.

## Read-only, absolutely

This skill never mutates anything: no writes to Linear, no writes to GitHub,
no file edits, no changes to git state. `gh` reads and Linear reads only. No
claiming issues, no adding or removing labels, no posting comments, no
pulling, no pushing. If producing a status line would require any write, skip
the write, report what is visible, and move on.

## Gather

For each project, using only reads:

```bash
gh pr list --repo OWNER/REPO --state open --json number,title,labels,isDraft,headRefOid,mergeable,url
```

For PRs that land in categories 1 and 2 below, also read their comments to
find the latest one whose first line is `Yoyo-loop review of COMMIT_SHA` — it
records the reviewed SHA and, on escalations, the reason.

From Linear, via the connector: issues labeled `repo:SLUG` on that project's
`linear_team` team, with their labels, workflow states, latest comments, and
attachments as the categories below need them.

## The list

One merged, ordered list across all reported projects, most urgent first.
Every line carries a leading `[slug]` tag naming its project, e.g.
`[briza] YOY-10 — ...`. Within a category, order lines by project, then by
age (oldest first).

1. **merge** — open PRs labeled `loop-approved` that are mergeable and whose
   latest verdict SHA equals the current head. The reviewer already found no
   must-fix issue at exactly this commit; only the human merge is left.
2. **read & resolve** — open PRs labeled `needs-human-review` or
   `loop-stuck`, with the escalation reason pulled from the latest verdict
   comment.
3. **answer** — Linear issues labeled `blocked` (with `repo:SLUG`), quoting
   the blocking question from the issue's latest comment.
4. **approve or discard** — issues with `repo:SLUG`, not labeled
   `agent-ready` and not labeled `blocked`, in backlog or todo states:
   spec-drafted work awaiting the human's `agent-ready` decision. A
   `blocked` issue belongs to the answer category above, never here — no
   issue appears in two categories.
5. **investigate** — anything in progress or in review with no attached PR
   and no visible activity. State it neutrally — what is observed, e.g.
   "in progress, no PR attached, no activity visible" — never speculate
   about a cause.

Each line: `[slug]` tag, identifier, title, one action verb, one URL.

After the list, exactly one summary line: the count in each category, and
whether the queue is empty — when all five categories are empty across every
reported project, the whole report is that nothing is waiting on the human.

No advice beyond the list: no next steps, no recommendations, no plans.
