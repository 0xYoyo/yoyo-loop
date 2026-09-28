# Factory process routing

Durable process-routing reference for chats and sessions working with the yoyo
loop. What lives here must survive chat migrations: read it before routing
work into the factory.

## Bug routing — three lanes, fastest that fits, never forced

No lane is ever mandatory. The user/chat choose the lane at filing time,
defaulting to the fastest that fits. The trivial-fix path is explicitly
protected: nothing may add process to it.

| Situation | Lane | Path |
| --- | --- | --- |
| Trivial fix, cause obvious | 1 — fast lane | One-off prompt from chat (see [one-off-prompts.md](one-off-prompts.md)), chat-reviewed, user-merged. ~Minutes, untouched by everything below. |
| Single symptom, cause unknown | 2 — through the loop | File a Linear issue with the `bug` label and symptom-shaped ACs ("searching X returns Y; should return Z; repro steps"). The builder diagnoses before fixing and posts the diagnosis on the issue, then fixes in the same pass. |
| Multiple symptoms, or a failed run | 3 — diagnose first | Run `/yoyo-diagnose` with the symptom set or failed-run reference. It posts one complete `Yoyo-diagnose report` and proposes a consolidated fix contract; after user sign-off, one fix cycle covers everything found. |

## The `bug` label lifecycle

- `bug` means exactly one thing: **cause currently unknown.**
- `/yoyo-diagnose` posts its report with the fixed first line
  `Yoyo-diagnose report` (recognizable-header pattern, same as
  `Yoyo-loop review of SHA`).
- Builder rule on any `bug`-labeled issue: check comments for that header
  FIRST. Present → skip diagnosis, implement using the report as the
  mechanism map. Absent → diagnose first (lane 2). No path re-diagnoses;
  no path skips a needed diagnosis.
- Label exit: when a lane-3 report's consolidated contract is signed off
  and filed/amended, the filer (chat/user, same action) removes `bug` —
  the cause is now known and the issue is an ordinary mechanism-specified
  contract.
- These rules live in three homes, changed together per the fragility rule:
  yoyo-build's bug section, yoyo-diagnose's output section, and this table.
- Linear label names are workspace-unique case-insensitively; an existing
  `Bug` label satisfies `bug`.

## Honest limit

Comprehensive diagnosis eliminates serial discovery of defects that coexist
at diagnosis time. It cannot surface a defect that only becomes reachable
after another fix unmasks it; a second round in such cases is not a process
failure.

## Multi-PR issue lifecycle (YOY-65, YOY-113)

An issue larger than one PR — a hardening tail is the sanctioned case — moves
through the loop in slices. Four rules keep it visible and un-redone, and
they live in yoyo-build (steps 1, 2, 7), yoyo-review (step 2), yoyo-status,
and the watchdog, changed together per the fragility rule:

- **Closure convention.** Every intermediate slice writes `Part of TEAM-NNN`
  in its PR body; the slice that completes the LAST open AC writes
  `Closes TEAM-NNN`, so the issue closes itself at merge and never waits on
  a human to notice it is done (unfiltered PR #108 was the case that
  settled this). `Closes` mid-tail auto-closes the issue and hides the
  remaining ACs; `Part of` on the last slice strands a finished issue open.
- **Ticks at ship.** The builder ticks the `AC-N` checkboxes its PR
  completes when it opens the PR — a tick means "claimed, evidence in this
  PR". Nobody ticks after the fact and nobody ticks by hand.
- **Cross-check at verdict.** The reviewer compares the ticks with the diff:
  a tick without evidence is a must-fix finding, a claimed AC left unticked
  is a must-fix finding, and a keyword that disagrees with the tick state is
  a must-fix finding. A repair round unticks what its verdict reopened and
  re-ticks only what the fix completes.
- **Resume lane.** Before the normal pick, the builder resumes an issue on
  its repo that is assigned to itself, In Progress or In Review, with
  unchecked ACs and no open PR (every linked PR merged or closed). It never
  resumes a `blocked` issue and never while a PR is open — including one
  waiting on a human. Nothing needs unassigning or resetting between slices.

### Pick gate and one ID per PR (YOY-127 step 2, YOY-126 part 1)

- **Pick gate.** The builder claims no new issue while any open PR on its
  repo is `loop-changes-requested` or has no verdict label yet; it reports
  "waiting on PR #N (under review or repair)". PRs waiting on a human
  (`loop-approved`, `needs-human-review`) do not hold the pick.
- **One ID per PR.** A PR's title and body name exactly one Linear issue;
  cross-references go in Linear comments. The reviewer flags a second ID
  as a must-fix `[DEFECT]`.

## Conflicting PRs on the human gate (YOY-103)

`needs-human-review` alone means "left the automated queue until a human
resolves it" — by design. When such a PR turns CONFLICTING because main
moved, the reviewer posts one `Yoyo-loop: gated PR went stale` note and one
⚠️ Slack ping, once per state change; it never relabels, and the builder's
skip rule is unchanged. The human resolves as before: resolve the
escalation, then rebase or swap the label to `loop-changes-requested` so
the repair queue takes over. (`loop-approved` PRs that turn conflicting are
the separate YOY-63 retraction path.)

## Review timing (YOY-127 step 1)

When a PR's checks are pending, the reviewer waits for CI with
`gh pr checks --watch` for up to 9 minutes instead of skipping the pass.
Loops run at `/loop 5m`; an empty pass is near-free. True event triggers
stay parked.
