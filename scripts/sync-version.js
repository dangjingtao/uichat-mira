
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

const rootPkgPath = path.join(rootDir, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
const version = rootPkg.version;

console.log(`Syncing version ${version} to all packages...`);

const packages = [
  path.join(rootDir, 'apps', 'desktop', 'package.json'),
  path.join(rootDir, 'apps', 'server', 'package.json')
];

packages.forEach(pkgPath => {
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Updated ${pkgPath}`);
  }
});

console.log('Version sync complete!');

