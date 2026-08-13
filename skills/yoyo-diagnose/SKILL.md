---
name: yoyo-diagnose
description: Turn a symptom set or failed run into one complete, evidence-backed diagnosis report with a proposed consolidated fix contract, posted as a Linear comment. Use when a multi-symptom failure or failed run needs every cause mapped before one fix cycle. Diagnosis only — never edits product code, never opens PRs. Manually invoked.
---

# Yoyo-loop diagnoser

Manually invoked with a symptom set or a failed-run reference (lane 3 of the
bug routing table in `docs/PROCESS.md`). One pass produces one complete
diagnosis report so that ONE consolidated fix cycle can cover everything
found — the alternative this skill exists to kill is whack-a-mole: fix one
defect, run, discover the next.

This skill is DIAGNOSIS ONLY. It never edits product code, never opens PRs,
never merges, never applies `agent-ready`, and never applies labels beyond
commenting. Its entire output is one report comment. If instrumentation is
needed to observe something, it runs on scratch copies outside the
repository (the session scratchpad or `/tmp`), never on the working tree —
a diagnosis pass leaves the repository byte-identical to how it found it.

It respects the guard hook and `sensitive_paths` exactly as every other
skill: a guard denial is escalated in the report, never rephrased around.

## 1. Enumerate the observations

Before investigating anything, list every distinct failing observation in
scope — from the symptom set given, the failed run's output, logs,
recordings, CI results, and error messages. Number them O-1, O-2, …
An observation is what was seen, stated as a symptom with its exact
evidence (the log line, the wrong output, the screenshot), never as a
theory of why. Symptoms and interpretation stay segregated for the whole
pass: theories poison later readers; evidence does not.

Investigation scope is the full numbered list, not the first interesting
entry. Selecting one observation to chase and ignoring the rest is the
whack-a-mole failure mode this skill exists to prevent.

## 2. Reproduce offline-first

For each observation, reproduce before reasoning. Offline first: prefer
what is already recorded — logs, recordings, fixtures, CI output, stored
data — and go live (running the app, hitting real services) only when
nothing recorded covers it. A reproduction is a command or reading of
recorded evidence that shows the failure on demand; state it in the report
so anyone can re-run it. For flaky failures, target a reproduction *rate*
(loop it, count) rather than demanding determinism.

Check the plug early: confirm the failing code is actually the code
running (right branch, right build, right environment) before theorizing.

## 3. Hypothesize with cheap decisive tests

Every diagnosis is stated as: hypothesis + cheap decisive test +
stop-if-disproved.

- A hypothesis is falsifiable and single: "if X is the cause, then Y will
  show Z". One variable at a time.
- Its test is the cheapest observation that decides it — read the recorded
  evidence, bisect the pipeline, diff working vs. broken — chosen before
  running it, with the predicted outcome written down first.
- Disproved means stop: record the hypothesis with its disproving evidence
  and move on. Disproved hypotheses are findings, not waste — they stay in
  the report. Never keep arguing for a dead hypothesis, and never claim a
  cause the evidence has not shown: verification is against primary sources
  only (the actual logs, the actual output, the actual code read in
  context), never against memory or plausibility.
- After several disproved hypotheses on one observation, widen the frame —
  question the assumed layer or component — instead of generating variants
  of the same idea.

Keep an audit trail as you go: what was checked, in what order, what it
showed. The report is written from this trail, and every causal claim in it
cites its exact evidence (file:line, log line, command output).

## 4. Completeness rule

The report is complete only when every enumerated observation is either
attributed to an identified mechanism or explicitly listed as unexplained
together with the next probe that would explain it. Attribute each
observation to its mechanism, dedupe mechanisms across observations — one
root cause explaining four observations is one mechanism with four
attributions, not four findings — and list every observation still
unexplained with its next probe. No observation is dropped silently.

Honest limit, stated so expectations stay calibrated: completeness covers
defects that coexist at diagnosis time. A defect that only becomes
reachable after another fix unmasks it cannot be surfaced now; a second
round in such cases is not a process failure.

## 5. Post the report

Post ONE evidence-backed report as a Linear comment on the relevant issue —
or as a new issue when none exists. Its first line is exactly:

```
Yoyo-diagnose report
```

That fixed header is the recognizable-header pattern (same as
`Yoyo-loop review of SHA`): the builder checks a `bug` issue's comments for
it FIRST and, when present, skips its own diagnosis and implements from
this report as the mechanism map — so the report must carry everything a
fix needs. Structure:

- **Observations** — the numbered list, symptoms with exact evidence only.
- **Mechanisms** — each identified cause, the observations it explains, the
  decisive evidence (cited lines/output), and the disproved hypotheses
  along the way. State confidence plainly where evidence is thin.
- **Unexplained** — any observation not yet attributed, each with the next
  probe that would explain it. "None" when the enumeration closed.
- **Proposed fix contract** — the report ends with a consolidated fix
  contract ready for user sign-off: one issue with N ACs (or a chain when
  the work exceeds one day), written spec-quality so one fix cycle covers
  everything found. Proposing is this skill's last act — filing or amending
  the real issue is the user/chat's sign-off action, and when they file it,
  the filer removes `bug` (the cause is now known; the issue is an ordinary
  mechanism-specified contract).

## 6. Hard limits

- Diagnosis only: never edit product code, never open PRs, never merge,
  never apply `agent-ready`, never apply or remove labels — the report
  comment is the only mutation.
- When a finding exposes a product decision — two defensible behaviors and
  the contract does not choose — stop and state the fork in plain terms in
  the report: the exact decision, the options, and what each means for the
  fix contract. Never pick for the user.
- Never present a theory as a finding: every mechanism in the report is
  backed by cited primary-source evidence or it goes under Unexplained.
