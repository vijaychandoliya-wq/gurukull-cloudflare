/**
 * Gurukul Edge Scheduled Jobs Worker
 * Phase 07: J02 - J05 (Cron Triggers & Outbox Consumer)
 * Phase 06: B03 - B04 (FCM Push Dispatch)
 */

import { OutboxConsumerEnv, processOutboxBatch } from './outbox-consumer.js';

export default {
  /**
   * Cron Trigger Handler (Executed by Cloudflare Edge Scheduler)
   */
  async scheduled(
    event: ScheduledEvent,
    env: OutboxConsumerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`[Scheduled Jobs] Triggered at ${new Date(event.scheduledTime).toISOString()}`);
    ctx.waitUntil(
      processOutboxBatch(env, 1).then(stats => {
        console.log('[Scheduled Jobs Batch Stats]', stats);
      })
    );
  },

  /**
   * HTTP Handler for Health Checks & Manual Admin Triggers
   */
  async fetch(
    request: Request,
    env: OutboxConsumerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          service: 'gurukul-jobs',
          runtime: 'cloudflare-workers',
          status: 'healthy',
          timestamp: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/run' && request.method === 'POST') {
      return new Response(
        JSON.stringify({error:'FORBIDDEN',message:'Use the scheduled dispatcher.'}),
        { status:403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'NOT_FOUND', message: 'Route not found.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  },
};
