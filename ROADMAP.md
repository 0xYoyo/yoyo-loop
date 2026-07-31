# Roadmap

Status board for the yoyo-loop build phases. The ordering follows Alex Finn's
Finn-loop README ("From the starter loop to a full software factory" — not in
this repo; it describes growing a minimal builder/reviewer loop step by step
into a fully unattended pipeline).

| Phase | What | Status |
| --- | --- | --- |
| 1 | Unattended-safe freedom: guard hook v2 (versioned + tested), permission inversion, auto-sync / auto-prune | **DONE** — PRs #5–#7 |
| 2 | Multi-issue spec splitting via Linear blocked-by chains | **DONE** — PR #9 |
| 3 | `/yoyo-status` read-only queue view | **DONE** — PR #10 |
| 4 | Fresh-reviewer convergence completing the loop-stuck cap | Planned |
| 5 | Notification lane (Slack/Telegram) with live re-verification | Planned |
| 6 | Off the open session (Cloud Routines / persistent workers) | Planned |
| 7 | Later: `/yoyo-vision` project interview, preview gates, risk-tiered merging, morning director, watchdog, post-merge learning loop | Later |

## Notes

- MCP tools bypass the guard hook (it judges Bash and file tools only), so
  trusted MCP servers are allowed by name at user level in
  `templates/user-settings.json`. New connectors get one allow line there,
  never per-repo.
