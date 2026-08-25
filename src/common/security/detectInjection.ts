/**
 * Detects SQL/NoSQL injection attempts in a string input.
 * Ported/adapted from the shared e-commerce `detectInjection` middleware.
 *
 * On detection it logs a SECURITY_ALERT (Cairo timezone) via the security logger
 * and blocks the source IP in an in-memory cache (per instance). Returns true when suspicious.
 */
import { securityLogger } from './logger';

const SUSPICIOUS_PATTERNS = [
  /\$ne/i,
  /\$eq/i,
  /\$gt/i,
  /\$lt/i,
  /\$gte/i,
  /\$lte/i,
  /\$in/i,
  /\$nin/i,
  /\$regex/i,
  /\$where/i,
  /\$or/i,
  /\$and/i,
  /--/,
  /;/,
  /drop/i,
  /union/i,
  /select/i,
  /insert/i,
  /update/i,
  /delete/i,
  /sleep\s*\(/i,
  /benchmark\s*\(/i,
];

export function isSuspicious(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return SUSPICIOUS_PATTERNS.some((p) => p.test(value));
}

export async function reportAndBlockIfSuspicious(
  value: unknown,
  ip: string | undefined
): Promise<boolean> {
  if (!isSuspicious(value)) return false;

  securityLogger.warn({
    timestamp: new Date().toISOString(),
    timeZone: 'Africa/Cairo',
    ipAddress: ip ?? 'unknown',
    type: 'SECURITY_ALERT',
    potentialInjection: typeof value === 'string' ? value.slice(0, 200) : value,
    message: 'Possible injection attempt detected',
  });

  if (ip && ip !== 'unknown') {
    // Block lives in the in-memory cache (per instance). No external store.
    setBlockCache(ip, true);
  }
  return true;
}

// In-memory IP blocklist cache. A block is cached durably (30d); lookups are O(1).
interface BlockCacheEntry {
  blocked: boolean;
  exp: number;
}
const blockCache = new Map<string, BlockCacheEntry>();
const BLOCK_POS_TTL = 60 * 60 * 24 * 30 * 1000;

function setBlockCache(ip: string, blocked: boolean) {
  blockCache.set(ip, {
    blocked,
    exp: Date.now() + (blocked ? BLOCK_POS_TTL : 0),
  });
}

export async function isIpBlocked(ip: string | undefined): Promise<number> {
  if (!ip) return 0;
  const hit = blockCache.get(ip);
  if (hit && hit.exp > Date.now()) return hit.blocked ? 1 : 0;
  return 0;
}
