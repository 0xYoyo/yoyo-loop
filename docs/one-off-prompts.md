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
- **Scope is per-item.** An agent that finds an adjacent same-class case —
  the same bug in a sibling file, the same pattern one directory over —
  reports it back instead of extending the task to cover it.
- **End on main.** The last steps are `git checkout main` and a clean
  `git status`, so the working tree is never left on a feature branch.

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
4. Verify: <checks to run>. git diff --stat must show only the files named
   above; anything else: STOP and report.
5. Commit "<message>", push, open a PR with a summary. Do not merge;
   report the PR URL.
6. git checkout main; confirm git status clean.
```
