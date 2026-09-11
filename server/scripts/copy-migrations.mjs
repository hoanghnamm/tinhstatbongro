/**
 * `tsc` copies TypeScript and nothing else, so the migrations — which are plain
 * SQL on purpose — have to be carried into `dist` beside the code that reads
 * them. Without this the built server boots, finds an empty directory, applies
 * nothing, and fails on the first query against a table that was never created.
 */
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/migrations', { recursive: true });
await cp('src/migrations', 'dist/migrations', { recursive: true });
console.log('[build] migrations copied');
