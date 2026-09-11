import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DARK } from '../theme/tokens';

const root = resolve(__dirname, '..') + '/';
async function main() {
  await mkdir(`${root}public/icons`, { recursive: true });
  // Keep the app's current 1024px icon unchanged on web as well.
  await copyFile(`${root}assets/icon.png`, `${root}public/icons/icon.png`);
  const template = await readFile(`${root}web/index.html`, 'utf8');
  await writeFile(`${root}public/index.html`, template.replaceAll('__HOOPLOG_BG__', DARK.bg));
  await writeFile(`${root}public/manifest.webmanifest`, JSON.stringify({
    id: '/',
    name: 'HoopRec',
    short_name: 'HoopRec',
    description: 'Keep basketball stats for your team, courtside.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: DARK.bg,
    theme_color: DARK.bg,
    icons: [{
      src: '/icons/icon.png',
      sizes: '1024x1024',
      type: 'image/png',
      purpose: 'any',
    }],
  }, null, 2) + '\n');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
