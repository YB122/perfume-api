import { randomBytes } from 'crypto';

import { User } from '../models/User';
import { signAccessToken, signRefreshToken } from '../lib/jwt';
import { env } from '../config/env';

export interface PublicUser {
  id: string;
  email: string;
  role: string;
  vendorId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function registerCustomer(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<AuthTokens> {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new AuthError(400, 'Email already registered');

  const passwordHash = await Bun.password.hash(input.password, 'bcrypt');
  const user = await User.create({
    email: input.email.toLowerCase(),
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
    role: 'customer',
  });

  return issueTokens(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthTokens> {
  const user = await User.findOne({ email: input.email.toLowerCase(), deletedAt: null });
  if (!user) throw new AuthError(401, 'Invalid credentials');
  const ok = await Bun.password.verify(input.password, user.passwordHash);
  if (!ok) throw new AuthError(401, 'Invalid credentials');
  return issueTokens(user);
}

async function issueTokens(user: {
  _id: any;
  email: string;
  role: string;
  vendorId?: any;
}): Promise<AuthTokens> {
  const payload = {
    sub: user._id.toString(),
    role: user.role as any,
    vendorId: user.vendorId?.toString(),
  };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ]);
  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      vendorId: user.vendorId?.toString(),
    },
  };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const u = await User.findById(id).select('-passwordHash');
  if (!u) return null;
  return {
    id: u._id.toString(),
    email: u.email,
    role: u.role,
    vendorId: u.vendorId?.toString(),
  };
}

// Re-issue a fresh token pair from an already-verified payload (used by /refresh).
export async function issueTokensFromPayload(payload: {
  sub: string;
  role: string;
  vendorId?: string;
}): Promise<AuthTokens> {
  const user = await getUserById(payload.sub);
  if (!user) throw new AuthError(401, 'Unauthorized');
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: payload.sub, role: payload.role as any, vendorId: payload.vendorId }),
    signRefreshToken({ sub: payload.sub, role: payload.role as any, vendorId: payload.vendorId }),
  ]);
  return { accessToken, refreshToken, user };
}

export function hashRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export const JWT_REFRESH_SECRET = env.REFRESH_TOKEN_SECRET ?? env.JWT_SECRET;
