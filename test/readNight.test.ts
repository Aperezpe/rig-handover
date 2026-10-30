import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/readNight.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted, and counts the 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night!.night).toBe('2026-10-28');
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('aggregates runs, retries, last status and error, keeping offsets', () => {
    const row = (job: string) => night!.rows.find((r) => r.job === job);
    expect(row('lane/sync')).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(row('notes/backup')).toMatchObject({
      owner: 'lane-07',
      runs: 1,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      firstAt: '2026-10-29T04:00:01+01:00',
    });
  });

  it('keeps a row whose owner is null', () => {
    expect(night!.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));

  it('returns null for a night with no file, or a malformed night', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
    expect(readNight(dir, '../etc/passwd')).toBeNull();
  });

  it('reads an empty file as nothing ran', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts off-shape lines as bad without throwing', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00-05:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-03T02:00:00-05:00","job":"a","status":"weird","owner":"x"}',
      '{"at":"not a time","job":"a","status":"ok","owner":"x"}',
      '[1,2]',
      'null',
      '{"at":"2026-01-03T03:00:00-05:00","job":"a","status":"retry","owner":"x","error":"boom"}',
      '',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n'));
    const night = readNight(dir, '2026-01-03');
    expect(night!.badLines).toBe(4);
    expect(night!.rows).toEqual([
      {
        job: 'a',
        owner: 'x',
        runs: 2,
        retries: 1,
        lastStatus: 'retry',
        lastError: 'boom',
        firstAt: '2026-01-03T01:00:00-05:00',
        lastAt: '2026-01-03T03:00:00-05:00',
      },
    ]);
  });
});
