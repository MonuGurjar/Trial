
/**
 * Sliding-window rate limiter using Upstash Redis.
 * Each call increments a counter for `identifier` and checks against `limit`.
 * The window auto-expires via Redis TTL.
 */

async function upstashIncr(key: string, windowSeconds: number): Promise<number> {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        // If rate limiting is not configured, allow the request (fail open)
        console.warn('Rate limit: KV not configured, skipping');
        return 0;
    }

    // Use INCR + EXPIRE pipeline
    // Pipeline: [["INCR", key], ["EXPIRE", key, windowSeconds]]
    const pipeline = [
        ['INCR', key],
        ['EXPIRE', key, windowSeconds],
    ];

    const response = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipeline),
    });

    if (!response.ok) {
        console.warn('Rate limit: Upstash pipeline failed');
        return 0; // Fail open
    }

    const results = await response.json();
    // results is array of { result: number } from INCR and EXPIRE
    const count = results?.[0]?.result || 0;
    return count;
}

export interface RateLimitResult {
    allowed: boolean;
    current: number;
    limit: number;
}

/**
 * Check rate limit for a given identifier.
 * @param identifier — unique key (e.g. "login:192.168.1.1" or "ai:user123")
 * @param limit — max requests in the window
 * @param windowSeconds — window duration
 */
export async function checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;
    const current = await upstashIncr(key, windowSeconds);

    return {
        allowed: current <= limit,
        current,
        limit,
    };
}

// --- Pre-configured limiters ---

export function getClientIP(request: Request): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

export function getClientIPNode(req: any): string {
    return (
        req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers?.['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'unknown'
    );
}

/** Login: 5 attempts per minute per IP */
export async function loginLimiter(ip: string): Promise<RateLimitResult> {
    return checkRateLimit(`login:${ip}`, 5, 60);
}

/** Register: 3 attempts per minute per IP */
export async function registerLimiter(ip: string): Promise<RateLimitResult> {
    return checkRateLimit(`register:${ip}`, 3, 60);
}

/** AI: 20 requests per minute per user */
export async function aiLimiter(userId: string): Promise<RateLimitResult> {
    return checkRateLimit(`ai:${userId}`, 20, 60);
}

/** Email: 5 sends per minute per user */
export async function emailLimiter(userId: string): Promise<RateLimitResult> {
    return checkRateLimit(`email:${userId}`, 5, 60);
}
