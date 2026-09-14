// Dependency-free pure utilities (importable in plain-node unit tests).
// guard.js re-exports these; routes keep importing from guard.js.

// Sliding-window limiter state lives here so both app and tests share semantics.
const buckets = new Map();
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const seen = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (seen.length >= limit) {
    buckets.set(key, seen);
    return false;
  }
  seen.push(now);
  buckets.set(key, seen);
  return true;
}
export function _resetRateLimits() {
  buckets.clear();
}

// Capability bands: system-computed from verified-work levels. Bands describe,
// reviewers verify — a band is never proof by itself.
export function capabilityBand(level) {
  const l = Number(level) || 0;
  if (l <= 0) return "UNRATED";
  if (l < 25) return "FOUNDATIONAL";
  if (l < 50) return "WORKING";
  if (l < 75) return "INDEPENDENT";
  if (l < 90) return "ADVANCED";
  return "EXPERT";
}
