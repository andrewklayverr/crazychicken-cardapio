export const STORE_TIME_ZONE = "America/Sao_Paulo";

export const weekDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type WeekDay = typeof weekDays[number];
export type ScheduleInterval = { open: string; close: string };
export type WeeklySchedule = Record<WeekDay, ScheduleInterval[]>;
export type OrderingMode = "automatic" | "open" | "closed";

export const emptyWeeklySchedule = (): WeeklySchedule => ({ sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] });

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export function normalizeOrderingMode(value: unknown): OrderingMode {
  return value === "automatic" || value === "closed" ? value : "open";
}

export function normalizeWeeklySchedule(value: unknown): WeeklySchedule {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const schedule = emptyWeeklySchedule();
  for (const day of weekDays) {
    const rawIntervals = Array.isArray(input[day]) ? input[day] as unknown[] : [];
    if (rawIntervals.length > 6) throw new Error(`Muitos intervalos configurados para ${day}.`);
    schedule[day] = rawIntervals.map((raw) => {
      const interval = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const open = String(interval.open ?? "");
      const close = String(interval.close ?? "");
      if (!timePattern.test(open) || !timePattern.test(close) || open === close) throw new Error("Confira os horários de funcionamento.");
      return { open, close };
    });
    const expanded = schedule[day].map((interval) => {
      const start = minutes(interval.open); const end = minutes(interval.close);
      return [start, end > start ? end : end + 1440] as const;
    }).sort((a, b) => a[0] - b[0]);
    for (let index = 1; index < expanded.length; index += 1) {
      if (expanded[index][0] < expanded[index - 1][1]) throw new Error("Existem horários sobrepostos no mesmo dia.");
    }
  }
  for (let index = 0; index < weekDays.length; index += 1) {
    const overnightEnds = schedule[weekDays[index]].filter((interval) => minutes(interval.open) > minutes(interval.close)).map((interval) => minutes(interval.close));
    const nextDayStarts = schedule[weekDays[(index + 1) % weekDays.length]].map((interval) => minutes(interval.open));
    if (overnightEnds.some((end) => nextDayStarts.some((start) => start < end))) throw new Error("Existem horários sobrepostos entre dias consecutivos.");
  }
  return schedule;
}

export function parseWeeklySchedule(value: string | WeeklySchedule | null | undefined): WeeklySchedule {
  try { return normalizeWeeklySchedule(typeof value === "string" ? JSON.parse(value) : value); }
  catch { return emptyWeeklySchedule(); }
}

function zonedParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: STORE_TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { dayIndex: Math.max(0, dayIndex), minuteOfDay: hour * 60 + minute };
}

const dayLabels = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function getStoreAvailability(input: { orderingMode?: unknown; weeklySchedule?: WeeklySchedule | string | null }, now = new Date()) {
  const mode = normalizeOrderingMode(input.orderingMode);
  if (mode === "open") return { isOpen: true, mode, message: "Aberto para pedidos" };
  if (mode === "closed") return { isOpen: false, mode, message: "Fechado temporariamente" };

  const schedule = parseWeeklySchedule(input.weeklySchedule);
  const { dayIndex, minuteOfDay } = zonedParts(now);
  const today = schedule[weekDays[dayIndex]];
  const previous = schedule[weekDays[(dayIndex + 6) % 7]];
  const openToday = today.some((interval) => {
    const start = minutes(interval.open); const end = minutes(interval.close);
    return start < end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start;
  });
  const openFromYesterday = previous.some((interval) => minutes(interval.open) > minutes(interval.close) && minuteOfDay < minutes(interval.close));
  if (openToday || openFromYesterday) return { isOpen: true, mode, message: "Aberto agora" };

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDay = (dayIndex + offset) % 7;
    const openings = schedule[weekDays[candidateDay]].map((interval) => ({ value: interval.open, minute: minutes(interval.open) })).sort((a, b) => a.minute - b.minute);
    const opening = openings.find((item) => offset > 0 || item.minute > minuteOfDay);
    if (opening) {
      const when = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : dayLabels[candidateDay];
      return { isOpen: false, mode, message: `Fechado · abre ${when} às ${opening.value}` };
    }
  }
  return { isOpen: false, mode, message: "Fechado · horários indisponíveis" };
}
