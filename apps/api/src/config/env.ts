import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/solradar'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16).default('solradar_default_dev_jwt_secret_32char_min'),
  JWT_REFRESH_SECRET: z.string().min(16).default('solradar_default_refresh_secret_32char_min'),
  BILLING_PROVIDER: z.enum(['noop', 'stripe']).default('noop'),
  HELIUS_WEBHOOK_SECRET: z.string().optional().default('test_helius_secret'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default('dummy_token_dev'),
});

export type Env = z.infer<typeof EnvSchema>;

let parsedEnv: Env;
try {
  parsedEnv = EnvSchema.parse(process.env);
} catch (error) {
  console.error('CRITICAL: Environment validation failed at startup:', error);
  // Default to safe development values if running in test environment
  if (process.env.NODE_ENV === 'test') {
    parsedEnv = EnvSchema.parse({});
  } else {
    process.exit(1);
  }
}

export const env = parsedEnv;
