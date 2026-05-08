import { DateTime } from "luxon";

/** Pakistan timezone — reporting periods align to operator shifts, not calendar midnight. */
export const PKT_ZONE = "Asia/Karachi";

/**
 * One reporting "day" for daily tabs:
 * - Night shift: 18:00 → next calendar day 07:00 (crosses midnight).
 * - Day shift: 07:00 → 18:00 same calendar day.
 */
export function getPktShiftDailyWindow(
  now: DateTime = DateTime.now().setZone(PKT_ZONE),
): { start: DateTime; end: DateTime } {
  const z = now.setZone(PKT_ZONE);
  const minuteOfDay =
    z.hour * 60 +
    z.minute +
    z.second / 60 +
    z.millisecond / 60000;
  const T18 = 18 * 60;
  const T7 = 7 * 60;

  if (minuteOfDay >= T18 || minuteOfDay < T7) {
    if (minuteOfDay >= T18) {
      const start = z.set({
        hour: 18,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      const end = start
        .plus({ days: 1 })
        .set({ hour: 7, minute: 0, second: 0, millisecond: 0 });
      return { start, end };
    }
    const end = z.set({ hour: 7, minute: 0, second: 0, millisecond: 0 });
    const start = end
      .minus({ days: 1 })
      .set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
    return { start, end };
  }

  const start = z.set({ hour: 7, minute: 0, second: 0, millisecond: 0 });
  const end = z.set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
  return { start, end };
}

/** Monday 07:00 PKT through end of Sunday (moment before next Monday 07:00). */
export function getPktWeeklyShiftWindow(
  now: DateTime = DateTime.now().setZone(PKT_ZONE),
): { start: DateTime; end: DateTime } {
  const z = now.setZone(PKT_ZONE);
  const monday = z.startOf("week");
  const start = monday.set({
    hour: 7,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const end = start.plus({ weeks: 1 }).minus({ milliseconds: 1 });
  return { start, end };
}

/** From 1st of month 07:00 PKT until moment before 1st of next month 07:00. */
export function getPktMonthlyShiftWindow(
  now: DateTime = DateTime.now().setZone(PKT_ZONE),
): { start: DateTime; end: DateTime } {
  const z = now.setZone(PKT_ZONE);
  const start = z.startOf("month").set({
    hour: 7,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const end = start.plus({ months: 1 }).minus({ milliseconds: 1 });
  return { start, end };
}
