// Regression test for templates/repo-map.mjs (YOY-77): in git mode, a
// tracked .env.example must surface in the map's key-locations section —
// the git-mode listing filter used to drop every ENV_FILE match, making
// envPaths()'s example detection dead code. Also proves real env files stay
// out of the map even when tracked, and that the TS-ESM .js → .ts resolver
// mapping resolves internal edges.
//
// Self-contained: builds a throwaway git repo under a temp dir, runs the
// template against it, and asserts on the generated docs/REPO-MAP.md.
// Run directly: node scripts/repo-map-template.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE = fileURLToPath(new URL("../templates/repo-map.mjs", import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), "repo-map-test-"));

let failures = 0;
function check(condition, message) {
  if (condition) {
    console.log(`ok    ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${message}`);
  }
}

try {
  const git = (...args) =>
    execFileSync("git", ["-C", fixture, ...args], { encoding: "utf8" });

  writeFileSync(join(fixture, ".env.example"), "EXAMPLE_KEY=\n");
  writeFileSync(join(fixture, ".env.local"), "NOT_A_REAL_SECRET=fixture\n");
  writeFileSync(join(fixture, "package.json"), '{ "name": "fixture" }\n');
  mkdirSync(join(fixture, "src"));
  writeFileSync(join(fixture, "src", "index.ts"), "export const x = 1;\n");
  writeFileSync(
    join(fixture, "src", "classify.ts"),
    'import { x } from "./index.js";\nexport const y = x;\n',
  );

  git("init", "-q", "-b", "main");
  // -f: the fixture deliberately tracks a real env file to prove the
  // generator excludes it from the map even when git lists it.
  git("add", "-f", ".env.example", ".env.local", "package.json", "src");
  git("-c", "user.email=test@test", "-c", "user.name=test",
    "commit", "-q", "-m", "fixture");

  execFileSync(process.execPath, [TEMPLATE], { cwd: fixture, encoding: "utf8" });
  const map = readFileSync(join(fixture, "docs", "REPO-MAP.md"), "utf8");
  const keyLocations = map.split("## Key locations")[1].split("## Module dependency map")[0];

  check(
    keyLocations.includes(".env.example"),
    "git mode: tracked .env.example appears in the key-locations section",
  );
  check(
    !map.includes(".env.local"),
    "git mode: a real env file stays out of the map even when tracked",
  );
  check(
    map.includes("src/classify.ts → src/index.ts"),
    "TS-ESM: a .js-suffixed relative import resolves to its .ts source",
  );
  check(
    !map.includes("(unresolved)"),
    "no internal edge renders as (unresolved) in the fixture",
  );

  const checkRun = execFileSync(process.execPath, [TEMPLATE, "--check"], {
    cwd: fixture,
    encoding: "utf8",
  });
  check(
    checkRun.includes("up to date"),
    "--check passes immediately after generation (drift guard sanity)",
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log();
console.log(failures === 0 ? "repo-map template tests passed" : `${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
