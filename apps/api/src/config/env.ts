import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: isProduction
    ? z.string({ required_error: 'DATABASE_URL is required in production' }).min(1)
    : z.string().default('postgresql://postgres:postgrespassword@localhost:5432/solradar'),
  REDIS_URL: isProduction
    ? z.string({ required_error: 'REDIS_URL is required in production' }).min(1)
    : z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16).default('solradar_default_dev_jwt_secret_32char_min'),
  JWT_REFRESH_SECRET: z.string().min(16).default('solradar_default_refresh_secret_32char_min'),
  BILLING_PROVIDER: z.enum(['noop', 'stripe']).default('noop'),
  WEB_BASE_URL: z.string().optional().default('http://localhost:3000'),
  HELIUS_API_KEY: z.string().optional().default(''),
  HELIUS_RPC_URL: z.string().optional().default('https://mainnet.helius-rpc.com'),
  HELIUS_WEBHOOK_SECRET: z.string().optional().default('test_helius_secret'),
  HELIUS_WEBHOOK_ID: z.string().optional().default('4fbc8fb3-863e-47e2-b164-b24afb4ae0a3'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default('dummy_token_dev'),
});

export type Env = z.infer<typeof EnvSchema>;

let parsedEnv: Env;
try {
  parsedEnv = EnvSchema.parse(process.env);
} catch (error) {
  console.error('CRITICAL: Environment validation failed at startup:', error);
  if (process.env.NODE_ENV === 'test') {
    parsedEnv = EnvSchema.parse({});
  } else {
    process.exit(1);
  }
}

export const env = parsedEnv;
