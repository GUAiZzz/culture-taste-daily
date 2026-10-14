export function checkSchedule(policy, rrule) {
  const fields = Object.fromEntries(rrule.replace(/^RRULE:/, '').split(';').map(pair => pair.split('=')));
  const actual = (fields.BYHOUR ?? '').split(',').map(Number).sort((a,b) => a-b);
  const expected = [...policy.schedule.scheduler_hours].sort((a,b) => a-b);
  return fields.FREQ === 'DAILY' && fields.BYMINUTE === '0'
    && JSON.stringify(actual) === JSON.stringify(expected)
    && (!fields.BYSECOND || fields.BYSECOND === '0')
    && !fields.BYDAY && (!fields.INTERVAL || fields.INTERVAL === '1');
}
