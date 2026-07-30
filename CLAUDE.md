# CLAUDE.md

Source of the yoyo-loop skills: four `SKILL.md` files under `skills/`, a
validator in `scripts/validate.mjs`, and the CI workflow that runs it.

## This working tree is live

`~/.claude/skills/yoyo-*` are symlinks pointing straight into
`skills/yoyo-*` in this checkout:

```
~/.claude/skills/yoyo-build  -> ~/repos/yoyo-loop/skills/yoyo-build
~/.claude/skills/yoyo-init   -> ~/repos/yoyo-loop/skills/yoyo-init
~/.claude/skills/yoyo-review -> ~/repos/yoyo-loop/skills/yoyo-review
~/.claude/skills/yoyo-spec   -> ~/repos/yoyo-loop/skills/yoyo-spec
```

So whatever branch this repo has checked out *is* the user's installed skill
set. A feature branch left checked out silently becomes their live skills —
unreviewed, unmerged work running as production. **Never leave this repo on a
feature branch.** Return the working tree to `main` at the end of every unit of
work, including when stopping early, abandoning an approach, or handing back
after a failure.

## Start of any work here

```bash
git checkout main && git pull
```

Do this before reading or editing anything, so merged changes are picked up
first. Editing on top of a stale `main` produces conflicts and re-fixes work
that already landed.

## End of any work here

In order:

1. `node scripts/validate.mjs` — must print its `Validated ...` success line.
2. Commit on a feature branch, never on `main`.
3. `git push -u origin <branch>`
4. `gh pr create` with a description of what changed and why.
5. `git checkout main` — leave the working tree on `main`.

## Never merge

The user merges on GitHub. Do not run `gh pr merge`, do not enable auto-merge,
and do not merge a feature branch locally. Opening the PR is where the work
ends; report the PR URL and stop.

## Validator notes

`scripts/validate.mjs` pins the loop's safety contracts by matching text in the
skills. Its builder-skill regexes test a whitespace-normalised copy of the file
(`buildFlat`), so reflowing a paragraph cannot silently break a contract — use
`buildFlat` for any new multi-word prose check rather than matching the raw
text across a line break.
