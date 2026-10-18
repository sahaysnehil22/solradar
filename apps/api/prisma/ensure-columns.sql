-- SolRadar Idempotent Real Data Pipeline Migration
-- Safe to run directly in Supabase SQL Editor or against Postgres pooler
ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "price_history" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "token_snapshots" ADD COLUMN IF NOT EXISTS "top_holders" JSONB DEFAULT '[]'::jsonb;
