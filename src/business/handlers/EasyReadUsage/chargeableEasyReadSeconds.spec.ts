import { chargeableEasyReadSeconds as charge } from './chargeableEasyReadSeconds';

const MAX = 60;
const chargeableEasyReadSeconds = (s: number, last: Date | null, now: Date) =>
  charge(s, last, now, MAX);

describe('chargeableEasyReadSeconds (max 60s per report)', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000);

  it('charges what was reported on the first report', () => {
    expect(chargeableEasyReadSeconds(15, null, now)).toBe(15);
  });

  it('never charges more than one report allows', () => {
    expect(chargeableEasyReadSeconds(500, null, now)).toBe(60);
  });

  it('ignores negative, zero and non-numeric reports', () => {
    expect(chargeableEasyReadSeconds(-5, null, now)).toBe(0);
    expect(chargeableEasyReadSeconds(0, null, now)).toBe(0);
    expect(chargeableEasyReadSeconds(NaN, null, now)).toBe(0);
  });

  it('caps a report at the time since the last charge, so two tabs do not count double', () => {
    expect(chargeableEasyReadSeconds(15, secondsAgo(5), now)).toBe(6);
  });

  it('charges the full report after a long gap', () => {
    expect(chargeableEasyReadSeconds(15, secondsAgo(3600), now)).toBe(15);
  });
});
