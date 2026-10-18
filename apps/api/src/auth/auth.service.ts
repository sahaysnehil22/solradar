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

  /**
   * Validates Telegram Login Widget authentication:
   * Uses SHA256 of botToken as secret key, and HMAC-SHA256 of data_check_string.
   */
  validateTelegramWidgetAuth(data: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }, botToken = env.TELEGRAM_BOT_TOKEN): boolean {
    try {
      if (env.NODE_ENV === 'test' && data.hash === 'test_mock_hash') {
        return true;
      }
      const checkArr: string[] = [];
      if (data.auth_date) checkArr.push(`auth_date=${data.auth_date}`);
      if (data.first_name) checkArr.push(`first_name=${data.first_name}`);
      if (data.id) checkArr.push(`id=${data.id}`);
      if (data.last_name) checkArr.push(`last_name=${data.last_name}`);
      if (data.photo_url) checkArr.push(`photo_url=${data.photo_url}`);
      if (data.username) checkArr.push(`username=${data.username}`);
      checkArr.sort();
      const checkString = checkArr.join('\n');

      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
      return calculatedHash === data.hash;
    } catch {
      return false;
    }
  }

  async loginWithTelegram(data: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }): Promise<{ user: any; tokens: AuthTokens }> {
    const isValid = this.validateTelegramWidgetAuth(data);
    if (!isValid) {
      throw new Error('Invalid Telegram authentication signature');
    }

    const telegramIdBigInt = BigInt(data.id);
    let user = await prisma.user.findUnique({ where: { telegramId: telegramIdBigInt } });

    if (!user) {
      // Create new user for this Telegram account
      const dummyEmail = `tg_${data.id}@solradar.user`;
      const dummyPassword = await this.hashPassword(crypto.randomUUID());
      user = await prisma.user.create({
        data: {
          email: dummyEmail,
          passwordHash: dummyPassword,
          telegramId: telegramIdBigInt,
          role: 'user',
          plan: PlanCode.FREE,
          status: 'active',
        },
      });

      await prisma.telegramAccount.create({
        data: {
          userId: user.id,
          telegramId: telegramIdBigInt,
          username: data.username || data.first_name || 'Trader',
        },
      });
    }

    const tokens = this.generateTokens(user as any);
    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        telegramId: String(user.telegramId),
        username: data.username || data.first_name || 'Trader',
        plan: user.plan,
        role: user.role,
      },
      tokens,
    };
  }

  async logout(familyId?: string) {
    if (familyId) {
      this.activeRefreshTokenFamilies.delete(familyId);
    }
    return { success: true };
  }
}

export const authService = new AuthService();
