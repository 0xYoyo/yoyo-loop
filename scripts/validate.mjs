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

const skillNames = ["yoyo-build", "yoyo-init", "yoyo-review", "yoyo-spec", "yoyo-status"];
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
const review = read("skills/yoyo-review/SKILL.md");
const init = read("skills/yoyo-init/SKILL.md");
const spec = read("skills/yoyo-spec/SKILL.md");
const status = read("skills/yoyo-status/SKILL.md");

// Line wrapping in the skills is prose, not contract: match against a
// whitespace-normalised copy so a reflowed paragraph cannot break a check.
const buildFlat = build.replace(/\s+/g, " ");
const reviewFlat = review.replace(/\s+/g, " ");
const specFlat = spec.replace(/\s+/g, " ");
const initFlat = init.replace(/\s+/g, " ");
const statusFlat = status.replace(/\s+/g, " ");

const requiredContracts = [
  [build.includes("not labeled `blocked`"), "builder must exclude blocked issues"],
  [build.includes("remove `loop-changes-requested`"), "builder escalation must leave the repair queue"],
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

console.log(
  `Validated ${skillNames.length} skills, README links, and ${requiredContracts.length} safety contracts.`,
);
