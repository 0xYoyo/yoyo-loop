# yoyo-loop

Four Claude Code skills that turn Linear + GitHub into a small, human-gated
software factory. Adapted from [Finn-loop](https://github.com/finna/Finn-loop)
by Alex Finn (MIT), with per-repo scoping and a bootstrap command added.

**idea → `/yoyo-spec` interviews you and files the issue → you label it
`agent-ready` → `/yoyo-build` claims it and opens a PR → `/yoyo-review` posts
a verdict → you merge.**

One approval label, one rule: **humans merge**.

| Skill | What it does |
| --- | --- |
| `/yoyo-init` | Bootstraps one repo: GitHub repo, labels, CI gate, builder worktree, config. Run once per project. |
| `/yoyo-spec` | Interviews you until the behavior is unambiguous, then files a Linear issue with `AC-N` criteria and `NG-N` non-goals. |
| `/yoyo-build` | Claims the next safe `agent-ready` issue, implements only its contract, opens a PR. Runs under `/loop`. |
| `/yoyo-review` | Reviews open PRs against their issue and CI, posts a three-group verdict. Runs under `/loop`. |

## Changes from Finn-loop

Four deliberate changes; everything else is his design.

1. **Renamed** `finn-*` → `yoyo-*`.
2. **Per-repo scoping.** `/yoyo-spec` applies a `repo:SLUG` label and
   `/yoyo-build` requires it in the pick query. Finn scoped the queue to a
   Linear *team*, which means one team per project — and Linear's free plan
   allows two. Scoping by label instead lets one free team serve every
   repository with no cross-project mixing.
3. **`/yoyo-init` added.** Automates the manual install checklist from his
   README so a new project costs one command instead of nine steps.
4. **Convergence cap and sensitive paths.** A PR that fails two fix rounds gets
   `loop-stuck` instead of ping-ponging; any diff touching a configured
   sensitive path escalates to a human. Both are patterns he describes in his
   README's "full software factory" section, pulled forward because they are
   cheap and prevent runaway loops.

## Install (once, ever)

```bash
git clone <this repo> ~/repos/yoyo-loop
cd ~/repos/yoyo-loop && ./install.sh
```

This symlinks each skill into `~/.claude/skills/`, so all four commands exist
in every project you open, and editing a skill here takes effect immediately
everywhere. Then run `/reload-skills` and confirm `/skills` lists all four.

## Set up a project (once per project)

Works on a brand-new empty directory. You do not scaffold anything by hand —
the first spec does that. Run once, ever, per project.

```bash
mkdir ~/repos/myproject && cd ~/repos/myproject
claude
> /yoyo-init
```

**Starting from nothing.** A fresh repo has no tests, so GitHub has nothing to
check and the reviewer has no independent evidence — it hands you every pull
request instead of approving any. That resolves itself:

1. `/yoyo-spec` your project. The first issue is the skeleton, and its
   acceptance criteria should include a test suite and a workflow that runs
   those tests on every pull request.
2. That first pull request needs your review. Read it, merge it.
3. Done. The reviewer checks for itself on every pass, so from the next
   pull request onward it approves on its own. Nothing to reconfigure.

**On required checks.** Branch protection is unavailable on free private
repositories, so `yoyo-loop` never asks for it. When no check is marked
required, the reviewer demands that *every* check pass instead. The one
exposure is a PR that edits its own workflow, which is why
`.github/workflows/` is in `sensitive_paths` and always escalates to a human.

## Daily rhythm

```
window 1 — cd ~/repos/myproject        → /yoyo-spec, then /loop 15m /yoyo-review
window 2 — cd ~/repos/myproject.build  → /loop 15m /yoyo-build
```

1. Run `/yoyo-spec` whenever an idea hits you. Read the filed issue; if you
   approve the exact contract, apply `agent-ready` in Linear. Only a human
   applies that label.
2. Start both loops. `/loop` lives inside an open session and stops when you
   close it. Watch the first few passes and your `/usage` before leaving a new
   installation unattended.
3. Merge only PRs that are `loop-approved`, conflict-free, and green. A
   `needs-human-review` or `loop-stuck` PR needs you to read and resolve the
   reason first.
4. Answer questions on `blocked` issues, then remove the `blocked` label so a
   future pass can resume them.

Run only one builder loop per repository. The Linear assignee is a cooperative
lock between people; two sessions authenticated as the same user cannot
reliably lock each other.

## Validation

`scripts/validate.mjs` asserts the safety contracts mechanically — that the
builder still excludes blocked issues, still protects a dirty worktree, still
reads its fix-round cap from config; that the reviewer still records the
reviewed commit and still escalates when no checks exist; that no skill
hardcodes a Linear team key. Prose silently loses clauses when edited, and
this is the only thing that notices. It runs in CI on every pull request.

```bash
node scripts/validate.mjs
```

## The rules that make it work

- If it is not in the Linear issue, it does not exist. No side-channel
  instructions.
- One issue per PR, sized to a day of agent work or less.
- Acceptance criteria are observable outcomes; non-goals are binding. A PR
  comment cannot expand scope — only editing the issue can.
- Blocked issues and escalated PRs leave the automated queue until a human acts.
- **Spec quality is the bottleneck.** Vague acceptance criteria produce
  confident wrong PRs. Let `/yoyo-spec` ask as many questions as it needs.
- Agents never merge, never enable auto-merge, and never apply `agent-ready`.

`loop-approved` means the reviewer found no must-fix issue, checks passed, and
the PR was not conflicting at the reviewed commit. It is evidence for your
merge decision, not permission for an agent to merge.
