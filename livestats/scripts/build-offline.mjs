import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function filesIn(folder, prefix = '') {
  const out = [];
  for (const file of await readdir(folder, { withFileTypes: true })) {
    const name = prefix + file.name;
    if (file.isDirectory()) out.push(...await filesIn(`${folder}/${file.name}`, `${name}/`));
    else if (/\.(?:html|js|css|png|jpg|jpeg|webp|svg|ico|ttf|otf|woff2?|webmanifest)$/i.test(name)
      && name !== 'sw.js') out.push(name);
  }
  return out.sort();
}

const files = await filesIn(root);
const hash = createHash('sha256');
for (const name of files) hash.update(name).update(await readFile(`${root}/${name}`));
const version = hash.digest('hex').slice(0, 20);
const template = await readFile(new URL('../web/sw-template.js', import.meta.url), 'utf8');
await writeFile(`${root}/sw.js`, template
  .replace('__CACHE_NAME__', JSON.stringify(`hooplog-shell-${version}`))
  .replace('__ASSETS__', JSON.stringify(files.map((name) => `/${name}`))));
console.log(`Offline release ${version}: ${files.length} app files.`);
