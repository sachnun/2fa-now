const requests = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // 100 requests per window

export function rateLimit(ip: string): { success: boolean; resetTime?: number } {
  const now = Date.now();
  const record = requests.get(ip);

  if (!record || now > record.resetTime) {
    requests.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return { success: true };
  }

  if (record.count >= MAX_REQUESTS) {
    return { success: false, resetTime: record.resetTime };
  }

  record.count++;
  return { success: true };
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIP || "unknown";
  return ip;
}