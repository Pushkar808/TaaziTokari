import { orderBusinessDate } from './dates';

// 2026-10-13 at the given IST wall-clock time.
const at = (hhmm: string) => new Date(`2026-10-13T${hhmm}:00+05:30`);

describe('orderBusinessDate', () => {
  it('keeps orders before the cut-off on the same day', () => {
    expect(orderBusinessDate('22:00', at('21:59'))).toBe('2026-10-13');
  });

  it('moves orders at or after the cut-off to the next day', () => {
    expect(orderBusinessDate('22:00', at('22:00'))).toBe('2026-10-14');
    expect(orderBusinessDate('22:00', at('23:59'))).toBe('2026-10-14');
  });

  it('starts a fresh day at midnight', () => {
    expect(orderBusinessDate('22:00', at('00:00'))).toBe('2026-10-13');
  });

  it('follows an admin-changed cut-off', () => {
    expect(orderBusinessDate('18:30', at('19:00'))).toBe('2026-10-14');
  });

  it('rolls over month ends', () => {
    expect(orderBusinessDate('22:00', new Date('2026-10-31T23:00:00+05:30'))).toBe('2026-11-01');
  });
});
