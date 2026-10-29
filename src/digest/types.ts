import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightRead = {
  rows: DigestRow[];
  badLines: number;
  counts: DigestCounts;
};

type Event = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

// Missing file → null (the route turns that into 404). A bad line is counted, never thrown.
export function readNight(runsDir: string, night: string): NightRead | null {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }

  const byJob = new Map<string, Event[]>();
  let badLines = 0;
  const counts: DigestCounts = { ok: 0, retry: 0, fail: 0 };

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const event = parseLine(line);
    if (!event) {
      badLines += 1;
      continue;
    }
    counts[event.status] += 1;
    const list = byJob.get(event.job);
    if (list) list.push(event);
    else byJob.set(event.job, [event]);
  }

  const rows = [...byJob.entries()].map(([job, events]) => toRow(job, events));
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines, counts };
}

function toRow(job: string, events: Event[]): DigestRow {
  const ordered = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) {
    throw new Error(`no events for ${job}`);
  }
  return {
    job,
    owner: last.owner,
    runs: ordered.length,
    retries: ordered.filter((event) => event.status === 'retry').length,
    lastStatus: last.status,
    lastError: last.error,
    firstAt: first.at,
    lastAt: last.at,
  };
}

function parseLine(line: string): Event | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.at !== 'string' || typeof record.job !== 'string') return null;
  if (record.status !== 'ok' && record.status !== 'retry' && record.status !== 'fail') return null;
  if (record.owner !== null && typeof record.owner !== 'string') return null;
  return {
    at: record.at,
    job: record.job,
    status: record.status,
    owner: record.owner,
    error: typeof record.error === 'string' ? record.error : null,
  };
}
