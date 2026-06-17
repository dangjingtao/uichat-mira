import { execFileSync } from "node:child_process";

const forbiddenPattern = /\.(db|sqlite|db-shm|db-wal)$/i;

const stagedOutput = execFileSync(
  "git",
  ["-c", "core.quotepath=off", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { encoding: "utf8" },
);

const stagedPaths = stagedOutput
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter(Boolean);

const forbiddenPaths = stagedPaths.filter((filePath) =>
  forbiddenPattern.test(filePath),
);

if (forbiddenPaths.length > 0) {
  console.error("Commit blocked: database files cannot be committed.");
  console.error("Remove these paths from the index before committing:");
  for (const filePath of forbiddenPaths) {
    console.error(`- ${filePath}`);
  }
  console.error(
    'Suggested fix: git restore --staged <path>  (or git rm --cached <path> if already tracked)',
  );
  process.exit(1);
}
