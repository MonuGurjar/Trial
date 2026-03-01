
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// --- JWT ---

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    return new TextEncoder().encode(secret);
};

export interface JwtPayload {
    userId: string;
    email: string;
    role: 'student' | 'admin';
    adminRole?: string;
}

export async function signJWT(payload: JwtPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getJwtSecret());
}

export async function verifyJWT(token: string): Promise<JwtPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        return payload as unknown as JwtPayload;
    } catch {
        return null;
    }
}

/**
 * Extract auth payload from Authorization header.
 * Returns null if missing/invalid.
 */
export async function extractAuth(request: Request): Promise<JwtPayload | null> {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    return verifyJWT(token);
}

/**
 * For Node-style (req, res) handlers — extract from req.headers.authorization
 */
export async function extractAuthNode(req: any): Promise<JwtPayload | null> {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    return verifyJWT(token);
}

// --- Password Hashing ---

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

/**
 * Returns null if valid, or an error string describing the problem.
 */
export function validatePasswordStrength(password: string): string | null {
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number';
    }
    return null;
}

// --- Response Helpers ---

export function unauthorized(message = 'Unauthorized') {
    return new Response(JSON.stringify({ error: message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function forbidden(message = 'Forbidden') {
    return new Response(JSON.stringify({ error: message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function tooManyRequests(message = 'Too many requests. Please try again later.') {
    return new Response(JSON.stringify({ error: message }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
    });
}

// Node-style response helpers
export function nodeUnauthorized(res: any, message = 'Unauthorized') {
    return res.status(401).json({ error: message });
}

export function nodeForbidden(res: any, message = 'Forbidden') {
    return res.status(403).json({ error: message });
}

export function nodeTooManyRequests(res: any, message = 'Too many requests. Please try again later.') {
    return res.status(429).json({ error: message });
}
