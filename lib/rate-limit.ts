const requests = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // limit each IP to 100 requests per windowMs
};

export function rateLimit(ip: string): { success: boolean; resetTime?: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;

  // Clean up old entries
  for (const [key, data] of requests.entries()) {
    if (data.resetTime < now) {
      requests.delete(key);
    }
  }

  const existing = requests.get(ip);
  
  if (!existing) {
    requests.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return { success: true };
  }

  if (existing.resetTime < now) {
    // Reset the window
    existing.count = 1;
    existing.resetTime = now + RATE_LIMIT.windowMs;
    return { success: true };
  }

  if (existing.count >= RATE_LIMIT.maxRequests) {
    return { success: false, resetTime: existing.resetTime };
  }

  existing.count++;
  return { success: true };
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIP || "unknown";
  return ip;
}