const SHANGHAI_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/;

function shanghaiDateTime(date, time) {
  return new Date(`${date}T${time}+08:00`).getTime();
}

export function evaluateDateSemantics(manifest) {
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
  const researchStart = shanghaiDateTime(manifest.publication_date, "06:00:00");
  const researchLock = shanghaiDateTime(manifest.publication_date, "08:30:00");
  if (researchTime < researchStart || researchTime > researchLock) {
    reasons.push("research lock is outside the publication-day 06:00–08:30 final-refresh window");
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
