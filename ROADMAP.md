# Roadmap

Last updated: 25 August 2026 — factory window shipped YOY-113 (multi-PR
lifecycle: resume lane, AC ticks at ship, reviewer tick cross-check, closure
convention) and YOY-103 (stale-gate notification for conflicting
`needs-human-review` PRs); this refresh also catches up the 15–19 August
one-offs (PRs #41–#45) and the product state through M4.

## North star

The factory converges toward: Yoyo sends off tasks — today issues, then whole
milestones, then whole projects — and nothing needs him in between. He is
pinged where he already is (Slack) only for genuinely human things: merge
decisions after work reviews clean, blocked product questions, guard denials
that grow the allowlist via the deny→block→notify→triage cycle, and
account/browser work no agent can perform. /yoyo-status shows everything
waiting on him and nothing else. Every repetitive manual step or chat-side
intervention is a bug: it gets baked into a skill, hook, or template before he
has to ask twice, so his required touches strictly decrease as the factory
matures. Loops eventually run without an open session on an awake machine
(Phase 7). Agent output quality — code, design, tests, docs — converges to
where the human merge is governance, not quality control. Operating
constraints: free-tier-first until a real limit hits; every factory change
lands via PR with validator contracts, never hand edits. Every phase and every
fix is measured against one question: does this reduce Yoyo's required
touches?

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
verification needed yet. 2026-08-05: all notification sites now capture and
report the webhook HTTP status; silent unverifiable "sent" claims are
contract-banned.
5b (later): interactive approvals from Slack with signature verification,
approver allowlist, idempotency, and re-reading live Linear/GitHub state at
action time. (Finn §2.)
2026-08-08: interactive Slack approvals evaluated and REJECTED — the delta
over GitHub mobile merging is a few seconds against real new infrastructure
(see YOY-39); outbound-only stands.

**Phase 6 — Fresh-reviewer convergence — ✅ ABSORBED BY ARCHITECTURE**
The failure mode Finn §1 guards (a builder reviewing its own work without
clean context) cannot occur here — build and review run as fully separate
sessions, and convergence (fix rounds, max_fix_rounds cap, loop-stuck)
landed in PRs #22–#24. The remaining delta vs Finn §1 is only PR-to-review
latency from independent 15m crons; deliberately NOT solved by
builder-spawned reviewers (a spawned reviewer arrives before checks finish
and must poll) but by Phase 7's event-driven triggers when the latency
actually hurts.

**Phase 7 — Off the open session — CANDIDATE NAMED (2026-08-25)**
Cloud Routines on GitHub events first; leased persistent workers only if
open sessions become the bottleneck. The /loop scheduler is per-session and
loops run concurrently (confirmed 2026-08-02); the remaining constraint
Phase 7 removes is that sessions must stay open on an awake machine.
(Finn §8.) DEFERRED — the first factory window after M3 ships; condition (loop
latency and laptop-tethering actually hurting) was met 2026-08-08 per the
user.
DEFERRED 2026-08-11: the user reversed the Aug-8 promotion. Caffeinate plus
an open screen is fine and tethering is not actually hurting, so the
build-when-the-failure-mode-appears rule applies. Condition re-parked:
revisit when loop latency or laptop tethering genuinely hurts.
2026-08-25: the concrete candidate is now named — **Claude Code cloud
routines (`/schedule`)**: scheduled cloud agents running on a cron, no open
session, no awake laptop. The first step is YOY-112 (recurring
agent-executed live E2E smoke on the unfiltered deployment): a read-only,
low-blast-radius job that proves a routine can run a skill against live
Linear/GitHub/Slack from the cloud before any builder or reviewer loop moves
there. Ordering after YOY-112: watchdog → reviewer → builder, each only
after the previous one has run unattended for a milestone.
- Includes orchestrated parallel builders — queue partitioning + leases
  (absorbs YOY-37).
- Candidate compute: the $300 GCP credit — verify its ~90-day activation
  expiry. Superseded as the first option by cloud routines, which need no
  compute of our own.

**Phase 8 — Post-M2 queue (in order)**
1. UI-verification gate — ✅ DONE (PR #27, YOY-38).
2. Risk-tiered merge policy — REJECTED 2026-08-08: unattended agent merges
   rejected on safety; the Slack-approval variant rejected on value; human
   merge via GitHub stays, now phone-viable. See YOY-39's closing comment.
3. Factory watchdog — ✅ DONE (YOY-40): scheduled read-only pass verifying
   the system's claims against primary sources (Slack channel, Linear
   issues, GitHub state), alerting once per condition; pulled forward by
   the 2026-08-05 unverifiable-notification failure (Finn §7).

**2026-08-11 factory window — ✅ SHIPPED (PRs #34–#37)**
- YOY-59 — zsh-safe notification sends: captured variable renamed to
  http_status at every send site; bare status= assignments banned by
  validator. Kills the duplicate-ping ghost.
- YOY-63 — the reviewer retracts loop-approved on PRs that turn conflicting
  because main moved, with a Slack ping superseding the earlier merge-ready
  message.
- YOY-65 — multi-PR issues use Part of on intermediate PRs and Closes only
  on the closing PR; every Linear assign, unassign, or state mutation is
  verified by re-fetch with one retry; status and watchdog both flag
  auto-closed tails.
- YOY-62 — spec runs a backward-reference ordering check before filing a
  chain: every AC content reference must point to an earlier issue, with a
  stop-on-cycle rule. The chain stays strictly linear by decision, because
  a dependency graph buys parallelism that a single builder loop per repo
  cannot use.
- YOY-66 — generated repo map plus import graph with a CI drift guard,
  shipped as a factory template and seeded by init; env paths listed,
  contents never read. Adoption is per-repo (unfiltered: YOY-75, shipped in
  its PR #64; template fix: YOY-77).
- YOY-76 — guard consistency: env-like paths now deny for file-tool writes
  exactly as for Bash, with example/sample/template filenames and /tmp
  scratch paths as the two allowed exceptions. Shipped in PR #37.
- Validator grew from 125 to 140+ contracts across the window.
- Proposals filed in the same window, awaiting user sign-off before build:
  YOY-73 (/yoyo-debug — a terminal-side debugger role: offline-first repro,
  hypothesis with a decisive test, evidence to durable homes) and YOY-74
  (UX quality gate — committed DESIGN.md bar, builder screenshot evidence,
  reviewer visual judgment as must-fix).

**2026-08-13 factory window — ✅ SHIPPED**
- YOY-73 — bug intake v2 (supersedes the /yoyo-debug v1 proposal): three-lane
  routing with the trivial fast lane protected; `bug` label = cause currently
  unknown; builder diagnoses symptom-only `bug` issues before fixing (offline
  first, diagnosis posted as a Linear comment) unless a `Yoyo-diagnose report`
  comment already maps the mechanism; new /yoyo-diagnose skill —
  diagnosis-only, completeness-ruled, ends in a consolidated fix contract
  proposal. Routing table recorded in docs/PROCESS.md.
- YOY-74 — UX quality gate v2: docs/DESIGN.md holds invariants only, authored
  by /yoyo-design (YOY-79, shipped in this window); init seeds the
  placeholder; spec gates
  UI milestones on an authored DESIGN.md; builder attaches screenshot
  evidence on UI-touching PRs; reviewer judges `[DESIGN]` with must-fix only
  on citation.
- YOY-80 — standing decisions: scope discipline, fragility rule, three-lane
  bug routing.
- YOY-79 — /yoyo-design: specialist design-authoring skill; sole deliverable
  docs/DESIGN.md (invariants + direction system proportional to owned design
  surface); Claude Design as optional upstream, never a dependency. Run once
  on unfiltered before the M4 spec session. docs/HANDOFF.md renamed to
  docs/PROCESS.md in the same PR (name collided with the user's separate
  session-handoff document).

**2026-08-15 → 19 one-offs — ✅ SHIPPED (PRs #41–#45)**
- YOY-83 / YOY-85 — /yoyo-design's write surface collided with the repo-map
  drift guard (every design PR failed CI by construction). One mechanical
  carve-out: regenerate the map after DESIGN.md is committed or staged,
  never a hand edit, never license to touch other files; the design run
  ends on main.
- PR #43 — the builder regenerates the repo map in the same commit whenever
  the diff adds, removes, or renames files; a stale map is a guaranteed CI
  failure, not a reviewer question (PRs #71/#73/#75 on unfiltered each
  burned a fix round on it).
- PRs #44–#45 — the guard's env-file read deny carries the same
  example/sample/template exception as the write deny, failing closed on
  mixed commands; the settings template stops denying reads of committed
  example env files.

**2026-08-25 factory window — ✅ SHIPPED (this PR)**
- YOY-113 — multi-PR lifecycle. Resume lane: before the normal pick the
  builder resumes its own self-assigned In Progress/In Review issue with
  unchecked ACs and no open PR, never when blocked, never while a PR is
  open. AC ticking is now somebody's job: the builder ticks the ACs its PR
  completes at ship, the reviewer cross-checks every tick against the diff
  at verdict (a tick without evidence is a finding), and a repair round
  unticks what it reopens. Closure convention pinned: the slice completing
  the LAST open AC writes `Closes`; earlier slices write `Part of`
  (unfiltered PR #108 was the judgment call). Founder touches removed: one
  unassign-and-reset per slice, one manual close per multi-PR issue, and
  hand-ticking ACs.
- YOY-103 — conflicting PRs whose only loop label is `needs-human-review`
  were invisible to reviewer, builder, and Slack. Notification-only by
  decision: the reviewer posts a stale-gate note and one ⚠️ ping, once per
  state change; no relabel, builder skip rule untouched. The watchdog gains
  `stale-gate-silent` and counts resumable issues in `dead-loop`.
- Validator: 174 → 196 contracts; docs/PROCESS.md records the multi-PR
  lifecycle and the stale-gate path.

Later layers: documentation merge gates (Finn §5); morning director
(Finn §6); post-merge learning loop (Finn §9); /yoyo-plan autonomous
milestone planning.

Note: hosting, deployments, and secrets are NOT a factory phase — they are
milestone 1 of each product repo, specified in its PRD.

## Product state (live Linear, team YOY — 25 August 2026)

**unfiltered — M4 complete.** The playground milestone shipped in full
through the loop: catalog registry and public-catalog sources (YOY-88,
YOY-89), the search + click API with throttles and daily AI caps (YOY-90),
the Render deployment (YOY-91), the playground shell with its UI test lane
(YOY-92), AI states (YOY-93), the store-preload page (YOY-94), iterative
HNSW scans for full small-tenant recall (YOY-105). YOY-95's live run on the
deployed playground recorded 27/27 steps. YOY-109 — intent extraction
failing intermittently on live — was diagnosed through the bug lane, fixed
(low thinking on the intent call, intent-failure class logged) and verified
live. YOY-96, the M4 hardening tail, closed at 21 ACs across thirteen
`Part of` slices (PRs #96–#108) — the run that surfaced YOY-113: every
intermediate merge needed a founder unassign, and no AC was ever ticked by
an agent.

**unfiltered — M5 pile (specced or direction-noted, not yet chained):**
- YOY-64 — AI search latency: intent extraction dominates at 4.1–6.5s; the
  founder bar is <2s end to end, which needs model/prompt-level work, not
  tuning.
- YOY-110 — colour-exclusion semantics: exclude by primary colour, not any
  colourway (founder decision recorded).
- YOY-111 — close matches respect explicit exclusions and relax constraints
  one at a time (founder decision recorded).
- YOY-112 — recurring agent-executed live E2E smoke on the deployment;
  doubles as Phase 7's first cloud-routine step.
Parked with `[LATER]`: YOY-97 (agent-agent debugging & UI-QA lane),
YOY-102 (stop committing the widget bundle; build in CI).

**briza — M1 shipped (PRs #1–#6, 2026-08-08)**, hardening tail YOY-55
closed; no active milestone.

**yoyo-loop — factory queue empty** after this window: YOY-113 and YOY-103
close with this PR; nothing else carries `repo:yoyo-loop` in Backlog except
the `[LATER]` YOY-97.

## Standing decisions

- Build each layer only when its failure mode first appears, not
  speculatively. Every interruption or annoyance is classified: known
  one-timer or a new permanent fix in a skill/hook.
- Product ideation (Product Studio) lives outside the factory; the PRD
  committed as docs/PRD.md is the interface between them.
- The guard has two verdicts, deny and allow. Former ASK-tier commands deny
  with escalation guidance; each denied-but-safe pattern gets triaged with
  the user and promoted to a permanent allow.
- Identical logic duplicated across skills (e.g. branch tidy in both build
  and review) must be changed in every copy in the same PR; the validator
  should pin both copies.
- Deferred or parked Linear issues carry a bracketed title prefix such as
  [M5], [LATER: ...], or [PROPOSAL — awaiting user sign-off], so the active
  queue reads unambiguously at a glance; an unprefixed issue is on duty now.
- Direction notes are promoted to full AC contracts before any agent is
  pointed at them. Agents correctly stop on AC-less issues and on
  contract-versus-live mismatches (the YOY-62 and YOY-66 lesson), and that
  stop is rewarded behavior.
- **Scope discipline:** a skill never absorbs duties outside its stated
  purpose. New capability goes into an existing skill only when genuinely
  in-scope; otherwise a new skill — and a new skill only when the capability
  warrants a whole role. One bloated skill and a hundred micro-skills are the
  same disease.
- **Fragility rule:** every yoyo-loop change is examined from every direction
  before implementation — every consumer, every dependent, every interaction
  with existing mechanisms, every label and state it touches. The factory
  runs the entire show; no change is "just adding a thing." (Generalizes the
  existing consumer-mapping rule from mechanism changes to all factory
  changes.)
- **Bug routing:** bugs route through the three-lane table (trivial → chat
  one-off, fast lane protected; single unknown-cause symptom → `bug` issue
  through the loop; multi-symptom/failed run → /yoyo-diagnose → consolidated
  contract). Defined in YOY-73; recorded here so the routing survives chat
  migrations.

## Notes

- MCP tools bypass the guard hook (it judges Bash and file tools only), so
  trusted MCP servers are allowed by name at user level in
  `templates/user-settings.json`. New connectors get one allow line there,
  never per-repo.
- Pending fold-ins: YOY-37 (orchestrated parallel builders) absorbed into
  Phase 7 on 2026-08-08; none outstanding.
- Multi-PR issues: the checkbox state on the Linear issue is now the
  source of truth for what has shipped (ticked at ship, cross-checked at
  verdict). The pre-mechanism interim — founder resets the issue after each
  intermediate merge, chat hand-ticks ACs — is retired with YOY-113.
