import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCronRruleSchedule,
  normaliseScheduleOptions
} from '../../src/tools/cron-rrule-builder.js';

test('builds weekly cron, RRULE and human readable output', () => {
  const result = buildCronRruleSchedule({
    frequency: 'weekly',
    interval: 1,
    hour: 9,
    minute: 30,
    weekdays: ['MO', 'WE'],
    timezone: 'Europe/Dublin',
    startDate: '2026-05-29'
  });

  assert.equal(result.cron, '30 9 * * 1,3');
  assert.match(result.rrule, /DTSTART;TZID=Europe\/Dublin:20260529T093000/);
  assert.match(result.rrule, /RRULE:FREQ=WEEKLY;INTERVAL=1;BYMINUTE=30;BYHOUR=9;BYDAY=MO,WE/);
  assert.match(result.humanReadable, /Monday and Wednesday/);
  assert.match(result.output, /## Cron \/ RRULE Schedule/);
  assert.match(result.output, /```cron\n30 9 \* \* 1,3\n```/);
  assert.match(result.warnings.join('\n'), /Cron does not encode timezone/);
  assert.match(result.warnings.join('\n'), /daylight saving time/);
});

test('builds minutely, hourly, daily and monthly schedules', () => {
  const minutely = buildCronRruleSchedule({
    frequency: 'minutely',
    interval: 1,
    timezone: '',
    startDate: '2026-05-29'
  });
  const hourly = buildCronRruleSchedule({
    frequency: 'hourly',
    interval: 2,
    minute: 5,
    timezone: 'UTC',
    startDate: '2026-05-29'
  });
  const daily = buildCronRruleSchedule({
    frequency: 'daily',
    hour: 8,
    minute: 15,
    timezone: 'UTC',
    startDate: '2026-05-29'
  });
  const monthly = buildCronRruleSchedule({
    frequency: 'monthly',
    hour: 21,
    minute: 45,
    monthDay: 31,
    timezone: 'Europe/Dublin',
    startDate: '2026-05-29'
  });

  assert.equal(minutely.cron, '*/1 * * * *');
  assert.match(minutely.warnings.join('\n'), /No timezone was provided/);
  assert.match(minutely.warnings.join('\n'), /Very frequent schedules/);
  assert.equal(hourly.cron, '5 */2 * * *');
  assert.match(hourly.rrule, /FREQ=HOURLY;INTERVAL=2;BYMINUTE=5/);
  assert.equal(daily.cron, '15 8 * * *');
  assert.match(daily.rrule, /FREQ=DAILY;INTERVAL=1;BYMINUTE=15;BYHOUR=8/);
  assert.equal(monthly.cron, '45 21 31 * *');
  assert.match(monthly.rrule, /BYMONTHDAY=31/);
  assert.match(monthly.warnings.join('\n'), /does not exist in every month/);
});

test('reports schedule validation errors and weekly cron interval warning', () => {
  assert.throws(() => normaliseScheduleOptions({
    frequency: 'weekly',
    weekdays: []
  }), /Choose at least one weekday/);
  assert.throws(() => normaliseScheduleOptions({
    minute: 60
  }), /Minute must be a whole number/);
  assert.throws(() => normaliseScheduleOptions({
    startDate: '2026-02-31'
  }), /real calendar date/);

  const result = buildCronRruleSchedule({
    frequency: 'weekly',
    interval: 2,
    weekdays: ['FR'],
    timezone: 'UTC',
    startDate: '2026-05-29'
  });

  assert.match(result.warnings.join('\n'), /cannot represent every N weeks/);
});
