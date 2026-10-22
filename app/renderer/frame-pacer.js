// Phase-preserving RAF gate. Never spin/catch up after a missed display frame.
// Animation dt remains the real elapsed time, not the ideal deadline.
const PulseFramePacer = (() => {
  function create() {
    let next = null, previousGap = -1, previousNow = null;
    return {
      reset() { next = previousNow = null; previousGap = -1; },
      due(now, gap = 0) {
        gap = Number.isFinite(gap) ? Math.max(0, gap) : 0;
        if (!Number.isFinite(now)) return false;
        const restart = next === null || gap !== previousGap || previousNow === null || now < previousNow || now - previousNow > 1000;
        previousNow = now; previousGap = gap;
        if (!gap) { next = now; return true; }
        if (restart) { next = now + gap; return true; }
        // Only sub-millisecond timestamp noise; no fixed 2 ms FPS overshoot.
        const epsilon = Math.min(0.1, gap * 0.005);
        if (now + epsilon < next) return false;
        next += Math.max(1, Math.floor((now + epsilon - next) / gap) + 1) * gap;
        return true;
      }
    };
  }
  return { create };
})();
