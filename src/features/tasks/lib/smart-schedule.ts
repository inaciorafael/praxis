import dayjs from 'dayjs'

export type SmartSchedulePreset =
  | 'oneHour'
  | 'laterToday'
  | 'tomorrowMorning'
  | 'nextWeek'

export type SmartScheduleValues = {
  dueAt: string
  reminderAt: string
}

const LOCAL_DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm'

export function resolveSmartDueAt(preset: SmartSchedulePreset, now = new Date()) {
  const current = dayjs(now).second(0).millisecond(0)

  if (preset === 'oneHour') {
    return current.add(1, 'hour').format(LOCAL_DATE_TIME_FORMAT)
  }

  if (preset === 'laterToday') {
    const candidate = [12, 15, 18, 21]
      .map((hour) => current.hour(hour).minute(0))
      .find((date) => date.diff(current, 'minute') >= 60)

    return candidate?.format(LOCAL_DATE_TIME_FORMAT) ?? null
  }

  if (preset === 'tomorrowMorning') {
    return current.add(1, 'day').hour(9).minute(0).format(LOCAL_DATE_TIME_FORMAT)
  }

  const daysUntilNextMonday = (8 - current.day()) % 7 || 7
  return current
    .add(daysUntilNextMonday, 'day')
    .hour(9)
    .minute(0)
    .format(LOCAL_DATE_TIME_FORMAT)
}

export function applySmartSchedule(
  current: SmartScheduleValues,
  preset: SmartSchedulePreset,
  now = new Date()
): SmartScheduleValues | null {
  const dueAt = resolveSmartDueAt(preset, now)

  if (!dueAt) {
    return null
  }

  const previousDue = dayjs(current.dueAt)
  const previousReminder = dayjs(current.reminderAt)

  if (
    !current.dueAt ||
    !current.reminderAt ||
    !previousDue.isValid() ||
    !previousReminder.isValid() ||
    !previousReminder.isBefore(previousDue)
  ) {
    return { dueAt, reminderAt: current.reminderAt }
  }

  const targetDue = dayjs(dueAt)
  const reminderLeadMinutes = previousDue.diff(previousReminder, 'minute')
  let nextReminder = targetDue.subtract(reminderLeadMinutes, 'minute')
  const minimumReminder = dayjs(now).add(5, 'minute')

  if (!nextReminder.isAfter(now)) {
    const shortlyBeforeDue = targetDue.subtract(15, 'minute')
    nextReminder = shortlyBeforeDue.isAfter(minimumReminder)
      ? shortlyBeforeDue
      : minimumReminder
  }

  return {
    dueAt,
    reminderAt: nextReminder.isBefore(targetDue)
      ? nextReminder.format(LOCAL_DATE_TIME_FORMAT)
      : current.reminderAt,
  }
}
