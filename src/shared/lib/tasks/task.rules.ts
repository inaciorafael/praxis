export function todayLocalDate() {
  return localDateFromOffset(0);
}

export function tomorrowLocalDate() {
  return localDateFromOffset(1);
}

export function localDateFromOffset(days: number) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}
