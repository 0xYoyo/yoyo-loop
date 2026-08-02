#!/usr/bin/env bash
# hooks/guard.sh — installed as ~/.claude/hooks/guard.sh (see install.sh).
# PreToolUse guard for unattended agentic loops.
#
# Two tiers:
#   DENY  - refused outright. Hard denials (bypasses review, irreversible,
#           credential exfiltration) keep their specific messages. Command
#           classes that formerly asked for authorization also deny now, with
#           escalation guidance: an ASK prompt stalls an unattended loop
#           forever, so a pass must fail fast and escalate to a human instead
#           of hanging.
#   allow - everything else, silently.
#
# Reads the hook payload on stdin. Emits a decision as JSON, or exits 0 to allow.

set -uo pipefail

payload="$(cat)"
tool="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"

decide() { # decide <allow|deny|ask> <reason>
  jq -nc --arg d "$1" --arg r "$2" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: $d,
      permissionDecisionReason: $r
    }
  }'
  exit 0
}
deny() { decide deny "$1"; }

# Former ASK tier: deny with escalation guidance so an agent pass ends and
# escalates instead of waiting on a prompt nobody will answer. Each
# denied-but-safe pattern gets triaged with the user and promoted to a
# permanent allow.
ESCALATE_MSG='yoyo-loop guard: this command class requires a human and is denied in agent sessions. Do not retry it. Escalate instead: builders comment the exact command and why it is needed, apply `blocked` (issue) or `needs-human-review` (PR), and end the pass.'
escalate() { decide deny "$ESCALATE_MSG Context: $1"; }

project_root() {
  local r="${CLAUDE_PROJECT_DIR:-$PWD}"
  printf '%s' "${r%/}"
}

ROOT="$(project_root)"
BUILD="${ROOT}.build"

# The directory the Bash tool will actually run in. The payload's cwd is
# authoritative; CLAUDE_PROJECT_DIR is only a fallback. Every git command is
# judged against the repo/branch at its own execution directory, not against
# the project root — a detached builder worktree and the primary clone are
# different checkouts and must be judged separately.
EFFDIR="$(printf '%s' "$payload" | jq -r '.cwd // ""')"
[ -z "$EFFDIR" ] && EFFDIR="${CLAUDE_PROJECT_DIR:-$PWD}"

# resolve_dir <base> <path>: print the absolute, physical directory <path>
# names when resolved against <base>. Prints nothing (and fails) when it
# cannot be resolved — callers treat that as "unknown", which fails closed.
resolve_dir() {
  local base="$1" p="$2"
  p="${p%\'}"; p="${p#\'}"; p="${p%\"}"; p="${p#\"}"
  case "$p" in
    '~')   p="$HOME" ;;
    '~/'*) p="$HOME/${p#\~/}" ;;
  esac
  case "$p" in
    /*) ;;
    *)
      [ -z "$base" ] && return 1
      p="$base/$p" ;;
  esac
  (cd "$p" 2>/dev/null && pwd -P)
}

# Is an already-absolute path inside a workspace we consider "ours"?
in_workspace() {
  case "$1" in
    "$ROOT"|"$ROOT"/*|"$BUILD"|"$BUILD"/*) return 0 ;;
    /tmp/*|/private/tmp/*|/var/folders/*)   return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------- file writes
case "$tool" in
  Write|Edit|NotebookEdit)
    path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""')"
    [ -z "$path" ] && exit 0

    # Credential material is never writable, prompt or not.
    case "$path" in
      "$HOME"/.ssh/*|"$HOME"/.aws/*|"$HOME"/.gnupg/*|"$HOME"/Library/Keychains/*|"$HOME"/.claude/.credentials.json)
        deny "Blocked: writes to credential material (~/.ssh, ~/.aws, ~/.gnupg, keychain, Claude credentials) are never permitted." ;;
    esac

    # Claude settings changes need a human: denied with escalation guidance
    # so the loop fails fast instead of waiting on a prompt.
    case "$path" in
      */.claude/settings.json|*/.claude/settings.local.json|\
      "$HOME"/.claude/settings.json|"$HOME"/.claude/settings.local.json)
        escalate "This rewrites Claude permission settings ($path) - review the diff before approving." ;;
    esac

    in_workspace "$path" && exit 0
    escalate "Write outside the project. Target: $path (project is $ROOT)"
    ;;
  Bash) ;;
  *) exit 0 ;;
esac

# ---------------------------------------------------------------------- bash
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')"
[ -z "$cmd" ] && exit 0

# Remote script piped into a shell. Inspect actual pipeline structure rather
# than searching the raw string: a grep pattern or a commit message may legitimately
# contain "curl ... | sh" as text, and that must not be treated as running it.
if [[ "$cmd" == *"|"* ]]; then
  prev_stage=""
  while IFS= read -r stage; do
    stage="${stage#"${stage%%[![:space:]]*}"}"
    if [[ "$prev_stage" =~ ^(sudo[[:space:]]+)?(curl|wget)([[:space:]]|$) ]] && \
       [[ "$stage"      =~ ^(sudo[[:space:]]+)?(ba|z|k|da)?sh([[:space:]]|$) ]]; then
      deny "Blocked: piping a downloaded script directly into a shell."
    fi
    prev_stage="$stage"
    # here-string (not process substitution): guarantees a trailing newline so
    # `read` does not silently drop the final pipeline stage.
  done <<< "$(printf '%s' "$cmd" | tr '|' '\n')"
fi

# Evaluate each pipeline/list segment on its own, so a quoted mention of a
# dangerous string (grep 'rm -rf') is not confused with actually running it.
segments="$(printf '%s' "$cmd" | tr '\n;&|' '\n\n\n\n')"

while IFS= read -r seg; do
  seg="${seg#"${seg%%[![:space:]]*}"}"
  seg="${seg#\(}"; seg="${seg#\{}"
  seg="${seg#"${seg%%[![:space:]]*}"}"
  [ -z "$seg" ] && continue

  # Strip leading VAR=value assignments and wrappers, repeatedly, so that
  #   env FOO=1 nohup bash -c "rm -rf /"
  # is judged on the inner command rather than on the wrapper.
  prev=""
  while [ "$seg" != "$prev" ]; do
    prev="$seg"
    while [[ "$seg" =~ ^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+(.*)$ ]]; do
      seg="${BASH_REMATCH[1]}"
    done
    [[ "$seg" =~ ^(env|nohup|time|command|builtin|exec|stdbuf|nice|setsid|xargs)[[:space:]]+(.*)$ ]] && \
      seg="${BASH_REMATCH[2]}"
    if [[ "$seg" =~ ^(ba|z|k|da)?sh[[:space:]]+-[a-zA-Z]*c[[:space:]]+(.*)$ ]]; then
      seg="${BASH_REMATCH[2]}"
      seg="${seg#\'}"; seg="${seg%\'}"
      seg="${seg#\"}"; seg="${seg%\"}"
    fi
    seg="${seg#"${seg%%[![:space:]]*}"}"
  done

  # Track `cd` so every later segment (`cd <dir> && git ...`) is judged in
  # the directory it will actually run in. An unresolvable target leaves the
  # directory unknown, which fails closed at the push check below.
  if [[ "$seg" =~ ^cd([[:space:]]+(.*))?$ ]]; then
    target="${BASH_REMATCH[2]:-}"
    read -r target _ <<< "$target"
    if [ -z "$target" ]; then
      EFFDIR="$HOME"
    else
      EFFDIR="$(resolve_dir "$EFFDIR" "$target" || true)"
    fi
    continue
  fi

  # Peel git's global flags: resolve `-C <path>` into the directory the
  # command runs in (instead of discarding it), and drop `-c key=val` config
  # so injected config cannot disguise the subcommand.
  seg_git_dir="$EFFDIR"
  while true; do
    if [[ "$seg" =~ ^git[[:space:]]+-C[[:space:]]+([^[:space:]]+)[[:space:]]+(.*)$ ]] || \
       [[ "$seg" =~ ^git[[:space:]]+-C([^[:space:]]+)[[:space:]]+(.*)$ ]]; then
      seg_git_dir="$(resolve_dir "$seg_git_dir" "${BASH_REMATCH[1]}" || true)"
      seg="git ${BASH_REMATCH[2]}"
    elif [[ "$seg" =~ ^git[[:space:]]+-c[[:space:]]+[^[:space:]]+[[:space:]]+(.*)$ ]] || \
         [[ "$seg" =~ ^git[[:space:]]+-c[^[:space:]]+[[:space:]]+(.*)$ ]]; then
      seg="git ${BASH_REMATCH[1]}"
    else
      break
    fi
  done

  # ===================================================== TIER 1 - HARD DENY ==

  # -- bypasses human review ---------------------------------------------
  [[ "$seg" =~ ^gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$) ]] && \
    deny "Blocked: 'gh pr merge' bypasses human review. You merge in the GitHub UI."
  [[ "$seg" =~ ^gh[[:space:]]+pr[[:space:]]+review([[:space:]].*)?(--approve|[[:space:]]-a([[:space:]]|$)) ]] && \
    deny "Blocked: an agent may not approve a pull request."
  [[ "$seg" =~ ^gh[[:space:]]+api([[:space:]].*)?/merge ]] && \
    deny "Blocked: 'gh api' against a /merge endpoint bypasses review."
  [[ "$seg" =~ ^gh[[:space:]]+api([[:space:]].*)?(mergePullRequest|enablePullRequestAutoMerge) ]] && \
    deny "Blocked: merging a PR via the GraphQL API bypasses review."
  [[ "$seg" =~ ^gh[[:space:]]+api([[:space:]].*)?(-X[[:space:]]*DELETE|--method[[:space:]]*DELETE) ]] && \
    deny "Blocked: destructive DELETE via 'gh api'."

  # -- history rewrites with no recovery path ----------------------------
  [[ "$seg" =~ ^git[[:space:]]+filter-branch([[:space:]]|$) ]] && \
    deny "Blocked: 'git filter-branch' rewrites history irreversibly."
  [[ "$seg" =~ ^git[[:space:]]+reflog[[:space:]]+expire ]] && \
    deny "Blocked: expiring the reflog removes the last recovery path."
  [[ "$seg" =~ ^git[[:space:]]+gc([[:space:]].*)?--prune ]] && \
    deny "Blocked: 'git gc --prune' drops unreachable objects permanently."

  # -- credentials and secrets -------------------------------------------
  [[ "$seg" =~ ^gh[[:space:]]+auth[[:space:]]+(logout|refresh|token)([[:space:]]|$) ]] && \
    deny "Blocked: mutating or printing the gh credential."
  [[ "$seg" =~ ^(cat|bat|less|more|head|tail|echo|printf|xxd|od|strings|nl)([[:space:]].*)?\.env ]] && \
    deny "Blocked: printing a .env file."
  [[ "$seg" =~ ^git[[:space:]]+add([[:space:]].*)?(\.env|\.pem|\.key|id_rsa) ]] && \
    deny "Blocked: staging a secret file (.env*, *.pem, *.key, id_rsa*)."
  # Only when a file-consuming command actually operates on the path - a mere
  # mention (grep pattern, commit message, doc text) must not be refused.
  if [[ "$seg" =~ ^(cat|bat|less|more|head|tail|nl|od|xxd|strings|cp|mv|scp|rsync|tar|zip|ssh-keygen|ssh-add|open|vi|vim|nano|emacs)([[:space:]]|$) ]] && \
     [[ "$seg" =~ (\.ssh/|\.aws/|\.gnupg/|login\.keychain|Library/Keychains) ]]; then
    deny "Blocked: access to SSH, AWS, GPG, or keychain material."
  fi
  [[ "$seg" =~ ^security([[:space:]]|$) ]] && \
    deny "Blocked: macOS keychain access via 'security'."

  # -- privilege escalation and machine state ----------------------------
  [[ "$seg" =~ ^sudo([[:space:]]|$) ]] && deny "Blocked: 'sudo'."
  [[ "$seg" =~ ^su([[:space:]]|$) ]]   && deny "Blocked: 'su'."
  [[ "$seg" =~ ^(shutdown|reboot|halt)([[:space:]]|$) ]] && \
    deny "Blocked: system power command."
  [[ "$seg" =~ ^diskutil([[:space:]]|$) ]] && \
    deny "Blocked: 'diskutil' can erase volumes and has no use in this workflow."
  [[ "$seg" =~ ^gh[[:space:]]+repo[[:space:]]+delete([[:space:]]|$) ]] && \
    deny "Blocked: deleting a repository."

  # -- git push: branch-aware --------------------------------------------
  if [[ "$seg" =~ ^git[[:space:]]+push([[:space:]]|$) ]]; then
    is_force=false
    [[ "$seg" =~ (--force-with-lease|--force([[:space:]]|=|$)|[[:space:]]-f([[:space:]]|$)) ]] && is_force=true

    targets_default=false
    [[ "$seg" =~ [[:space:]](main|master)([[:space:]]|$) ]] && targets_default=true
    [[ "$seg" =~ :(main|master)([[:space:]]|$) ]] && targets_default=true

    # No explicit refspec? then it pushes the current branch of the checkout
    # it runs in - go look there. The first non-flag token is the remote;
    # only tokens after it are refspecs.
    if [ "$targets_default" = false ]; then
      rest="${seg#git}"; rest="${rest#"${rest%%[![:space:]]*}"}"; rest="${rest#push}"
      explicit=false
      seen_remote=false
      for tok in $rest; do
        case "$tok" in
          --|-*) continue ;;
          *)
            if [ "$seen_remote" = false ]; then
              seen_remote=true
            else
              explicit=true
            fi ;;
        esac
      done
      if [ "$explicit" = false ]; then
        br=""
        if [ -n "$seg_git_dir" ]; then
          br="$(git -C "$seg_git_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
        fi
        # Unknown repo or unknown branch: refuse to guess - fail closed.
        [ -z "$br" ] && \
          escalate "Cannot determine which repository/branch this push targets (${seg_git_dir:-unknown directory}): $seg"
        { [ "$br" = "main" ] || [ "$br" = "master" ]; } && targets_default=true
        # A detached HEAD ("br" = HEAD) pushes nothing implicit - not judged
        # against any other checkout's branch.
      fi
    fi

    if [ "$targets_default" = true ]; then
      deny "Blocked: push to the default branch. Open a PR instead."
    fi
    if [ "$is_force" = true ]; then
      escalate "Force push to a non-default branch. Normal after a rebase, but it overwrites the remote branch: $seg"
    fi
  fi

  # -- rm: allowed inside the workspace, gated outside it ----------------
  if [[ "$seg" =~ ^rm([[:space:]]|$) ]]; then
    recursive_force=false
    [[ "$seg" =~ -[a-zA-Z]*[rR][a-zA-Z]*[fF]|-[a-zA-Z]*[fF][a-zA-Z]*[rR] ]] && recursive_force=true
    { [[ "$seg" =~ -[rR]([[:space:]]|$) ]] && [[ "$seg" =~ -[fF]([[:space:]]|$) ]]; } && recursive_force=true

    if [ "$recursive_force" = true ]; then
      rest="${seg#rm}"
      verdict="allow"
      for tok in $rest; do
        case "$tok" in
          -*) continue ;;
          /|'~'|'~/'|'$HOME'|'$HOME/'|'${HOME}'|"$HOME"|"$HOME"/)
            deny "Blocked: recursive delete of the filesystem root or your home directory." ;;
          *..*) verdict="escalate" ;;
          /*) in_workspace "$tok" || verdict="escalate" ;;
          *)  in_workspace "${EFFDIR:-$ROOT}/$tok" || verdict="escalate" ;;
        esac
      done
      [ "$verdict" = "escalate" ] && \
        escalate "Recursive forced delete reaching outside the project: $seg"
    fi
  fi

  # ================================= TIER 2 - ESCALATE (deny with guidance) ==

  # -- destructive git, recoverable --------------------------------------
  [[ "$seg" =~ ^git[[:space:]]+reset([[:space:]].*)?--hard ]] && \
    escalate "'git reset --hard' discards uncommitted work: $seg"
  [[ "$seg" =~ ^git[[:space:]]+clean([[:space:]].*)?-[a-zA-Z]*[fF] ]] && \
    escalate "'git clean -f' permanently deletes untracked files: $seg"
  [[ "$seg" =~ ^git[[:space:]]+branch([[:space:]].*)?[[:space:]]-D([[:space:]]|$) ]] && \
    escalate "'git branch -D' force-deletes a possibly unmerged branch: $seg"
  [[ "$seg" =~ ^git[[:space:]]+worktree[[:space:]]+remove ]] && \
    escalate "Removing a worktree can discard uncommitted work: $seg"
  [[ "$seg" =~ ^git[[:space:]]+config([[:space:]].*)?--global ]] && \
    escalate "'git config --global' changes git behaviour for every repo: $seg"

  # -- file ownership and system services --------------------------------
  [[ "$seg" =~ ^chmod([[:space:]].*)?777 ]] && \
    escalate "'chmod 777' makes a file world-writable: $seg"
  [[ "$seg" =~ ^chown([[:space:]]|$) ]] && \
    escalate "'chown' changes file ownership: $seg"
  [[ "$seg" =~ ^killall([[:space:]]|$) ]] && \
    escalate "'killall' terminates every process matching the name: $seg"
  [[ "$seg" =~ ^(launchctl|systemctl)([[:space:]]|$) ]] && \
    escalate "System service management: $seg"

  # -- package and system installs ---------------------------------------
  [[ "$seg" =~ ^pip3?[[:space:]]+install([[:space:]]|$) ]] && \
    escalate "'pip install': $seg"
  [[ "$seg" =~ ^npm[[:space:]]+(i|install|add)([[:space:]].*)?([[:space:]]-g([[:space:]]|$)|--global) ]] && \
    escalate "Global npm install changes machine-wide state: $seg"
  [[ "$seg" =~ ^brew[[:space:]]+(install|uninstall|upgrade)([[:space:]]|$) ]] && \
    escalate "'brew' changes machine-wide state: $seg"

  # -- publishing, spending, infrastructure ------------------------------
  [[ "$seg" =~ ^(npx[[:space:]]+)?npm[[:space:]]+(publish|unpublish|deprecate)([[:space:]]|$) ]] && \
    escalate "Publishing to npm is public and hard to undo: $seg"
  [[ "$seg" =~ ^gh[[:space:]]+repo[[:space:]]+archive([[:space:]]|$) ]] && \
    escalate "Archiving a repository: $seg"
  [[ "$seg" =~ ^gh[[:space:]]+secret[[:space:]]+set([[:space:]]|$) ]] && \
    escalate "Writing a repository secret: $seg"
  [[ "$seg" =~ ^gh[[:space:]]+release[[:space:]]+(create|delete)([[:space:]]|$) ]] && \
    escalate "Creating or deleting a public release: $seg"
  [[ "$seg" =~ ^(npx[[:space:]]+)?(netlify|vercel)([[:space:]].*)?deploy ]] && \
    escalate "Deploying: $seg"
  [[ "$seg" =~ ^(npx[[:space:]]+)?wrangler[[:space:]]+(publish|deploy)([[:space:]]|$) ]] && \
    escalate "Deploying via wrangler: $seg"

done <<< "$segments"

exit 0
