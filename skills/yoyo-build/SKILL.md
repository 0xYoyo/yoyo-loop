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
- With the tree clean, `git fetch origin` and compare the checkout against the
  default branch on `origin`. If it is behind, sync to it before reading
  anything else: fast-forward when already on the default branch, and when a
  previous pass left you on some other branch, check the default branch out
  first. Nothing is lost — the tree is clean and every branch this loop creates
  is pushed. If the checkout has diverged rather than merely fallen behind,
  report the local commits and end the pass; never force-reset to catch up.

Then read `.claude/yoyo.md` for `repo_slug`, `linear_team`, `max_fix_rounds`,
`sensitive_paths`, and the project's check commands. Treat that file as missing
only when it is still absent after the sync above — a stale worktree is not an
uninitialised repository, and a checkout predating `yoyo-init` will otherwise
report a setup failure that syncing fixes. If it is genuinely absent, this
repository has not been initialised — say so and end the pass.

## 1. Review feedback first

List open PRs labeled `loop-changes-requested`, including their labels:

```bash
gh pr list --state open --label loop-changes-requested --json number,title,headRefName,headRefOid,labels,updatedAt,url
```

Skip every PR carrying `needs-human-review` or `loop-stuck`; it has left the
automated repair queue until a human resolves the escalation.

If any PR remains, choose the least recently updated one. Read its linked
Linear issue and latest `Yoyo-loop review of COMMIT_SHA` verdict. Check out its
branch, fix only the "Must fix before merge" items, run the relevant checks,
push, remove `loop-changes-requested`, and comment with what changed. End this
pass.

Before fixing, count the fix rounds already spent on this PR: the number of
comments beginning `Yoyo-loop review of` that contain at least one entry under
"Must fix before merge". If that count has reached `max_fix_rounds` from
`.claude/yoyo.md`, do not attempt another fix. Apply `loop-stuck`, remove
`loop-changes-requested`, comment listing the findings that keep recurring,
and end the pass. An agent should not argue with a reviewer forever.

If a proposed fix would cross an issue non-goal, touch a path listed in
`sensitive_paths`, or requires a product decision, do not implement it.
Comment the exact conflict, add `needs-human-review`, remove
`loop-changes-requested`, and end the pass. This prevents the next loop
iteration from retrying a decision only a human can make.

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
that you cannot see. If an otherwise-eligible issue has no repo label at all,
do not claim it — comment asking which repository it belongs to and move on.

Sort by priority, then oldest first. If the queue is empty, say so and end the
pass. Do not invent work and do not pick a blocked issue.

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
  named `TEAMKEY-NNN-short-slug`, where `TEAMKEY-NNN` is the issue's real
  identifier exactly as Linear returned it. Never hardcode a team key; it
  comes from `linear_team` in `.claude/yoyo.md`.
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

Never use "this is unclear" as the question. State the exact decision, the
available options, and which acceptance criterion it affects. End the pass so
the next iteration can pick different work.
