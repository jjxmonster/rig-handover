import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl as 5 jobs and 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    const render = night?.rows[0];
    expect(render?.owner).toBeNull();
    expect(render?.runs).toBe(1);
    expect(render?.lastStatus).toBe('ok');

    const refresh = night?.rows[1];
    expect(refresh?.runs).toBe(4);
    expect(refresh?.retries).toBe(3);
    expect(refresh?.lastStatus).toBe('ok');
    expect(refresh?.lastError).toBeNull();

    const sync = night?.rows[2];
    expect(sync?.runs).toBe(8);
    expect(sync?.retries).toBe(1);
    expect(sync?.owner).toBe('rook');
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');

    const backup = night?.rows[3];
    expect(backup?.lastStatus).toBe('fail');
    expect(backup?.lastError).toBe('quota exceeded');
    expect(backup?.owner).toBe('lane-07');

    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('returns null when the night file is missing', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });
});
