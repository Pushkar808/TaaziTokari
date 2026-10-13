// The shop works in Indian Standard Time (UTC+5:30, no daylight saving).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in IST as YYYY-MM-DD. */
export const istDate = (now = new Date()): string => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The [start, end) instants of one IST calendar day. */
export const istDayRange = (date: string): { start: Date; end: Date } => {
  const start = new Date(`${date}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/** YYYY-MM-DD -> Date at UTC midnight, the form Prisma uses for @db.Date columns. */
export const dateOnly = (date: string): Date => new Date(`${date}T00:00:00Z`);

/** @db.Date value -> YYYY-MM-DD. */
export const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

export const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** "22:00" cut-off -> minutes after midnight. */
const minutesOf = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * The business day an order belongs to (YYYY-MM-DD, IST): orders placed at or after the
 * zone's cut-off time count for the next day.
 */
export const orderBusinessDate = (cutoffTime: string, now = new Date()): string => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const minutesNow = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const today = ist.toISOString().slice(0, 10);
  if (minutesNow < minutesOf(cutoffTime)) return today;
  return new Date(new Date(`${today}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
};

export const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
