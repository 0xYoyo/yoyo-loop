---
name: yoyo-spec
description: Interview the user about a raw idea until confident, then file a build-ready issue in Linear. Use when asked to run the yoyo loop's spec interview, draft a queue-ready issue, or plan a feature. Interactive — requires the user present; never run unattended.
---

# Spec interview

Turns a raw idea into a Linear issue so complete that a build agent needs
nothing beyond the issue. Works like plan mode: research the codebase,
interview the user in rounds until confident, draft, confirm, file. The user
is the product brain; you are the codebase brain. Never guess product
decisions.

Read `.claude/yoyo.md` first for this repository's `repo_slug` and
`linear_team`. If that file is missing, this repository has not been
initialised — tell the user to run `/yoyo-init` and stop.

## PRD intake

After reading `.claude/yoyo.md`, check for `docs/PRD.md`. If present, read it
fully before researching the codebase. It is the product source of truth,
authored and maintained OUTSIDE the factory; the spec skill never edits it.

When a PRD exists, do not re-ask product questions the PRD already answers.
Interview only on implementation-level forks, gaps, and anything the codebase
or PRD leaves genuinely ambiguous.

Milestone sessions: when the user asks to "spec milestone N from the PRD",
read that milestone's sketch plus the CURRENT codebase and convert exactly
one milestone into the existing multi-issue blocked-by chain flow — chain
proposal first, user re-cuts and approves, file in order with relations.
Never file issues for more than one milestone in a session — the next
milestone is specced only after the previous one's code is merged (rolling
wave).

If the user's answers during the interview contradict the PRD, the user
wins. Note the contradiction in chat and record in the filed issue(s) that
`docs/PRD.md` needs a version bump for X.

Before filing, check the PRD's "Human checklist" for items that block the
milestone being specced and surface them to the user in chat during the
session.

## Sync the clone

Then sync the clone so research never runs against stale code — the user must
never need to pull manually. If the working tree is clean
(`git status --porcelain` empty) and the checked-out branch is the default
branch, run `git pull --ff-only`. Never rebase and never merge. If the
fast-forward fails, report that and continue read-only on what is checked out.
If the tree is dirty or on another branch, skip the pull and continue.

## 1. Research before asking

Read the relevant code first. Find which files are involved, what patterns
already exist, and what constraints apply. Never ask the user something the
codebase can answer.

## 2. Interview in rounds

Ask 1-4 questions per round, each with concrete options and your recommended
option first. Ask only genuine product decisions:

- Behavior forks: who sees it, what exactly happens, where does it live
- Scope boundaries: what is explicitly out of this issue
- Edge cases that change acceptance criteria: empty states, permissions,
  failure handling
- Data implications: existing records, migrations

After each round, fold the answers in and apply the confidence test:

> Could two different engineers read this spec and ship the same observable
> behavior?

If any fork remains, ask another round. There is NO cap on rounds: a small
fix might need two questions; a big feature legitimately needs 10-20+. Never
stop early because it feels like a lot of questions. Once the test passes,
stop — no filler questions.

## 3. Size the work — split only when it does not fit

Size what the interview revealed against the rule: one day of agent work or
less per issue.

If the work fits in one day, file one issue and skip the rest of this
section. Never split work that fits — each extra issue costs the user a
review, an approval, and a merge, so fragmenting a one-day task wastes more
than it saves.

If the work exceeds one day, you MUST propose a split into a chain of
one-day issues, ordered so each is independently buildable using only merged
code from the issues before it.

Show the proposal as a numbered list — a title plus a one-line scope for
each draft issue — BEFORE drafting any full body. The user can re-cut the
boundaries: move scope between issues, merge two, add one, reorder. Fold
their changes in and show the revised list. Only after the user approves the
set do you draft each full issue body in the standard shape below.

Chain rules:

- No two issues in a chain share an acceptance criterion. Each AC belongs to
  exactly one issue.
- Cross-issue dependencies are expressed only through the Linear blocked-by
  relation created at filing time — never as prose like "after the previous
  issue" inside an issue body. Each body must read as a complete contract on
  its own.

## 4. Draft the issue

Use exactly this shape:

```md
## Problem

What user or business problem does this solve? One or two sentences.

## Acceptance Criteria

- [ ] AC-1 — Observable, testable outcome one
- [ ] AC-2 — Observable, testable outcome two

## Non-goals

- NG-1 — What must NOT change in this task
- NG-2 — What is explicitly excluded or saved for later

## Relevant files

- path/to/file.ts — why it matters

## Test expectations

- What should be tested, manually or automatically

## How to verify

1. Numbered manual steps anyone can follow to confirm the work: where to
   go, what to do, exactly what should happen. Cover every AC.
```

Rules for the draft:

- Every acceptance criterion is an observable outcome with a stable `AC-N`
  id. Every non-goal has a stable `NG-N` id. These ids are the contract the
  build and review skills enforce.
- No acceptance criterion may require a non-goal. If one does, resolve it
  with the user before filing.
- Size the issue to one day of agent work or less; bigger work goes through
  the split in section 3 first. An issue in a chain must stand alone: its
  acceptance criteria cover only its own scope, and its body never refers to
  sibling issues.
- When an issue creates or modifies CI configuration, its acceptance
  criteria must state that the workflow triggers on `pull_request`. A
  workflow that only runs on pushes to the default branch leaves every pull
  request with no checks, which makes the reviewer escalate all of them to a
  human. Do not leave the trigger implicit.

## 5. Confirm and file

Show the full draft in chat — every draft, when there is a chain — and get
the user's go-ahead. Then create each issue on the `linear_team` Linear team
(via the Linear connector) with its draft as the body.

Apply the `repo:SLUG` label using the `repo_slug` from `.claude/yoyo.md`.
This label is what keeps one Linear team serving several repositories
without their queues mixing. An issue filed without it will never be picked
up by any builder. In a chain, every issue gets the label.

For a chain, file the issues in chain order. The first issue gets no
relation; every subsequent issue gets a Linear blocked-by relation on its
immediate predecessor, so the builder's pick query — which skips issues
with an unresolved blocker relation — opens the chain one link at a time as
predecessors are done.

Report the exact issue identifier and URL returned by Linear — for a chain,
every identifier and URL, in order; later skills use those identifiers
rather than guessing them.

## Hard rule

Never apply the `agent-ready` label — and in a chain, never apply it to any
issue in the chain. The user applies it in Linear after a final read — that
label is the approval gate between "idea" and "an agent builds it".
