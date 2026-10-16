# One-off prompts

The codified template for out-of-loop Fable tasks in product repos: work
handed to an agent directly, outside `/yoyo-build` and the Linear queue. The
loop's safety comes from its contracts; a one-off task carries none of them
unless the prompt supplies them. Every one-off prompt follows these rules:

- **Start with state.** The first step is `git status` against a stated
  expected state — normally a clean tree on the default branch. On any
  mismatch the agent stops and reports instead of proceeding.
- **Name the files.** The prompt lists exactly which files may be touched and
  committed. The final diff must show those files and nothing else.
- **Never touch `.env*` or untracked files.** They are outside every one-off
  task's scope, whatever the prompt is about.
- **Settings files are committed.** As of YOY-56, `/yoyo-init` commits
  `.claude/settings.json`, so it is a tracked file like any other — not an
  untracked loop fixture to work around. An untracked
  `.claude/settings.json` indicates a repo initialised before this change
  and should be committed.
- **Regenerate the repo map when the tree changes.** In a repo with the
  repo-map drift guard (`scripts/repo-map.mjs` with a `--check` CI step), a
  task that adds, removes, or renames a file lists `docs/REPO-MAP.md` among
  its allowed files and runs `node scripts/repo-map.mjs` after the task's
  new or renamed files are staged or committed, because the generator
  lists tracked files only — a CI-mechanical regeneration, never a hand
  edit, and never license to touch any other file. Without it the PR fails
  CI by construction and the "name the files" rule forbids the fix.
- **Scope is per-item.** An agent that finds an adjacent same-class case —
  the same bug in a sibling file, the same pattern one directory over —
  reports it back instead of extending the task to cover it.
- **End on main.** The last steps are `git checkout main` and a clean
  `git status`, so the working tree is never left on a feature branch.
- **A one-off checks out its own branch.** When the task continues an
  existing branch, the prompt names the branch and the first steps fetch
  and check it out (`git fetch origin && git switch BRANCH`, or
  `git switch --detach origin/BRANCH` in a throwaway worktree). Never
  assume the checkout is already on it: the builder worktree's preflight
  detaches it to `origin/main` at the start of every pass, so a one-off
  that assumed the branch (unfiltered YOY-175, 2026-10-14) worked on main.
- **"Known in the repository" reads `origin/main`.** A check that asks
  whether some text already exists in the repository reads `origin/main`'s
  tracked files (`git ls-tree -r origin/main --name-only`, then
  `git cat-file -p origin/main:PATH`), never the branch's own working tree
  or its committed files: the branch's earlier output is in that tree and
  poisons the check (unfiltered YOY-175 round 1, 2026-10-14).
- **Scratch worktrees live under `/tmp/yoyo-scratch/` and are removed.**
  A second checkout the task needs is a detached worktree at
  `/tmp/yoyo-scratch/<task>`; the task ends by removing it with
  `rm -rf /tmp/yoyo-scratch/<task>` and `git worktree prune` — never
  `git worktree remove` and never `git reset --hard`, which the guard
  denies.

## Skeleton

```text
One-off task: <what and why, one line>. Do NOT improvise or extend scope.

0. Preflight: git status — expect a clean tree on <default branch>;
   anything else: STOP and report.
1. Branch: <branch-slug> off <default branch>.
2. <the exact edits, file by file.> Only these files may change:
   <file list>. Never touch .env* or untracked files.
3. Scope is per-item: report adjacent same-class findings back instead of
   fixing them.
4. Verify: <checks to run> (plus `node scripts/repo-map.mjs` when the task
   changes the file tree in a drift-guarded repo — run it after the new or
   renamed files are staged or committed; the generator lists tracked
   files only). git diff --stat must show only the files named above;
   anything else: STOP and report.
5. Commit "<message>", push, open a PR with a summary. Do not merge;
   report the PR URL.
6. git checkout main; confirm git status clean.
```
