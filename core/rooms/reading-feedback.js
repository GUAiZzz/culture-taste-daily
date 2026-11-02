(() => {
  'use strict';
  // Scheduling is pure and testable. A permitted request is still not evidence
  // that a particular device produced physical feedback.
  function create({ clock = () => performance.now(), verifiedEvents = [] } = {}) {
    const verified = new Set(verifiedEvents), commits = new Map(), boundaries = new Map();
    let last = -Infinity, lastSelection = -Infinity, selectionTimes = [];
    function request(event = 'confirm', detail = {}) {
      const side = detail.side === 'left' ? 'start' : detail.side === 'right' ? 'end' : detail.side;
      const now = clock(), skipped = reason => ({ event, allowed: false, reason });
      if (event === 'boundary.rearm') {
        const state = boundaries.get(side);
        if (state && Number(detail.insidePx) >= 12) state.armed = true;
        return skipped('rearm-only');
      }
      if (['selection.step', 'boundary', 'snap.complete'].includes(event) && !verified.has(event)) return skipped('unverified-event');
      const commit = detail.commitId;
      for (const [key, time] of commits) if (now - time >= 80) commits.delete(key);
      if (commit && commits.has(commit) && now - commits.get(commit) < 80) return skipped('same-commit');
      if (event === 'selection.step') {
        if (Math.abs(Number(detail.velocity) || 0) > 2) return skipped('fast-selection');
        selectionTimes = selectionTimes.filter(time => time > now - 1000);
        if (now - lastSelection < 250 || selectionTimes.length >= 4) return skipped('selection-rate');
      }
      if (event === 'boundary') {
        if (!['start', 'end'].includes(side) || detail.gestureId === undefined || detail.gestureId === null) return skipped('invalid-boundary');
        const state = boundaries.get(side);
        if (state && (state.gestureId === detail.gestureId || !state.armed)) return skipped('boundary-latched');
      }
      if (now - last < 120) return skipped('global-cooldown');
      last = now;
      if (commit) commits.set(commit, now);
      if (event === 'selection.step') { lastSelection = now; selectionTimes.push(now); }
      if (event === 'boundary') boundaries.set(side, { gestureId: detail.gestureId, armed: false });
      return { event, allowed: true, reason: 'eligible-request' };
    }
    return Object.freeze({ request, state: () => ({ lastRequestAt: last, verifiedEvents: [...verified], selectionTimes: [...selectionTimes] }) });
  }
  window.CTFeedbackPolicy = Object.freeze({ create });
})();
