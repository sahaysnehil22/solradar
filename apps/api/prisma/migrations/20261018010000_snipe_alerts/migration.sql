-- CreateTable
CREATE TABLE "snipe_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Pump.fun Snipe Alert',
    "launchpad" TEXT NOT NULL DEFAULT 'pump.fun',
    "min_liquidity_usd" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "max_risk_score" INTEGER NOT NULL DEFAULT 40,
    "max_dev_holding_pct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "channel" TEXT NOT NULL DEFAULT 'telegram',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snipe_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snipe_triggers" (
    "id" TEXT NOT NULL,
    "snipe_rule_id" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "mcap" DOUBLE PRECISION NOT NULL,
    "liquidity_usd" DOUBLE PRECISION NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snipe_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snipe_rules_user_id_idx" ON "snipe_rules"("user_id");

-- CreateIndex
CREATE INDEX "snipe_rules_status_idx" ON "snipe_rules"("status");

-- CreateIndex
CREATE INDEX "snipe_triggers_snipe_rule_id_idx" ON "snipe_triggers"("snipe_rule_id");

-- CreateIndex
CREATE INDEX "snipe_triggers_mint_idx" ON "snipe_triggers"("mint");

-- AddForeignKey
ALTER TABLE "snipe_rules" ADD CONSTRAINT "snipe_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snipe_triggers" ADD CONSTRAINT "snipe_triggers_snipe_rule_id_fkey" FOREIGN KEY ("snipe_rule_id") REFERENCES "snipe_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
