import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

// Parse one line at the edge; anything off-shape is a bad line, never an exception.
export function parseLine(line: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status as RunStatus)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const parsed: RunLine = { at, job, status: status as RunStatus, owner };
  if (error !== undefined) parsed.error = error;
  return parsed;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return aggregate(night, text);
};

export function aggregate(night: string, text: string): Night {
  const byJob = new Map<string, { row: DigestRow; first: number; last: number }>();
  let badLines = 0;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const run = parseLine(line);
    if (!run) {
      badLines++;
      continue;
    }
    const t = Date.parse(run.at);
    const seen = byJob.get(run.job);
    if (!seen) {
      byJob.set(run.job, {
        row: {
          job: run.job,
          owner: run.owner,
          runs: 1,
          retries: run.status === 'retry' ? 1 : 0,
          lastStatus: run.status,
          lastError: run.error ?? null,
          firstAt: run.at,
          lastAt: run.at,
        },
        first: t,
        last: t,
      });
      continue;
    }
    const { row } = seen;
    row.runs++;
    if (run.status === 'retry') row.retries++;
    if (t < seen.first) {
      seen.first = t;
      row.firstAt = run.at;
    }
    // Ties go to the later line in the file.
    if (t >= seen.last) {
      seen.last = t;
      row.lastAt = run.at;
      row.lastStatus = run.status;
      row.lastError = run.error ?? null;
      if (run.owner !== null) row.owner = run.owner;
    }
    if (row.owner === null && run.owner !== null) row.owner = run.owner;
  }

  const rows = [...byJob.values()]
    .map((s) => s.row)
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}
