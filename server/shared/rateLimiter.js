/**
 * Rate limiter genérico — usado por relay y local para tomatazo/emoji/sabotage y REST
 */
class RateLimiter {
  constructor() {
    this.last = new Map(); // key -> timestamp
  }
  canAct(key, cooldownMs) {
    const now = Date.now();
    const last = this.last.get(key) || 0;
    if (now - last < cooldownMs) return false;
    this.last.set(key, now);
    return true;
  }
  clear(key) { this.last.delete(key); }
  clearAll() { this.last.clear(); }
}

class IpRateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.counts = new Map(); // ip -> count
  }
  hit(ip) {
    const c = (this.counts.get(ip) || 0) + 1;
    this.counts.set(ip, c);
    setTimeout(() => {
      const cur = this.counts.get(ip);
      if (cur) {
        if (cur <= 1) this.counts.delete(ip);
        else this.counts.set(ip, cur - 1);
      }
    }, this.windowMs);
    if (this.counts.get(ip) > this.limit) return false;
    return true;
  }
}

module.exports = { RateLimiter, IpRateLimiter };
