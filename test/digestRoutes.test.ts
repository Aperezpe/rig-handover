import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Temp runs dir so the real, read-only runs/ is never touched.
let runsDir: string;

const GOOD = JSON.stringify({ at: '2026-03-01T02:00:00+01:00', job: 'sync', status: 'ok', owner: 'ops' });
const BAD = '{not json';

function config() {
  return { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(runsDir, '2026-03-01.jsonl'), `${GOOD}\n${BAD}\n`);
  writeFileSync(join(runsDir, '2026-03-02.jsonl'), '');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('200 for a night with a file, counting the bad line', async () => {
    const res = await createApp(config()).request('/digest/2026-03-01');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('2026-03-01');
    expect(html).toContain('sync');
  });

  it('200 for the empty night', async () => {
    const res = await createApp(config()).request('/digest/2026-03-02');
    expect(res.status).toBe(200);
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config()).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/digest/:night (temp runs dir)', () => {
  it('200 with the rows and the bad-line count', async () => {
    const res = await createApp(config()).request('/api/digest/2026-03-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(body.night).toBe('2026-03-01');
    expect(body.rows.map((r) => r.job)).toEqual(['sync']);
    expect(body.badLines).toBe(1);
  });

  it('200 with no rows for the empty night', async () => {
    const res = await createApp(config()).request('/api/digest/2026-03-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-03-02', rows: [], badLines: 0 });
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config()).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
  });
});
