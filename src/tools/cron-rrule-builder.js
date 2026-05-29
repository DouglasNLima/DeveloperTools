import { formatByteSize } from './json-formatter.js';

export const SCHEDULE_FREQUENCIES = [
  { value: 'minutely', label: 'Minutely' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

export const WEEKDAYS = [
  { value: 'MO', cron: '1', label: 'Monday' },
  { value: 'TU', cron: '2', label: 'Tuesday' },
  { value: 'WE', cron: '3', label: 'Wednesday' },
  { value: 'TH', cron: '4', label: 'Thursday' },
  { value: 'FR', cron: '5', label: 'Friday' },
  { value: 'SA', cron: '6', label: 'Saturday' },
  { value: 'SU', cron: '0', label: 'Sunday' }
];

const FREQUENCY_VALUES = new Set(SCHEDULE_FREQUENCIES.map(frequency => frequency.value));
const WEEKDAY_BY_VALUE = new Map(WEEKDAYS.map(day => [day.value, day]));

export function buildCronRruleSchedule(options = {}) {
  const schedule = normaliseScheduleOptions(options);
  const cron = buildCronExpression(schedule);
  const rrule = buildRrule(schedule);
  const humanReadable = buildHumanReadableSchedule(schedule);
  const warnings = buildScheduleWarnings(schedule);
  const output = buildScheduleMarkdown({
    cron,
    rrule,
    humanReadable,
    warnings,
    schedule
  });
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    cron,
    rrule,
    humanReadable,
    warnings,
    output,
    outputBytes,
    outputSizeLabel: formatByteSize(outputBytes),
    frequency: schedule.frequency,
    frequencyLabel: SCHEDULE_FREQUENCIES.find(item => item.value === schedule.frequency).label
  };
}

export function normaliseScheduleOptions(options = {}) {
  const frequency = FREQUENCY_VALUES.has(options.frequency) ? options.frequency : 'daily';
  const interval = normaliseInteger(options.interval, 'Interval', 1, 99, 1);
  const minute = normaliseInteger(options.minute, 'Minute', 0, 59, 0);
  const hour = normaliseInteger(options.hour, 'Hour', 0, 23, 9);
  const monthDay = normaliseInteger(options.monthDay, 'Month day', 1, 31, 1);
  const timezone = String(options.timezone ?? '').trim();
  const startDate = normaliseStartDate(options.startDate);
  const weekdays = normaliseWeekdays(options.weekdays);

  if (frequency === 'weekly' && weekdays.length === 0) {
    throw new Error('Choose at least one weekday for a weekly schedule.');
  }

  return {
    frequency,
    interval,
    minute,
    hour,
    monthDay,
    timezone,
    startDate,
    weekdays
  };
}

export function buildCronExpression(schedule) {
  if (schedule.frequency === 'minutely') {
    return `*/${schedule.interval} * * * *`;
  }

  if (schedule.frequency === 'hourly') {
    return `${schedule.minute} ${schedule.interval === 1 ? '*' : `*/${schedule.interval}`} * * *`;
  }

  if (schedule.frequency === 'daily') {
    return `${schedule.minute} ${schedule.hour} ${schedule.interval === 1 ? '*' : `*/${schedule.interval}`} * *`;
  }

  if (schedule.frequency === 'weekly') {
    const weekdays = schedule.weekdays.map(day => WEEKDAY_BY_VALUE.get(day).cron).join(',');
    return `${schedule.minute} ${schedule.hour} * * ${weekdays}`;
  }

  return `${schedule.minute} ${schedule.hour} ${schedule.monthDay} ${schedule.interval === 1 ? '*' : `*/${schedule.interval}`} *`;
}

export function buildRrule(schedule) {
  const parts = [
    `FREQ=${schedule.frequency.toLocaleUpperCase('en-GB')}`,
    `INTERVAL=${schedule.interval}`
  ];

  if (schedule.frequency !== 'minutely') {
    parts.push(`BYMINUTE=${schedule.minute}`);
  }

  if (['daily', 'weekly', 'monthly'].includes(schedule.frequency)) {
    parts.push(`BYHOUR=${schedule.hour}`);
  }

  if (schedule.frequency === 'weekly') {
    parts.push(`BYDAY=${schedule.weekdays.join(',')}`);
  }

  if (schedule.frequency === 'monthly') {
    parts.push(`BYMONTHDAY=${schedule.monthDay}`);
  }

  const dateTime = `${formatDateForRrule(schedule.startDate)}T${pad(schedule.hour)}${pad(schedule.minute)}00`;
  const start = schedule.timezone
    ? `DTSTART;TZID=${schedule.timezone}:${dateTime}`
    : `DTSTART:${dateTime}`;

  return `${start}\nRRULE:${parts.join(';')}`;
}

export function buildHumanReadableSchedule(schedule) {
  if (schedule.frequency === 'minutely') {
    return `Every ${pluralise(schedule.interval, 'minute')}.`;
  }

  const time = `${pad(schedule.hour)}:${pad(schedule.minute)}`;
  const timezone = schedule.timezone || 'the scheduler timezone';

  if (schedule.frequency === 'hourly') {
    return `Every ${pluralise(schedule.interval, 'hour')} at minute ${pad(schedule.minute)} in ${timezone}.`;
  }

  if (schedule.frequency === 'daily') {
    return `Every ${pluralise(schedule.interval, 'day')} at ${time} in ${timezone}.`;
  }

  if (schedule.frequency === 'weekly') {
    const days = joinHumanList(schedule.weekdays.map(day => WEEKDAY_BY_VALUE.get(day).label));
    return `Every ${pluralise(schedule.interval, 'week')} on ${days} at ${time} in ${timezone}.`;
  }

  return `Every ${pluralise(schedule.interval, 'month')} on day ${schedule.monthDay} at ${time} in ${timezone}.`;
}

export function buildScheduleWarnings(schedule) {
  const warnings = [];

  if (!schedule.timezone) {
    warnings.push('No timezone was provided; cron itself does not carry timezone information.');
  } else {
    warnings.push(`Cron does not encode timezone; configure ${schedule.timezone} in the scheduler.`);
  }

  if (schedule.timezone && schedule.timezone.toLocaleUpperCase('en-GB') !== 'UTC' && schedule.frequency !== 'minutely') {
    warnings.push(`Schedules in ${schedule.timezone} can shift around daylight saving time; confirm the scheduler's timezone handling.`);
  }

  if (schedule.frequency === 'minutely' && schedule.interval < 5) {
    warnings.push('Very frequent schedules can be expensive or rate-limited by some schedulers.');
  }

  if (schedule.frequency === 'monthly' && schedule.monthDay > 28) {
    warnings.push('This month day does not exist in every month; confirm how missed runs should be handled.');
  }

  if (schedule.frequency === 'weekly' && schedule.interval > 1) {
    warnings.push('A 5-field cron expression cannot represent every N weeks; use the RRULE for that interval.');
  }

  return warnings;
}

export function buildScheduleMarkdown(result) {
  const warnings = result.warnings.length === 0
    ? ['- None']
    : result.warnings.map(warning => `- ${warning}`);

  return [
    '## Cron / RRULE Schedule',
    '',
    '### Cron',
    '```cron',
    result.cron,
    '```',
    '',
    '### RRULE',
    '```text',
    result.rrule,
    '```',
    '',
    '### Human Readable Schedule',
    result.humanReadable,
    '',
    '### Warnings',
    ...warnings
  ].join('\n');
}

function normaliseInteger(value, label, min, max, fallback) {
  const rawValue = value === undefined || value === null || String(value).trim() === ''
    ? fallback
    : Number(value);

  if (!Number.isInteger(rawValue) || rawValue < min || rawValue > max) {
    throw new Error(`${label} must be a whole number between ${min.toLocaleString('en-GB')} and ${max.toLocaleString('en-GB')}.`);
  }

  return rawValue;
}

function normaliseWeekdays(value) {
  const rawValues = Array.isArray(value) ? value : String(value ?? '').split(',');
  const weekdays = rawValues
    .map(item => String(item ?? '').trim().toLocaleUpperCase('en-GB'))
    .filter(Boolean);

  return [...new Set(weekdays)].filter(day => WEEKDAY_BY_VALUE.has(day));
}

function normaliseStartDate(value) {
  const input = String(value ?? '').trim();

  if (!input) {
    return new Date().toISOString().slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error('Start date must use YYYY-MM-DD format.');
  }

  const date = new Date(`${input}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new Error('Start date must be a real calendar date.');
  }

  return input;
}

function formatDateForRrule(date) {
  return date.replace(/-/g, '');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function pluralise(value, singular) {
  return `${value.toLocaleString('en-GB')} ${singular}${value === 1 ? '' : 's'}`;
}

function joinHumanList(items) {
  if (items.length <= 1) {
    return items[0] || '';
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
