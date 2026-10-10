// Calendar helpers in Singapore time, where allowances reset. No imports, so any module can use them.

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Start of the current calendar month in Singapore time, as an ISO timestamp. */
export function monthStartSgt(d = new Date()): string {
  const sg = new Date(d.getTime() + SGT_OFFSET_MS);
  return new Date(Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), 1) - SGT_OFFSET_MS).toISOString();
}

/** Today's date (YYYY-MM-DD) in Singapore time. */
export function todaySgt(d = new Date()): string {
  return new Date(d.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}
