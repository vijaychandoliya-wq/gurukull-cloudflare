import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/portal/source');
const read = (path) => readFile(resolve(root, path), 'utf8');

const requiredSourceChecks = [
  ['src/theme/ThemeProvider.tsx', 'dataset.theme'],
  ['src/components/ThemeSwitcher.tsx', 'Appearance'],
  ['src/styles/theme.css', "data-theme='dark'"],
  ['src/App.tsx', 'ThemeProvider'],
  ['src/components/layout/AppLayout.tsx', 'ThemeSwitcher'],
  ['src/pages/LoginPage.tsx', 'ThemeSwitcher'],
];

for (const [path, marker] of requiredSourceChecks) {
  const source = await read(path);
  if (!source.includes(marker)) throw new Error(`Portal theme check failed: ${path} is missing ${marker}`);
}

const app = await read('src/App.tsx');
const pageModules = [...app.matchAll(/from\s+['"]\.\/pages\/([^'"]+)['"]/g)].map((match) => match[1]);
if (pageModules.length === 0) throw new Error('Portal theme check found no routed page imports');
for (const page of pageModules) await read(`src/pages/${page}.tsx`);

const dist = resolve(root, 'dist');
const cssAsset = (await readdir(resolve(dist, 'assets'))).find((file) => file.endsWith('.css'));
if (!cssAsset) throw new Error('Portal theme check found no built CSS asset');
const css = await readFile(resolve(dist, 'assets', cssAsset), 'utf8');
for (const marker of ['data-theme', '--gk-canvas', 'prefers-reduced-motion']) {
  if (!css.includes(marker)) throw new Error(`Portal theme check found no built CSS marker: ${marker}`);
}

console.log(`Cloudflare portal theme validation passed: ${pageModules.length} imported page modules, light/dark tokens and reduced-motion styles present.`);
