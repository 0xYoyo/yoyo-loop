---
name: yoyo-watchdog
description: "Scheduled read-only factory watchdog: verifies the loop's claims and health against primary sources (Linear, GitHub, Slack) and alerts once per condition. Use when asked to run the watchdog or check factory health. Designed for /loop; never fixes, never mutates state beyond its own Slack alerts."
---

# Yoyo-loop watchdog

One pass verifies the loop's claims and health against primary sources and
alerts once per observed condition. It watches; it never repairs.

## Scope and hard rules

- Read-only: never edits issues, PRs, labels, branches, or files. Its ONLY
  writes are its own Slack alert/resolved messages.
- Never invents fixes: an alert names the observed condition, the subject,
  and a URL. Diagnosis and repair belong to humans and builders.
- Never prints or logs the Slack token. Read it into curl's Authorization
  header via command substitution only.
- One pass = one full health sweep across all discovered projects.

## Discover projects

Same mechanism as /yoyo-status: scan for factory projects by listing the
immediate subdirectories of the current repository's parent directory
(falling back to `~/repos` if the current directory is not inside a
repository) and keep every directory that contains `.claude/yoyo.md`.
Exclude `*.build` worktrees — a directory whose name ends in `.build` is a
builder worktree, not a project.

For each discovered project, read `repo_slug` and `linear_team` from that
project's `.claude/yoyo.md`, and determine its GitHub repository from that
project's git origin:

```bash
git -C PROJECT_DIR remote get-url origin
```

Always run git with `-C PROJECT_DIR`; never `cd` into a project. If a
project's config or origin cannot be read, note it in one line and continue
with the others.

## Slack access (read)

- The webhook file `~/.claude/yoyo-slack.webhook` is outbound (the existing
  mechanism, unchanged). The token file `~/.claude/yoyo-slack.token` is read
  access for this skill.
- If the token file is missing: report "watchdog degraded: no Slack read
  token" in the pass output, still run all non-Slack checks, and skip only
  the notification-verification and alert-dedupe reads. In that degraded
  mode, do not post alerts at all — without dedupe reads, repeated alerts
  would spam; report conditions in the pass output instead.
- Read channel history with:

```bash
curl -s -H "Authorization: Bearer $(cat ~/.claude/yoyo-slack.token)" \
  "https://slack.com/api/conversations.history?channel=CHANNEL&limit=200"
```

  where CHANNEL comes from the optional `slack_channel_id` key in the
  project's `.claude/yoyo.md`. On a `not_in_channel` error, report exactly:
  the bot must be invited — in Slack, open the channel and run
  `/invite @<app name>` — and treat the pass as degraded per above.

## Conditions

Evaluate per project, using `gh` and the Linear connector as primary
sources. Thresholds below are defaults; a `watchdog_thresholds` block in
`.claude/yoyo.md` overrides per repo.

1. **review-stall** — an open non-draft PR with no yoyo-loop verdict comment
   on its current head for > 45 minutes.
2. **repair-stall** — a PR labeled `loop-changes-requested` with no new
   commits and no builder comment for > 45 minutes.
3. **merge-wait** — a PR labeled `loop-approved`, conflict-free, unmerged
   for > 24 hours (a nag to the human, not a fault).
4. **answer-wait** — an issue labeled `blocked` with no human comment after
   the blocking question for > 24 hours.
5. **red-main** — the default branch's latest commit has failing checks.
6. **missing-notification** — within the last 24 hours, a PR gained
   `loop-approved`, `needs-human-review`, or `loop-stuck`, or an issue
   gained `blocked`, but no matching message exists in the channel history.
   This is the claimed-but-never-sent class; name the exact PR/issue.
7. **dead-loop** — the agent-ready unassigned queue is non-empty, yet no
   loop activity (new PRs, verdict comments, repair pushes) for
   > 90 minutes.

Skip conditions gracefully where a primary source is unavailable and say
which were skipped and why.

## Alert discipline (Slack is the state)

- Alert id: `[slug] condition-name subject` (e.g. `[unfiltered]
  review-stall PR #31`).
- Before posting, read channel history: if an alert with this id exists
  with no later resolved message for the same id, stay SILENT — the alert
  is already open.
- New condition → post once: `🚨 [slug] condition — one-line observed
  fact — URL`.
- Condition no longer observed while an open alert exists → post once:
  `✅ resolved [slug] condition — subject`.
- Every send uses the webhook and reports its HTTP status in the pass
  output (the existing notification evidence discipline; never claim an
  unverified send).

## Pass output

End with one summary block: conditions checked, alerts opened, alerts
resolved, alerts already-open (silent), checks skipped/degraded and why.
