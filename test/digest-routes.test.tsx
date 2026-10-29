import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const base = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRuns(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  dirs.push(dir);
  return dir;
}

describe('digest routes', () => {
  it('renders 200 with jobs in the same order as the JSON', async () => {
    const dir = tempRuns();
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T02:00:00+01:00","job":"zeta","status":"ok","owner":"rook"}',
        '{"at":"2026-10-28T01:00:00+01:00","job":"alpha","status":"fail","owner":null,"error":"quota exceeded"}',
        '{"at":"2026-10-28T01:30:00+01:00","job":"mid","status":"retry","owner":"rook","error":"lock held"}',
        '{"at":"2026-10-28T01:31:00+01:00","job":"mid","status":"retry","owner":"rook","error":"lock held"}',
        '{"at":"2026-10-28T01:32:00+01:00","job":"mid","status":"retry","owner":"rook","error":"lock held"}',
      ].join('\n'),
    );
    const app = createApp({ ...base, runsDir: dir });
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    const html = await page.text();
    const rows = (await json.json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'mid', 'zeta']);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('mid'));
    expect(html.indexOf('mid')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('quota exceeded');
    expect(html).toContain('—');
  });

  it('returns 404 when the night file is missing', async () => {
    const dir = tempRuns();
    const app = createApp({ ...base, runsDir: dir });
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('renders nothing ran for an empty file, and JSON is an empty list', async () => {
    const dir = tempRuns();
    writeFileSync(join(dir, '2026-02-02.jsonl'), '');
    const app = createApp({ ...base, runsDir: dir });
    const page = await app.request('/digest/2026-02-02');
    const json = await app.request('/api/digest/2026-02-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await json.json()).toEqual([]);
  });

  it('still renders a night that contains a bad line', async () => {
    const dir = tempRuns();
    writeFileSync(
      join(dir, '2026-03-03.jsonl'),
      [
        '{"at":"2026-03-03T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
        '{"at":"2026-03-03T05:59:58+01:00","job":"lane/sy',
      ].join('\n'),
    );
    const app = createApp({ ...base, runsDir: dir });
    const page = await app.request('/digest/2026-03-03');
    const json = await app.request('/api/digest/2026-03-03');
    const html = await page.text();
    const rows = (await json.json()) as DigestRow[];
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('1 line not read');
    expect(rows.map((row) => row.job)).toEqual(['lane/sync']);
  });
});

describe('status board nights', () => {
  it('links both nights on disk to a digest that renders', async () => {
    const app = createApp(base);
    const board = await app.request('/');
    const html = await board.text();
    expect(board.status).toBe(200);
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('10 ok · 4 retry · 1 fail');

    const newer = await app.request('/digest/2026-10-28');
    const older = await app.request('/digest/2026-10-27');
    expect(newer.status).toBe(200);
    expect(older.status).toBe(200);
    expect(await newer.text()).toContain('notes/backup');
    expect(await older.text()).toContain('fixtures/refresh');
  });
});
