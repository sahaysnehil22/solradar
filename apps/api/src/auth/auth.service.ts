import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PlanCode } from '@solradar/shared';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../observability/index.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  telegramId: string | null;
  role: 'user' | 'admin' | string;
  plan: PlanCode | string;
  status: 'active' | 'suspended' | string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  plan: PlanCode;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export class AuthService {
  private activeRefreshTokenFamilies = new Map<string, { userId: string; familyId: string; validTokens: Set<string> }>();

  async hashPassword(password: string): Promise<string> {
    const rounds = env.NODE_ENV === 'test' ? 4 : 10;
    return bcrypt.hash(password, rounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateTokens(user: UserRecord, familyId?: string): AuthTokens {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: (user.role as 'user' | 'admin') || 'user',
      plan: (user.plan as PlanCode) || PlanCode.FREE,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
    const currentFamilyId = familyId || `fam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tokenId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { userId: user.id, familyId: currentFamilyId, tokenId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    let fam = this.activeRefreshTokenFamilies.get(currentFamilyId);
    if (!fam) {
      fam = { userId: user.id, familyId: currentFamilyId, validTokens: new Set() };
      this.activeRefreshTokenFamilies.set(currentFamilyId, fam);
    }
    fam.validTokens.add(refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: 900, // 15 mins
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  }

  async rotateRefreshToken(oldRefreshToken: string): Promise<AuthTokens> {
    let decoded: { userId: string; familyId: string };
    try {
      decoded = jwt.verify(oldRefreshToken, env.JWT_REFRESH_SECRET) as any;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const family = this.activeRefreshTokenFamilies.get(decoded.familyId);
    if (!family || !family.validTokens.has(oldRefreshToken)) {
      // Reuse attack detected! Revoke the entire family immediately!
      if (family) {
        this.activeRefreshTokenFamilies.delete(decoded.familyId);
        logger.warn('Refresh token reuse detected. Revoked token family.', {
          userId: decoded.userId,
          familyId: decoded.familyId,
        });
      }
      throw new Error('Refresh token reuse detected. Please log in again.');
    }

    // Invalidate the used token
    family.validTokens.delete(oldRefreshToken);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw new Error('User not found');
    }

    return this.generateTokens(user as any, decoded.familyId);
  }

  /**
   * Validates Telegram initData per Telegram bot authentication specifications:
   * Uses HMAC-SHA256 with secret_key = HMAC_SHA256("WebAppData", botToken)
   */
  validateTelegramInitData(initData: string, botToken = env.TELEGRAM_BOT_TOKEN): { isValid: boolean; user?: any } {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      if (!hash) return { isValid: false };

      urlParams.delete('hash');
      const paramsArray: string[] = [];
      urlParams.forEach((value, key) => {
        paramsArray.push(`${key}=${value}`);
      });
      paramsArray.sort();
      const dataCheckString = paramsArray.join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (calculatedHash !== hash) {
        return { isValid: false };
      }

      const userJson = urlParams.get('user');
      const parsedUser = userJson ? JSON.parse(userJson) : undefined;
      return { isValid: true, user: parsedUser };
    } catch {
      return { isValid: false };
    }
  }
}

export const authService = new AuthService();
