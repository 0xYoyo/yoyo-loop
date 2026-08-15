---
name: yoyo-init
description: Bootstrap a repository into the yoyo loop — GitHub repo, Linear and GitHub labels, CI gate, builder worktree, and config. Use whenever the user wants to set up a new project for the loop, onboard an existing repo, or repair a broken loop installation. Idempotent and safe to re-run.
---

# Yoyo-loop init

Turns one repository into a working factory. Run once per project. Every step
is idempotent — re-running repairs a partial setup rather than failing.

Report progress step by step. Stop and ask whenever a check fails; never paper
over a missing prerequisite, because a silently half-installed loop wastes far
more time than an error here.

## 1. Gather

Ask the user, offering detected defaults:

- Project slug — defaults to the current directory name. Becomes the
  `repo:SLUG` Linear label. Lowercase, no spaces.
- GitHub repository name and visibility (private unless told otherwise).
- Linear team key — default `YOY`.
- Test, lint, and typecheck commands for this project, if any.
- Whether this project has (or will have) a user interface. If yes: which
  paths count as UI (globs, e.g. `app/components/**`, `src/ui/**`,
  `extension/**`) and what command runs its UI tests (e.g.
  `npx playwright test`). Both may be deferred for a project with no UI
  yet; the first UI spec establishes them.

## 2. Preflight

- `gh auth status` succeeds and the account can create and push to repos.
- `/loop` is available in this Claude Code build. Check `claude --version` and
  confirm `/loop` appears in the command list; it shipped in 2.1.71, but check
  the feature rather than trusting that number to stay current. If it is
  missing, tell the user to update and stop.
- The Linear connector responds: list the team's labels and workflow states.
  If it is unavailable, tell the user to run
  `claude mcp add --transport http linear-server https://mcp.linear.app/mcp`
  then `/mcp`, and stop.
- The Linear team has at least one workflow state of type `started`.

## 3. Git and GitHub

- `git init` if this is not yet a repository.
- If the directory is empty, this is a **bootstrap install**. That is normal
  and supported — the loop starts with a spec, not with a scaffold. Create a
  README and an initial commit so the repository has a default branch, note
  that this is a bootstrap install, and continue. Do not scaffold the user's
  project yourself; the first spec does that.
- **PRD adoption.** After the repository has a default branch, look for a
  PRD: if `docs/PRD.md` already exists, nothing to do. Otherwise, if exactly
  one markdown file whose name contains "prd" (case-insensitive) exists in
  the repo root or `docs/`, move it to `docs/PRD.md` (creating `docs/` if
  needed), commit with message "Add PRD", and push — on a brand-new directory
  `origin` may not exist yet; in that case push as soon as a later step
  creates it. If several candidates
  exist, list them and ask the user which one is the PRD instead of guessing.
  If none exists, continue normally — a PRD is recommended for product repos
  but not required. The PRD is authored outside the factory; init normalises
  its location only and never edits its content.
- Create the GitHub repo with `gh repo create` if `origin` is missing, then
  push.
- Detect the real default branch via
  `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`. Never
  assume `main`.

## 4. Labels

Create only what is missing; never fail on an existing label.

GitHub, on this repository:

- `loop-approved`, `loop-changes-requested`, `needs-human-review`, `loop-stuck`

Linear, on the team:

- `agent-ready`, `blocked`, `bug`, `repo:SLUG`

Linear label names are unique case-insensitively across the workspace, so an
existing `Bug` label already satisfies `bug` — treat it as present, never try
to create a differently-cased duplicate. `bug` means exactly one thing in the
loop: cause currently unknown (see the builder's bug-issue rule).

`repo:SLUG` is what lets one Linear team serve many repositories without their
queues mixing. Confirm to the user that it now exists.

## 5. Checks

The reviewer needs independent evidence — a green tick from GitHub — before it
will approve anything. It works that out live on every pass, so there is no
gate to record here, and no need to come back and reconfigure one once the
project grows tests. Re-running this skill to repair a broken installation is
still fine and safe; there is simply never a checks-related reason to.

- **If the project already has a test or lint command** and
  `.github/workflows/` is empty, add a workflow that runs it on
  `pull_request`. Commit and push.
- **If the project has no code yet**, write a seed hygiene workflow at
  `.github/workflows/ci.yml` with exactly this content, commit and push it:

  ```yaml
  name: CI

  on:
    pull_request:

  permissions:
    contents: read

  jobs:
    hygiene:
      name: Repo hygiene
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: No committed secrets
          run: |
            ! git grep -InE "(shpss_|shpat_|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY)" -- . ":(exclude).github/workflows/ci.yml" \
              || { echo "Potential secret committed"; exit 1; }
        - name: Structure sanity
          run: |
            test -f README.md
            test -f .claude/yoyo.md
            ! git ls-files | grep -E "(^|/)\.env(\..*)?$" \
              || { echo ".env file tracked"; exit 1; }
  ```

  Then tell the user, without jargon:

  > Every pull request now carries a real hygiene check (no secrets,
  > sane structure), so the reviewer has green evidence from the very
  > first PR instead of handing you each one. Your first spec should
  > still include a test suite and a workflow step running it on every
  > pull request; that issue extends or replaces this seed workflow.

Do not try to mark a check "required", and do not report it as a problem when
you cannot. Branch protection and rulesets are unavailable on free private
repositories, and the reviewer does not need them: when nothing is marked
required, it simply demands that every check pass.

### Repo map and drift guard

Every product repo carries a generated map of its own structure —
`docs/REPO-MAP.md`: a source tree, key locations (config files, env-file
paths, entrypoints, scripts, fixtures, migrations), and a module-level
import map. The map is generated, never hand-maintained: hand edits are
forbidden — the generator overwrites them, and the CI drift guard fails any
committed copy that does not match a fresh generation. The generator lists
env files by path only and never reads their contents; the guard hook denies
env reads by design, and the generator works under that guard.

Seed it in three idempotent moves — re-running repairs, never duplicates:

1. Copy the generator from the factory template into the project:

   ```bash
   YOYO_LOOP="$(cd "$(dirname "$(readlink ~/.claude/skills/yoyo-init)")/.." && pwd)"
   mkdir -p scripts
   cp "$YOYO_LOOP/templates/repo-map.mjs" scripts/repo-map.mjs
   ```

   The skill symlink resolves to the yoyo-loop checkout, so the copy always
   comes from the installed factory version. Overwrite an existing copy —
   that is the repair path; generator improvements belong upstream in the
   factory template, never as local edits.

2. Run the initial generation with `node scripts/repo-map.mjs`, then commit
   `scripts/repo-map.mjs` and `docs/REPO-MAP.md` together.

3. Add the drift guard to the CI workflow — the seed hygiene workflow above
   or the project's real one — as a step of a job that runs on
   `pull_request`, only when no step runs it yet:

   ```yaml
   - name: Repo map current
     run: node scripts/repo-map.mjs --check
   ```

   The check regenerates the map in CI and fails when the committed copy
   differs, naming the exact fix command (`node scripts/repo-map.mjs`) in
   its failure message. The map cannot rot by construction: any layout
   change that forgets to regenerate turns the PR red with the fix spelled
   out.

Regenerate last. The map lists tracked files, so it goes stale the moment a
later seed commits a new file — the DESIGN.md placeholder below and the
`.claude/` config in sections 7–8 both do (and the generator itself is
missing from its own map when generated before it is tracked). After the
run's final commit (the settings commit in section 8), run
`node scripts/repo-map.mjs` and, if `docs/REPO-MAP.md` changed, commit and
push it. Init's seeds land on the default branch without a pull request, so
the guard never runs on them — but a stale seeded map fails the first pull
request by construction, whichever skill opens it.

### Design invariants placeholder

Seed `docs/DESIGN.md` as one idempotent step alongside the seeds above: only
when the file does not exist, write it with exactly this content, commit, and
push:

```md
# Design invariants

Placeholder — run /yoyo-design to author this file.

This file will hold the design rules that stay true while the UI changes
(invariants only — it never describes the current UI). Until it is authored
and approved by the user, the reviewer's design judgment has no bar to judge
against, and /yoyo-spec stops UI milestones that reach this placeholder.
```

Never overwrite an existing `docs/DESIGN.md` — an authored file is
user-approved content, and re-running init must repair, not regress it.

## 6. Builder worktree

```bash
git worktree add --detach ../SLUG.build
```

Skip if it already exists. Explain to the user that this folder shares the
repository's history but holds its own checked-out branch, so the builder loop
and their own editing never fight over one working tree.

## 7. Config

Write `.claude/yoyo.md`:

```md
# Yoyo-loop config

repo_slug: SLUG
linear_team: TEAMKEY
test_command: ...
lint_command: ...
typecheck_command: ...

sensitive_paths:
  - .github/workflows/
  - migrations/
  - "**/*.env*"
  - package.json
  - Makefile
  - ".claude/**"

ui_paths:
  - (none yet — set when the project grows a UI)
ui_test_command: (none yet)

slack_channel_id: (optional — the notifications channel ID, enables the
watchdog's Slack verification)

max_fix_rounds: 2
```

Do not record the default branch here; the builder detects it live so the
config can never go stale.

`package.json` and `Makefile` are there because a PR can neuter its own check
gate without touching `.github/workflows/` — by rewriting the test script or
deleting the tests it runs. Add whichever files play that role in this project
(`pyproject.toml`, `Cargo.toml`, a test config, and so on). The factory's own
config is sensitive because a PR that edits `.claude/` can weaken the
fix-round cap, the sensitive list itself, or permissions — the config must
protect the config.

Add project-specific sensitive paths — auth, billing, permissions, schema,
deployment config — based on what is actually in this repository. Show the
list to the user and ask what to add.

When ui_paths is set, any pull request touching those paths must carry
executable UI tests run by ui_test_command in CI — that is the UI
verification gate. A project with no UI leaves both keys unset and the
gate stays dormant. The gate keys on paths, not on milestones or issue
titles.

## 8. Permissions

Command safety is enforced by the user-level guard hook, not by permission
lists in project settings. Before writing any settings, verify the hook is
installed: an executable must exist at `~/.claude/hooks/guard.sh`. If it does
not, STOP and tell the user to run `install.sh` from the yoyo-loop repository
(then `/reload-skills`), and do not continue until it is there — project
settings written without the hook would leave Bash unguarded.

Never write `.claude/settings.json` directly: the guard denies agent writes
to Claude settings files even in attended sessions, so the human copying the
file IS the approval gate. Instead:

1. Compose the full intended settings JSON — merging any existing
   `.claude/settings.json` content — and write it to
   `.claude/settings.proposed.json`, a normal in-workspace write.
2. Show the user the proposed content in chat and explain in one line what it
   grants and denies.
3. Tell the user to run, in any terminal, this exact command, substituting
   the real project path:

   ```bash
   cp PROJECT_PATH/.claude/settings.proposed.json PROJECT_PATH/.claude/settings.json
   ```

4. Wait for the user to confirm they ran it, verify `.claude/settings.json`
   now exists and matches the proposal by reading it, then delete
   `.claude/settings.proposed.json`.
5. Commit `.claude/settings.json` alongside `.claude/yoyo.md` and push. The
   file is tracked deliberately, not by accident: a tracked settings file
   materializes in every worktree via checkout, so the builder worktree gets
   its permissions the moment it syncs and never floods the user with
   permission prompts — and a tracked file never registers as an untracked
   path, so it can never stall the builder's clean-tree preflight as dirt.
   An untracked copy fails both ways at once; this is the pattern proven by
   the unfiltered repo, which committed its settings from the start and hit
   neither failure.

The proposed settings must contain only:

- `Read(path)` and `Edit(path)` allows for this project and its `../SLUG.build`
  worktree sibling
- a broad Bash allow (`Bash(*)`), so loops never stall on command prompts.
  `Bash(*)` is intentional, committed file included: the guard hook is the
  real safety layer for every command, and the allow list exists only to
  prevent prompt stalls — it grants nothing the guard would deny.

Do not emit a Bash deny list or a command whitelist. Every Bash command still
passes through the guard hook, which denies review-bypassing and destructive
commands and asks for anything notable — a settings deny list would only
drift out of sync with it.

Scope file access with `Read(path)` and `Edit(path)` rules only. Do not write
`Write(path)` rules: the file permission checker never matches them, so they
are dead entries that Claude Code flags as a warning on startup. `Edit(path)`
already covers every file-editing tool, Write and NotebookEdit included, so
one `Edit` rule per path is both necessary and sufficient.

## 9. Smoke test and hand off

Read back and report:

- unassigned Linear issues labeled `agent-ready` and `repo:SLUG`, not `blocked`
- the default branch and whether a check is genuinely required
- open PRs and their loop labels
- that `/yoyo-spec`, `/yoyo-build`, `/yoyo-review` appear in `/skills`
- whether `docs/PRD.md` is present; when it is, tell the user their first
  session should be: `/yoyo-spec` — "spec milestone 1 from the PRD"

Recommend connecting Linear's GitHub integration
(https://linear.app/docs/github-integration) so a merged PR moves its issue to
Done. Explain that without it the link still works but the status will not
update on its own.

Then print the daily rhythm with real paths substituted:

```
window 1 — cd ~/repos/SLUG        → /yoyo-spec, then /loop 15m /yoyo-review
window 2 — cd ~/repos/SLUG.build  → /loop 15m /yoyo-build
```

Remind the user that only they apply `agent-ready`, and only they merge.

Check whether `~/.claude/yoyo-slack.webhook` exists. If yes, say notifications
are already connected. If no, tell the user notifications are optional and
point them to the yoyo-loop README section "Slack notifications" for the
3-minute setup. Do not create the file yourself and do not ask for the URL
interactively.

If the project had no code, close by telling them exactly what to do next:

1. Run `/yoyo-spec` and describe the project. The first issue is the skeleton.
2. Make sure the draft includes acceptance criteria for a test suite and for
   pull requests running those tests automatically. Say so during the
   interview if the agent does not propose them.
3. Expect the first pull request to need their review rather than come back
   approved — nothing could be checked when it was written.
4. Read it and merge it. Nothing else to do; the loop takes over from there.

## Adopting the repo map in an existing repo

A product repository initialised before the repo map existed adopts it with
one copy-paste spec issue — file it via `/yoyo-spec` with exactly this
contract:

```md
## Problem

Agents and chats rediscover this repository's structure every session. A
generated, drift-guarded repo map makes structure knowledge durable and
always current.

## Acceptance Criteria

- [ ] AC-1 — `scripts/repo-map.mjs` exists, copied unmodified from the
  yoyo-loop factory template `templates/repo-map.mjs`, and running
  `node scripts/repo-map.mjs` writes `docs/REPO-MAP.md` (source tree, key
  locations listing env-file paths only, module import map).
- [ ] AC-2 — CI runs `node scripts/repo-map.mjs --check` on `pull_request`
  and fails on a stale map, naming the fix command in the failure message.
- [ ] AC-3 — `docs/REPO-MAP.md` is committed and current on this PR's head.

## Non-goals

- NG-1 — No hand edits to `docs/REPO-MAP.md`, ever; the file is generated.
- NG-2 — The generator never reads env-file contents; paths only.
```
