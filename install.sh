#!/usr/bin/env bash
# Symlinks the yoyo-loop skills into ~/.claude/skills so every project sees them.
# Edits to this repo take effect immediately, everywhere. Re-run any time.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HOME}/.claude/skills"
mkdir -p "$DEST"

for skill in yoyo-spec yoyo-build yoyo-review yoyo-init yoyo-status yoyo-watchdog yoyo-diagnose yoyo-design; do
  src="${REPO}/skills/${skill}"
  [ -d "$src" ] || { echo "missing: $src"; exit 1; }
  ln -sfn "$src" "${DEST}/${skill}"
  echo "linked ${DEST}/${skill} -> ${src}"
done

HOOKS_DEST="${HOME}/.claude/hooks"
mkdir -p "$HOOKS_DEST"
ln -sfn "${REPO}/hooks/guard.sh" "${HOOKS_DEST}/guard.sh"
echo "linked ${HOOKS_DEST}/guard.sh -> ${REPO}/hooks/guard.sh"

echo
echo "Done. Run /reload-skills in Claude Code (or restart it),"
echo "then check /skills lists yoyo-spec, yoyo-build, yoyo-review, yoyo-init, yoyo-status, yoyo-watchdog, yoyo-diagnose, yoyo-design."
