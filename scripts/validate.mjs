import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, root), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const skillNames = ["yoyo-build", "yoyo-init", "yoyo-review", "yoyo-spec", "yoyo-status", "yoyo-watchdog"];
const skillDirectory = new URL("skills/", root);
const actualSkillNames = readdirSync(skillDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert(
  JSON.stringify(actualSkillNames) === JSON.stringify(skillNames),
  `Expected only ${skillNames.join(", ")}; found ${actualSkillNames.join(", ")}`,
);

for (const skillName of skillNames) {
  const relativePath = `skills/${skillName}/SKILL.md`;
  const text = read(relativePath);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);

  assert(frontmatter, `${relativePath} is missing YAML frontmatter`);

  const fields = frontmatter[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const name = fields.find((line) => line.startsWith("name: "))?.slice(6);
  const description = fields
    .find((line) => line.startsWith("description: "))
    ?.slice(13);

  assert(fields.length === 2, `${relativePath} must contain only name and description frontmatter`);
  assert(name === skillName, `${relativePath} name must be ${skillName}`);
  assert(description, `${relativePath} needs a description`);
  assert(!/\bTEAM\b/.test(text), `${relativePath} left an upstream TEAM placeholder`);
}

const readme = read("README.md");
for (const match of readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const target = match[1];
  if (!target.startsWith("http") && !target.startsWith("#")) {
    assert(existsSync(new URL(target, root)), `README link does not exist: ${target}`);
  }
}

const build = read("skills/yoyo-build/SKILL.md");
const roadmap = read("ROADMAP.md");
const review = read("skills/yoyo-review/SKILL.md");
const init = read("skills/yoyo-init/SKILL.md");
const spec = read("skills/yoyo-spec/SKILL.md");
const status = read("skills/yoyo-status/SKILL.md");
const watchdog = read("skills/yoyo-watchdog/SKILL.md");

// Line wrapping in the skills is prose, not contract: match against a
// whitespace-normalised copy so a reflowed paragraph cannot break a check.
const buildFlat = build.replace(/\s+/g, " ");
const reviewFlat = review.replace(/\s+/g, " ");
const specFlat = spec.replace(/\s+/g, " ");
const initFlat = init.replace(/\s+/g, " ");
const statusFlat = status.replace(/\s+/g, " ");
const watchdogFlat = watchdog.replace(/\s+/g, " ");
const roadmapFlat = roadmap.replace(/\s+/g, " ");
const oneOff = read("docs/one-off-prompts.md");
const oneOffFlat = oneOff.replace(/\s+/g, " ");

const requiredContracts = [
  [build.includes("not labeled `blocked`"), "builder must exclude blocked issues"],
  [
    buildFlat.includes("add `needs-human-review`, remove `loop-changes-requested`"),
    "builder unfixable escalation must leave the repair queue",
  ],
  [
    buildFlat.includes("also remove `loop-changes-requested`, the same as the other unfixable escalations"),
    "builder guard-denial escalation must leave the repair queue",
  ],
  [
    buildFlat.includes("Skip every PR carrying `loop-stuck`"),
    "builder step 1 must skip only loop-stuck PRs",
  ],
  [
    !buildFlat.includes("Skip every PR carrying `needs-human-review`"),
    "builder step 1 must not skip on needs-human-review; it gates the merge, not the repair",
  ],
  [
    reviewFlat.includes("`needs-human-review` and `loop-changes-requested` may coexist"),
    "reviewer must state that needs-human-review and loop-changes-requested may coexist",
  ],
  [
    reviewFlat.includes("reserved for these findings a builder cannot fix"),
    "reviewer must reserve loop-changes-requested removal for findings a builder cannot fix",
  ],
  [
    reviewFlat.includes("Reroute (escape hatch)"),
    "review skill must document the reroute escape hatch",
  ],
  [build.includes("defaultBranchRef"), "builder must detect the default branch"],
  [build.includes("git status --porcelain"), "builder must protect dirty worktrees"],
  [build.includes("repo:SLUG"), "builder must scope its pick query to this repository"],
  [build.includes("max_fix_rounds"), "builder must read the fix-round cap from config, not hardcode it"],
  [build.includes("`loop-stuck`"), "builder must have a convergence escape hatch"],
  [build.includes("sensitive_paths"), "builder must escalate sensitive-path diffs"],
  [/never force-reset/i.test(buildFlat), "builder must refuse to force-reset a diverged worktree"],
  [
    build.includes("git switch --detach origin/DEFAULT_BRANCH"),
    "builder worktree must sync by detaching onto origin's default branch; git forbids checking out the same branch in two worktrees",
  ],
  [
    /never check out the local default branch/i.test(buildFlat),
    "builder must state it never checks out the local default branch",
  ],
  [spec.includes("repo:SLUG"), "spec must label filed issues with the repository slug"],
  [/[Nn]ever apply the `agent-ready` label/.test(spec), "spec must never self-approve"],
  [
    specFlat.includes("never apply it to any issue in the chain"),
    "spec must extend the agent-ready ban to every issue in a chain",
  ],
  [
    specFlat.includes("blocked-by relation on its immediate predecessor"),
    "spec must chain split issues with Linear blocked-by relations",
  ],
  [
    specFlat.includes("Order the chain so every such reference points to an earlier issue"),
    "spec must run the backward-reference ordering check: an AC referencing an artifact another chain issue introduces must sit after that issue",
  ],
  [
    specFlat.includes("show the user the conflicting references in plain terms"),
    "spec must stop on a reference cycle and resolve the split with the user instead of guessing an order",
  ],
  [
    specFlat.includes("Only after the user approves the set"),
    "spec must require user approval of the split before drafting or filing",
  ],
  [
    specFlat.includes("check for `docs/PRD.md`. If present, read it fully"),
    "spec must read docs/PRD.md when present",
  ],
  [
    specFlat.includes("convert exactly one milestone") &&
      specFlat.includes("Never file issues for more than one milestone in a session"),
    "spec must convert exactly one PRD milestone per session",
  ],
  [
    specFlat.includes("contradict the PRD, the user wins"),
    "spec must let the user win over the PRD on contradiction",
  ],
  [
    specFlat.includes("the spec skill never edits it"),
    "spec must never edit the PRD",
  ],
  [review.includes("Yoyo-loop review of COMMIT_SHA"), "reviewer must record the reviewed SHA"],
  [review.includes("No checks at all"), "reviewer must escalate when no checks exist"],
  [review.includes("sensitive_paths"), "reviewer must escalate sensitive-path diffs"],
  [/[Nn]ever merge or enable auto-merge/.test(review), "reviewer must never merge"],
  [spec.includes("git pull --ff-only"), "spec must fast-forward the primary clone at the start of a pass"],
  [review.includes("git pull --ff-only"), "reviewer must fast-forward the primary clone at the start of a pass"],
  [
    /a stale clone is not an uninitialised repository/i.test(specFlat),
    "spec must sync before declaring the repo uninitialised",
  ],
  [
    /a stale clone is not an uninitialised repository/i.test(reviewFlat),
    "review must sync before declaring the repo uninitialised",
  ],
  [
    reviewFlat.includes("Never delete a branch whose PR is open"),
    "reviewer tidy must forbid deleting branches whose PR is open or closed-unmerged",
  ],
  [init.includes("git worktree add"), "init must create the builder worktree"],
  [
    init.includes("~/.claude/hooks/guard.sh"),
    "init must verify the guard hook is installed before writing settings",
  ],
  [
    /STOP and tell the user to run `install\.sh`/.test(init.replace(/\s+/g, " ")),
    "init must stop with install.sh instructions when the guard hook is missing",
  ],
  [
    !/[Dd]eny at minimum/.test(init),
    "init must not emit a Bash deny list; the guard hook is the sole judge of Bash",
  ],
  [
    initFlat.includes("move it to `docs/PRD.md`"),
    "init must normalise a found PRD to docs/PRD.md",
  ],
  [
    initFlat.includes("never edits its content"),
    "init must never edit PRD content",
  ],
  [
    initFlat.includes("ask the user which one is the PRD instead of guessing"),
    "init must ask rather than guess between several PRD candidates",
  ],
  [
    initFlat.includes('- ".claude/**"'),
    "init config template must list .claude/** as a sensitive path; the config must protect the config",
  ],
  [
    initFlat.includes("seed hygiene workflow"),
    "init must write a seed CI workflow for empty projects",
  ],
  [
    /on:\s*pull_request/.test(init),
    "init's seed workflow must trigger on pull_request",
  ],
  [
    specFlat.includes("extends or replaces the seed hygiene workflow"),
    "spec bootstrap chains must upgrade the seed workflow, not ignore it",
  ],
  [readme.includes("install.sh"), "README must explain how to install the skills"],
  [readme.includes("/reload-skills"), "README must tell the user to reload skills"],
  [/read-only/i.test(status), "status must declare itself read-only"],
  [
    statusFlat.includes("never mutates anything: no writes to Linear, no writes to GitHub"),
    "status must state it never mutates — no writes to Linear or GitHub",
  ],
  [status.includes(".claude/yoyo.md"), "status must read the loop config"],
  [
    statusFlat.includes("keep every directory that contains `.claude/yoyo.md`"),
    "status must discover projects by scanning for .claude/yoyo.md",
  ],
  [
    statusFlat.includes("Exclude `*.build` worktrees"),
    "status discovery must exclude .build builder worktrees",
  ],
  [
    statusFlat.includes("Every line carries a leading `[slug]` tag"),
    "status lines must carry the [slug] project tag",
  ],
  [
    statusFlat.includes("not labeled `agent-ready` and not labeled `blocked`"),
    "status backlog category must exclude blocked issues so nothing is listed twice",
  ],
  [
    statusFlat.includes("Each PR appears in exactly one category, never two"),
    "status must state each PR appears in exactly one category",
  ],
  [
    build.includes("yoyo-slack.webhook"),
    "builder must read the Slack webhook from ~/.claude/yoyo-slack.webhook",
  ],
  [
    buildFlat.includes("After applying `blocked`, send a Slack notification"),
    "builder must notify Slack when an issue becomes blocked",
  ],
  [
    buildFlat.includes("After applying `loop-stuck`, send a Slack notification"),
    "builder must notify Slack when a PR becomes loop-stuck",
  ],
  [
    buildFlat.includes("After applying `needs-human-review`, send a Slack notification"),
    "builder must notify Slack when a PR becomes needs-human-review",
  ],
  [
    review.includes("yoyo-slack.webhook"),
    "reviewer must read the Slack webhook from ~/.claude/yoyo-slack.webhook",
  ],
  [
    reviewFlat.includes("ALWAYS send one Slack notification when the PR is now in a human-decision state"),
    "reviewer must always notify on a human-decision verdict; the trigger is review evidence complete, not a label transition",
  ],
  [
    buildFlat.includes("skip notification silently"),
    "builder must skip notification silently when the webhook file is missing",
  ],
  [
    reviewFlat.includes("skip notification silently"),
    "reviewer must skip notification silently when the webhook file is missing",
  ],
  [
    readme.includes("yoyo-slack.webhook"),
    "README must document the yoyo-slack.webhook setup",
  ],
  [
    buildFlat.includes(
      "A candidate is claimable only after a per-issue relations check proves every blocker is Done or canceled.",
    ),
    "builder must verify blockers with a per-issue relations check before claiming",
  ],
  [
    buildFlat.includes("never the builder's"),
    "builder must state that overriding an unresolved blocker is never its call",
  ],
  [
    buildFlat.includes("A candidate is never carried over from a previous pass, from memory, or from narrative reasoning"),
    "builder must re-run the pick query fresh every pass and never carry a candidate over",
  ],
  [
    buildFlat.includes("re-fetch the issue and confirm the assignee actually cleared"),
    "builder must verify the assignee cleared after unassigning; a stuck assignee strands the issue",
  ],
  [
    buildFlat.includes("Repair pushes are append-only") &&
      buildFlat.includes("never force-push, never rewrite already-reviewed commits"),
    "builder repair pushes must be append-only; never force-push",
  ],
  [
    reviewFlat.includes("re-fetch of the PR performed immediately before deciding"),
    "reviewer skip decision must use a re-fetch immediately before deciding, not the pass-start listing",
  ],
  [
    roadmap.includes("## North star") &&
      roadmapFlat.includes("does this reduce Yoyo's required touches?"),
    "ROADMAP must contain the North star section",
  ],
  [
    specFlat.includes("hardening: deferred findings") &&
      specFlat.includes("filed by this spec session as the chain's final issue"),
    "spec must end every milestone chain with a hardening tail issue",
  ],
  [
    specFlat.includes("The spec never marks it `agent-ready`"),
    "spec must never mark the hardening tail agent-ready",
  ],
  [
    reviewFlat.includes(
      "a finding is must-fix when this PR's contract (an AC or NG), correctness, or security is violated",
    ),
    "reviewer must state the must-fix rubric",
  ],
  [
    reviewFlat.includes("Append each deferred finding to that issue via the Linear connector as the next numbered AC"),
    "reviewer must append deferred findings to the hardening issue as ACs",
  ],
  [
    reviewFlat.includes("do NOT create one — creation is spec logic"),
    "reviewer must never create the hardening issue; creation is spec logic",
  ],
  [
    reviewFlat.includes("send a Slack notification so a human creates the tail"),
    "reviewer's missing-tail path must notify Slack",
  ],
  [
    buildFlat.includes("the number of existing builder comments whose first line begins `Fix round`"),
    "builder must count its own fix-round comments against max_fix_rounds, not reviewer verdicts",
  ],
  [
    buildFlat.includes("first line is exactly `Fix round N pushed as SHA`"),
    "builder repair report must carry the Fix round anchor line the counting depends on",
  ],
  [
    buildFlat.includes("Send NO Slack notification at ship: review evidence does not exist yet"),
    "builder ship site must stay silent; the reviewer's verdict ping is the merge-decision call to action",
  ],
  [
    buildFlat.includes("never `git branch -D` or any force-delete fallback") &&
      buildFlat.includes(
        "When `-d` refuses after that confirmed `MERGED` state, leave the branch alone silently",
      ),
    "builder must delete merged branches with -d only and leave a confirmed-MERGED -d refusal alone silently",
  ],
  [
    !buildFlat.replace("never `git branch -D` or any force-delete fallback", "").includes("branch -D"),
    "builder must not mention branch -D anywhere outside the prohibition; no force-delete path may exist",
  ],
  [
    reviewFlat.includes("never `git branch -D` or any force-delete fallback") &&
      reviewFlat.includes(
        "When `-d` refuses after that confirmed `MERGED` state, leave the branch alone silently",
      ),
    "reviewer must delete merged branches with -d only and leave a confirmed-MERGED -d refusal alone silently",
  ],
  [
    !reviewFlat.replace("never `git branch -D` or any force-delete fallback", "").includes("branch -D"),
    "reviewer must not mention branch -D anywhere outside the prohibition; no force-delete path may exist",
  ],
  [
    buildFlat.includes('http_status=$(curl -m 5 -s -o /dev/null -w "%{http_code}"'),
    "builder notifications must capture the webhook HTTP status as send evidence",
  ],
  [
    reviewFlat.includes('http_status=$(curl -m 5 -s -o /dev/null -w "%{http_code}"'),
    "reviewer notifications must capture the webhook HTTP status as send evidence",
  ],
  [
    buildFlat.includes("a send may never be claimed without having run the command and read its status"),
    "builder must never claim a notification send without having run the command and read its status",
  ],
  [
    reviewFlat.includes("a send may never be claimed without having run the command and read its status"),
    "reviewer must never claim a notification send without having run the command and read its status",
  ],
  [
    buildFlat.includes('reported as "notifications not configured", never as "sent"'),
    "builder must report a missing webhook file as notifications not configured, never as sent",
  ],
  [
    reviewFlat.includes('reported as "notifications not configured", never as "sent"'),
    "reviewer must report a missing webhook file as notifications not configured, never as sent",
  ],
  [
    init.includes("ui_paths:") && init.includes("ui_test_command:"),
    "init config template must carry the ui_paths and ui_test_command keys of the UI verification gate",
  ],
  [
    specFlat.includes("testable assertion"),
    "spec must require UI-path verify steps to be written as testable assertions",
  ],
  [
    specFlat.includes("establish the UI test lane"),
    "spec must make a chain's first UI issue establish the UI test lane",
  ],
  [
    build.includes("ui_paths") && build.includes("ui_test_command"),
    "builder must read ui_paths and ui_test_command for the UI verification gate",
  ],
  [
    buildFlat.includes("never evidence"),
    "builder must state that interactive browser exploration is never evidence",
  ],
  [
    buildFlat.includes("distilled into committed tests"),
    "builder must require exploration findings to be distilled into committed tests",
  ],
  [
    review.includes("ui_paths"),
    "reviewer must enforce the UI verification gate on ui_paths diffs",
  ],
  [
    reviewFlat.includes("claims, not evidence"),
    "reviewer must treat session walkthroughs and uncommitted artifacts as claims, not evidence",
  ],
  [
    buildFlat.includes("never an invitation to rephrase"),
    "builder must state that a guard denial is never an invitation to rephrase the command",
  ],
  [
    specFlat.includes("no AC counts, no AC-specific file lists"),
    "spec must keep the hardening tail's scaffolding generic — no AC counts, no AC-specific file lists",
  ],
  [
    reviewFlat.includes("never contradict the tail's existing scaffolding"),
    "reviewer's tail append must keep the issue self-consistent with its scaffolding",
  ],
  [
    review.includes("Post-MN hardening"),
    "reviewer must send between-milestone deferred findings to the standing Post-MN hardening interim tail",
  ],
  [
    spec.includes("Post-MN hardening"),
    "spec must chain an existing Post-MN hardening interim tail instead of filing a duplicate",
  ],
  [
    oneOffFlat.includes("The first step is `git status` against a stated expected state"),
    "one-off prompt template must open with a git status check against an expected state",
  ],
  [
    oneOffFlat.includes("The last steps are `git checkout main` and a clean `git status`"),
    "one-off prompt template must end with git checkout main and a clean git status",
  ],
  [
    readme.includes("docs/one-off-prompts.md"),
    "README must reference the one-off prompt template",
  ],
  [
    watchdog.includes("Read-only"),
    "watchdog must declare itself read-only",
  ],
  [
    /never invents fixes/i.test(watchdogFlat),
    "watchdog must never invent fixes; alerts name condition, subject, and URL only",
  ],
  [
    watchdogFlat.includes("no later resolved message"),
    "watchdog must alert once per condition: silent while an alert is open with no later resolved message",
  ],
  [
    watchdogFlat.includes("reports its HTTP status"),
    "watchdog sends must report the webhook HTTP status as send evidence",
  ],
  [
    watchdog.includes("not_in_channel") &&
      watchdogFlat.includes("the bot must be invited"),
    "watchdog must give the /invite guidance on a not_in_channel error",
  ],
  [
    watchdogFlat.includes("do not post alerts at all"),
    "watchdog degraded mode must post no alerts; without dedupe reads, repeated alerts would spam",
  ],
  [
    read("install.sh").includes("yoyo-watchdog"),
    "install.sh must symlink the watchdog skill",
  ],
  [
    readme.includes("/yoyo-watchdog"),
    "README must document the watchdog skill",
  ],
  [
    roadmapFlat.includes("REJECTED"),
    "ROADMAP must record the merge-policy rejection",
  ],
  [
    roadmapFlat.includes("first factory window after M3"),
    "ROADMAP must record Phase 7's promotion to the first factory window after M3",
  ],
  [
    initFlat.includes("Commit `.claude/settings.json` alongside `.claude/yoyo.md`"),
    "init must commit .claude/settings.json; tracked settings materialize in every worktree and never read as dirt",
  ],
  [
    build.includes("git show origin/DEFAULT_BRANCH:.gitignore"),
    "builder clean-tree check must evaluate untracked paths against origin's default-branch .gitignore, not the stale checkout's",
  ],
  [
    buildFlat.includes("byte-identical") &&
      buildFlat.includes("the checkout restores them tracked, so nothing is lost"),
    "builder may delete byte-identical untracked files only because the checkout restores them tracked",
  ],
  [
    buildFlat.includes("A PR carrying BOTH is a builder-escalated sensitive-path PR that received a mechanical must-fix from the reviewer"),
    "builder must service PRs carrying both needs-human-review and loop-changes-requested",
  ],
  [
    buildFlat.includes("never remove `needs-human-review` during repair"),
    "builder must never remove needs-human-review during repair; it is the human merge gate, not a repair freeze",
  ],
  [
    reviewFlat.includes("Must-fix present: add `loop-changes-requested`; remove `loop-approved`; preserve a pre-existing `needs-human-review` label"),
    "reviewer's must-fix branch must preserve a pre-existing needs-human-review label",
  ],
  [
    watchdogFlat.includes("expect its ping from the reviewer's verdict, not from the builder ship site"),
    "watchdog missing-notification condition must expect the reviewer verdict ping and not alarm on the silent builder ship site",
  ],
  [
    ![buildFlat, reviewFlat, watchdogFlat].some((flat) => /(?<![A-Za-z0-9_])status=(\$\(|")/.test(flat)),
    "no send mechanism may assign to a bare `status` variable; zsh reserves it read-only, so the assignment fails after the webhook delivers and the send is retried as a duplicate",
  ],
  [
    [buildFlat, reviewFlat, watchdogFlat].every((flat) =>
      flat.includes("The captured variable is `http_status`, never `status`"),
    ),
    "every send mechanism must pin the captured variable name http_status and state why bare status is banned",
  ],
  [
    buildFlat.includes("write `Closes TEAMKEY-NNN` only when this PR completes every remaining acceptance criterion") &&
      buildFlat.includes("write `Part of TEAMKEY-NNN` instead"),
    "builder PR bodies must use Part of for intermediate PRs of a multi-PR issue and Closes only when every remaining AC is completed",
  ],
  [
    reviewFlat.includes("`Closes TEAMKEY-NNN` or `Part of TEAMKEY-NNN`"),
    "reviewer must parse the linked issue from either Closes or Part of; intermediate multi-PR bodies carry Part of",
  ],
  [
    buildFlat.includes("retry that mutation once and re-fetch again") &&
      buildFlat.includes("retry the unassign once and re-fetch again"),
    "builder must verify every Linear assign/unassign/state mutation by re-fetch, retry once, and report a persisting old value instead of assuming success",
  ],
  [
    statusFlat.includes("Done/completed while unchecked acceptance criteria remain and `agent-ready` is present"),
    "status must flag Done issues with unchecked ACs and agent-ready as an auto-close inconsistency",
  ],
  [
    watchdogFlat.includes("auto-closed-tail"),
    "watchdog must check for integration-auto-closed issues with unchecked ACs (auto-closed-tail)",
  ],
  [
    reviewFlat.includes("selected for action even when its head SHA equals the recorded verdict SHA"),
    "reviewer must select a loop-approved PR whose mergeability is CONFLICTING even at an unchanged head; a later conflict falsifies the approval",
  ],
  [
    reviewFlat.includes("approval retracted — PR became conflicting after SHA was approved; queued for rebase"),
    "reviewer retraction must swap the labels and post the approval-retracted comment instead of a full re-review",
  ],
  [
    reviewFlat.includes("earlier merge-ready ping superseded"),
    "reviewer retraction must send one ping superseding the earlier merge-ready message so the user does not merge from a stale ping",
  ],
  [
    buildFlat.includes("A send whose captured HTTP status is 2xx is final") &&
      reviewFlat.includes("A send whose captured HTTP status is 2xx is final") &&
      watchdogFlat.includes("A send whose captured HTTP status is 2xx is final"),
    "every send mechanism must state that a 2xx send is final and retries happen only on non-2xx/failure/timeout",
  ],
  [
    initFlat.includes('cp "$YOYO_LOOP/templates/repo-map.mjs" scripts/repo-map.mjs') &&
      initFlat.includes("node scripts/repo-map.mjs --check"),
    "init must seed the repo-map generator from the factory template and add the CI drift-guard step",
  ],
  [
    initFlat.includes("The map is generated, never hand-maintained: hand edits are forbidden"),
    "init must state the repo map is generated and hand edits are forbidden",
  ],
  [
    initFlat.includes("lists env files by path only and never reads their contents"),
    "init must state the repo-map generator lists env files by path only and never reads their contents",
  ],
];

for (const [condition, message] of requiredContracts) {
  assert(condition, message);
}

// Regressions caught in review: a hardcoded team key silently breaks every
// project whose Linear team is not the one it was written against.
for (const [file, text] of [
  ["skills/yoyo-build/SKILL.md", build],
  ["skills/yoyo-review/SKILL.md", review],
]) {
  assert(
    !/\b[A-Z]{2,5}-NNN\b/.test(text.replace(/TEAMKEY-NNN/g, "")),
    `${file} hardcodes a Linear team key; read linear_team from config instead`,
  );
}

// Order matters, not just presence: detaching is the step that would orphan
// unpushed commits, so a check placed after it can only ever report success.
const localOnlyCheck = buildFlat.indexOf("git log --oneline HEAD --not --remotes");
const detachStep = buildFlat.indexOf("git switch --detach origin/DEFAULT_BRANCH");
assert(
  localOnlyCheck !== -1,
  "builder must look for commits that exist on no origin ref before syncing",
);
assert(
  localOnlyCheck < detachStep,
  "builder must check for local-only commits BEFORE detaching; after the detach the check can only pass",
);

// Same order discipline for the tidy step: deleting branches before the
// unpushed-work check could delete the only ref pointing at unpushed commits.
const builderTidy = buildFlat.indexOf("git remote prune origin");
assert(builderTidy !== -1, "builder must prune merged issue branches in the worktree");
assert(
  localOnlyCheck < builderTidy,
  "builder must tidy merged branches only AFTER the unpushed-work check passes",
);

// Same discipline for spec and review: a sync placed after the missing-config
// abort never runs, so a stale clone reads as an uninitialised repository.
const specSync = specFlat.indexOf("git pull --ff-only");
const specConfigRead = specFlat.search(/read `\.claude\/yoyo\.md`/i);
assert(
  specSync !== -1 && specConfigRead !== -1 && specSync < specConfigRead,
  "spec must sync the clone BEFORE reading config; a sync after the missing-config abort never runs",
);
const reviewSync = reviewFlat.indexOf("git pull --ff-only");
const reviewConfigRead = reviewFlat.search(/read `\.claude\/yoyo\.md`/i);
assert(
  reviewSync !== -1 && reviewConfigRead !== -1 && reviewSync < reviewConfigRead,
  "review must sync the clone BEFORE reading config; a sync after the missing-config abort never runs",
);

assert(!build.includes("origin/main"), "builder hardcodes origin/main");
assert(!build.includes("default_branch"), "builder must detect the default branch live, not read a stale copy");
assert(
  review.includes("none are required"),
  "reviewer must treat unrequired checks as a valid gate; branch protection is unavailable on free private repos",
);

// The guard hook ships with the repo, installs alongside the skills, and its
// test file must keep exercising every deny case the loop's safety rests on.
assert(existsSync(new URL("hooks/guard.sh", root)), "hooks/guard.sh must exist");
assert(existsSync(new URL("hooks/guard.test.sh", root)), "hooks/guard.test.sh must exist");
assert(
  read("install.sh").includes("hooks/guard.sh"),
  "install.sh must symlink the guard hook into ~/.claude/hooks",
);
assert(
  read(".github/workflows/validate.yml").includes("hooks/guard.test.sh"),
  "CI must run the guard hook tests",
);

const guardTest = read("hooks/guard.test.sh");
const guardDenyCases = [
  ['check deny  "$MAIN_REPO"    "git push"', "bare push on main in the primary clone"],
  ['check deny  "$MAIN_REPO" "git -c user.name=x push"', "config injection must not bypass the push guard"],
  ['check deny  "$MAIN_REPO" "git push origin main"', "explicit push to main"],
  ['"gh pr merge', "merging a PR"],
  ['| sh"', "curl piped into a shell"],
];
for (const [needle, why] of guardDenyCases) {
  assert(guardTest.includes(needle), `guard.test.sh must keep a deny test for: ${why}`);
}
assert(
  guardTest.includes(".env.example"),
  "guard.test.sh must exercise the .env.example allowance",
);

// The guard has exactly two verdicts, deny and allow. An ASK prompt stalls an
// unattended loop forever, so former ASK-tier commands deny with escalation
// guidance instead of prompting.
const guard = read("hooks/guard.sh");
assert(
  !guard.includes("decide ask"),
  "guard must never emit an ask verdict; an ASK prompt stalls an unattended loop",
);
assert(
  !/^ask\(\)/m.test(guard),
  "guard must not define an ask() helper; former ASK-tier commands deny with escalation guidance",
);
assert(
  guard.includes("Escalate instead"),
  "guard's former ASK tier must deny with escalation guidance",
);
assert(
  guardTest.includes('check_escalate "$MAIN_REPO" "vercel deploy'),
  "guard.test.sh must prove a deploy-class command denies with the escalation message",
);
assert(
  buildFlat.includes("do not retry it and do not work around it"),
  "builder must escalate, not retry, when the guard denies a command with the escalation message",
);
assert(
  guard.includes("add_only_example"),
  "guard must allow staging the exact basename .env.example while denying every other .env* path",
);
assert(
  guard.includes("'git branch -f' would rewrite the default branch ref"),
  "guard must deny git branch -f/--force on the default branch",
);
assert(
  guard.includes("'git update-ref' on the default branch rewrites it outside review"),
  "guard must deny git update-ref on the default branch",
);
assert(
  guard.includes("never an invitation to find an equivalent phrasing"),
  "guard escalation message must state a denial is never an invitation to rephrase",
);
assert(
  guard.includes("report which parts executed"),
  "guard escalation message must require reporting which parts of a chained command executed",
);

// Init cannot write .claude/settings.json itself — the guard denies agent
// writes to Claude settings files — so it proposes and the human copies.
assert(
  init.includes("settings.proposed.json"),
  "init must stage settings as .claude/settings.proposed.json instead of writing settings.json",
);
assert(
  initFlat.includes("cp PROJECT_PATH/.claude/settings.proposed.json PROJECT_PATH/.claude/settings.json"),
  "init must instruct the user to run the cp command that installs the proposed settings",
);
assert(
  initFlat.includes("the human copying the file IS the approval gate"),
  "init must state that the human copying the file is the approval gate",
);

// The repo-map generator ships as a factory template. Its env-file rule is
// structural: the single readText() gate refuses env-like paths, so no code
// path can read env-file contents; the map lists their paths only.
assert(existsSync(new URL("templates/repo-map.mjs", root)), "templates/repo-map.mjs must exist");
const repoMapTemplate = read("templates/repo-map.mjs");
assert(
  repoMapTemplate.includes("never read env-file contents") &&
    repoMapTemplate.includes("refusing to read env file contents"),
  "repo-map template must refuse env-file reads at its single read gate; paths only",
);
assert(
  repoMapTemplate.includes("do not edit by hand"),
  "repo-map template must stamp its output as generated, never hand-edited",
);
assert(
  repoMapTemplate.includes('FIX_COMMAND = "node scripts/repo-map.mjs"'),
  "repo-map drift guard must name the exact fix command in its failure message",
);

console.log(
  `Validated ${skillNames.length} skills, README links, and ${requiredContracts.length} safety contracts.`,
);
