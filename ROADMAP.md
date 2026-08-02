# Roadmap

Last updated: 2 August 2026 — Phase 5a landed.

Status board for the yoyo-loop build phases. The ordering follows Alex Finn's
Finn-loop README ("From the starter loop to a full software factory" — not in
this repo; it describes growing a minimal builder/reviewer loop step by step
into a fully unattended pipeline).

## Phases

**Phase 1 — Unattended-safe freedom — ✅ DONE (yoyo-loop PRs #5–#7, briza PR #3)**
Guard hook v2, permission inversion, auto-sync/prune. (Unchanged; see git
history of this file for detail.)

**Phase 2 — Multi-issue spec splitting — ✅ DONE (PR #9)**
Spec proposes blocked-by chains of one-day issues; user approves the set
once; builder blocker-exclusion serializes the parts.

**Phase 3 — /yoyo-status — ✅ DONE (PR #10, cross-project in PR #11)**
One ordered action list, cross-project by default (scans sibling
repos for .claude/yoyo.md), single project by slug argument.

**Phase 4 — PRD intake — ✅ DONE (PRs #13–#15)**
Product ideation lives OUTSIDE the factory in the "Product Studio" Claude
project, which produces docs/PRD.md per product. /yoyo-spec reads
docs/PRD.md first when present and converts exactly ONE milestone per
session into a Phase-2 chain against the then-real codebase (rolling
wave); the user wins over the PRD on contradiction. /yoyo-init adopts a
found PRD file into docs/PRD.md and includes ".claude/**" in default
sensitive paths (the config protects the config). First consumer:
0xYoyo/unfiltered. A /yoyo-plan skill that picks and re-plans milestones
autonomously is a later luxury.

**Phase 4.5 — bootstrap CI seed — ✅ DONE (PR #18)**
/yoyo-init commits a minimal real CI workflow (repo-hygiene job: secret
scan + structure sanity) on pull_request at bootstrap, so pre-test-suite
PRs carry genuine green checks and the reviewer's no-CI escalation stops
firing on every new project's first PRs. Spec-side: bootstrap chains put
tooling+CI as issue 2. Trigger: before the next project's init.

**Phase 5 — Notification lane, outbound-only first**
5a — outbound Slack lane — ✅ DONE (2026-08-02): outbound Slack messages
only — issue became blocked; PR became loop-approved / needs-human-review /
loop-stuck. No inbound actions, so no approver allowlists or signature
verification needed yet.
5b (later): interactive approvals from Slack with signature verification,
approver allowlist, idempotency, and re-reading live Linear/GitHub state at
action time. (Finn §2.)

**Phase 6 — Fresh-reviewer convergence — deferred until a PR needs fix rounds**
Builder PR → clean-context reviewer → fix rounds → existing loop-stuck cap.
(Finn §1.) Build when the failure mode first appears.

**Phase 7 — Off the open session**
Cloud Routines on GitHub events first; leased persistent workers only if
open sessions become the bottleneck. The /loop scheduler is per-session and
loops run concurrently (confirmed 2026-08-02); the remaining constraint
Phase 7 removes is that sessions must stay open on an awake machine.
(Finn §8.) Trigger: loop latency actually hurting across projects.

**Phase 8 — Later layers**
Preview + documentation merge gates (Finn §5); risk-tiered merging
(Finn §3); morning director + factory watchdog (Finn §6–7); post-merge
learning loop (Finn §9); /yoyo-plan autonomous milestone planning.

Note: hosting, deployments, and secrets are NOT a factory phase — they are
milestone 1 of each product repo, specified in its PRD.

## Standing decisions

- Build each layer only when its failure mode first appears, not
  speculatively. Every interruption or annoyance is classified: known
  one-timer or a new permanent fix in a skill/hook.
- Product ideation (Product Studio) lives outside the factory; the PRD
  committed as docs/PRD.md is the interface between them.
- The guard has two verdicts, deny and allow. Former ASK-tier commands deny
  with escalation guidance; each denied-but-safe pattern gets triaged with
  the user and promoted to a permanent allow.

## Notes

- MCP tools bypass the guard hook (it judges Bash and file tools only), so
  trusted MCP servers are allowed by name at user level in
  `templates/user-settings.json`. New connectors get one allow line there,
  never per-repo.
