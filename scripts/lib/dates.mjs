const SHANGHAI_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY = 24 * 60 * 60 * 1000;

function dateOnly(value) {
  if (!DATE.test(value)) throw new Error("publication date must use YYYY-MM-DD");
  return new Date(`${value}T00:00:00Z`);
}

function formatDate(value) {
  return value.toISOString().slice(0, 10);
}

export function isoWeekForDate(value) {
  const original = dateOnly(value);
  const weekday = original.getUTCDay() || 7;
  const thursday = new Date(original.getTime() + (4 - weekday) * DAY);
  const weekYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((thursday - yearStart) / DAY) + 1) / 7);
  const start = new Date(original.getTime() - (weekday - 1) * DAY);
  const end = new Date(start.getTime() + 6 * DAY);
  return {
    key: `${weekYear}-W${String(week).padStart(2, "0")}`,
    year: weekYear,
    week,
    start: formatDate(start),
    end: formatDate(end),
  };
}

export function groupIssuesByIsoWeek(issues) {
  const groups = new Map();
  for (const issue of [...issues].sort((a, b) => b.publication_date.localeCompare(a.publication_date))) {
    const week = isoWeekForDate(issue.publication_date);
    if (!groups.has(week.key)) groups.set(week.key, { ...week, issues: [] });
    groups.get(week.key).issues.push(issue);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function shanghaiDateTime(date, time) {
  return new Date(`${date}T${time}+08:00`).getTime();
}

export function researchWindowFor(publicationDate, schedule) {
  if (!schedule) throw new Error("daily schedule is required");
  if (!DATE.test(publicationDate)) throw new Error("publication date must use YYYY-MM-DD");
  for (const [field, value] of [
    ["research_window_start", schedule.research_window_start],
    ["research_lock_deadline", schedule.research_lock_deadline],
    ["historical_research_lock_deadline", schedule.historical_research_lock_deadline],
  ]) {
    if (!TIME.test(value)) throw new Error(`daily schedule ${field} must use HH:MM`);
  }
  if (!DATE.test(schedule.research_lock_deadline_effective_from)) {
    throw new Error("daily schedule research_lock_deadline_effective_from must use YYYY-MM-DD");
  }
  const isAmended = publicationDate >= schedule.research_lock_deadline_effective_from;
  return {
    start: schedule.research_window_start,
    deadline: isAmended ? schedule.research_lock_deadline : schedule.historical_research_lock_deadline,
  };
}

export function evaluateDateSemantics(manifest, schedule) {
  const reasons = [];
  const candidate = manifest.candidate_created_at;
  const research = manifest.research_locked_at;
  const content = manifest.content_locked_at;

  for (const [name, value] of [
    ["research_locked_at", research],
    ["content_locked_at", content],
  ]) {
    if (!SHANGHAI_TIMESTAMP.test(value)) reasons.push(`${name} must use an explicit +08:00 timestamp`);
  }

  if (candidate === null) {
    reasons.push("candidate_created_at is unavailable");
  } else if (!SHANGHAI_TIMESTAMP.test(candidate)) {
    reasons.push("candidate_created_at must use an explicit +08:00 timestamp");
  } else {
    const publicationStart = shanghaiDateTime(manifest.publication_date, "00:00:00");
    const preparationStart = publicationStart - 6 * 60 * 60 * 1000;
    const candidateTime = new Date(candidate).getTime();
    if (candidateTime < preparationStart) reasons.push("candidate was created before the permitted 18:00 next-day preparation window");
  }

  const researchTime = new Date(research).getTime();
  const researchWindow = researchWindowFor(manifest.publication_date, schedule);
  const researchStart = shanghaiDateTime(manifest.publication_date, `${researchWindow.start}:00`);
  const researchLock = shanghaiDateTime(manifest.publication_date, `${researchWindow.deadline}:00`);
  if (researchTime < researchStart || researchTime > researchLock) {
    reasons.push(`research lock is outside the publication-day ${researchWindow.start}–${researchWindow.deadline} final-refresh window`);
  }

  if (new Date(content).getTime() < researchTime) {
    reasons.push("content_locked_at precedes research_locked_at");
  }
  if (content !== manifest.content_lock.locked_at) {
    reasons.push("content_locked_at does not match content_lock.locked_at");
  }

  return {
    production_candidate_valid: reasons.length === 0,
    reasons,
  };
}
