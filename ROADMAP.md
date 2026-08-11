# Roadmap

Last updated: 11 August 2026 — factory window shipped (YOY-59/62/63/65/66/76,
PRs #34–#37); Phase 7 deferred; debug and UX gates proposed (YOY-73/74).

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

**Phase 7 — Off the open session**
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
- Includes orchestrated parallel builders — queue partitioning + leases
  (absorbs YOY-37).
- Candidate compute: the $300 GCP credit — verify its ~90-day activation
  expiry.

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

Later layers: documentation merge gates (Finn §5); morning director
(Finn §6); post-merge learning loop (Finn §9); /yoyo-plan autonomous
milestone planning.

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

## Notes

- MCP tools bypass the guard hook (it judges Bash and file tools only), so
  trusted MCP servers are allowed by name at user level in
  `templates/user-settings.json`. New connectors get one allow line there,
  never per-repo.
- Pending fold-ins: YOY-37 (orchestrated parallel builders) absorbed into
  Phase 7 on 2026-08-08; none outstanding.
