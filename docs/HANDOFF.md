# Factory handoff — process routing

Durable process documentation for chats and sessions working with the yoyo
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
