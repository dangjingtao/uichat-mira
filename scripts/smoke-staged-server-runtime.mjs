import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const serverRoot = path.join(projectRoot, ".artifacts", "server-bundle");
const stagedNode = path.join(projectRoot, ".artifacts", "node-runtime", "node.exe");

if (process.platform !== "win32") {
  throw new Error(
    `Staged server runtime smoke requires Windows; current platform is ${process.platform}.`,
  );
}

for (const [label, targetPath] of [
  ["staged Node runtime", stagedNode],
  ["staged server bundle", serverRoot],
  ["staged better-sqlite3 package", path.join(serverRoot, "node_modules", "better-sqlite3")],
]) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing ${label}: ${targetPath}`);
  }
}

const probe = String.raw`
const Database = require('better-sqlite3');
const db = new Database(':memory:');
try {
  db.exec('create table smoke_test (value integer not null)');
  db.prepare('insert into smoke_test (value) values (?)').run(1);
  const row = db.prepare('select value from smoke_test limit 1').get();
  if (!row || row.value !== 1) {
    throw new Error('better-sqlite3 query smoke returned an unexpected result');
  }
  console.log(JSON.stringify({
    node: process.version,
    modulesAbi: process.versions.modules,
    betterSqlite3: 'ok',
  }));
} finally {
  db.close();
}
`;

console.log(`Build Node: ${process.version} (ABI ${process.versions.modules})`);
console.log(`Staged Node: ${stagedNode}`);
execFileSync(stagedNode, ["-e", probe], {
  cwd: serverRoot,
  stdio: "inherit",
  windowsHide: true,
});
console.log("Staged server native runtime smoke passed.");
