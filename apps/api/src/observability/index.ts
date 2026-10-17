import client from 'prom-client';

// Initialize Prometheus registry
export const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry, prefix: 'solradar_' });

// Custom Prometheus Metrics
export const httpRequestsTotal = new client.Counter({
  name: 'solradar_http_requests_total',
  help: 'Total HTTP requests processed by SolRadar API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'solradar_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const webhookIngestCounter = new client.Counter({
  name: 'solradar_webhook_ingest_total',
  help: 'Total webhook events received from Helius and payment providers',
  labelNames: ['source', 'status'],
  registers: [metricsRegistry],
});

export const alertFanoutLatencySeconds = new client.Histogram({
  name: 'solradar_alert_fanout_latency_seconds',
  help: 'Time taken from event detection to Telegram alert fanout delivery',
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export const alertDeliveryTotal = new client.Counter({
  name: 'solradar_alert_deliveries_total',
  help: 'Total alerts delivered to users',
  labelNames: ['channel', 'status'],
  registers: [metricsRegistry],
});

export const rpcBudgetBurnDaily = new client.Counter({
  name: 'solradar_rpc_budget_burn_daily',
  help: 'Total on-chain RPC calls made towards daily budget limit',
  registers: [metricsRegistry],
});

export const queueDepthGauge = new client.Gauge({
  name: 'solradar_queue_depth',
  help: 'Current depth of BullMQ queues',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const deadLetterQueueDepthGauge = new client.Gauge({
  name: 'solradar_dlq_depth',
  help: 'Current count of jobs in dead-letter queues',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

/**
 * Structured JSON Logger
 */
export const logger = {
  info(message: string, meta?: Record<string, any>) {
    console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
  },
  warn(message: string, meta?: Record<string, any>) {
    console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, ...meta }));
  },
  error(message: string, error?: any, meta?: Record<string, any>) {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...meta,
      })
    );
  },
};
