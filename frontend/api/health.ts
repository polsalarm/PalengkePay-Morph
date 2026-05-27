import type { VercelRequest, VercelResponse } from '@vercel/node';

const RPC_URL = process.env.MORPH_HOODI_RPC ?? process.env.VITE_MORPH_RPC_URL ?? 'https://rpc-hoodi.morph.network';
const CHAIN_ID = Number(process.env.VITE_CHAIN_ID ?? 2910);

interface HealthCheck {
  name: string;
  ok: boolean;
  status: number;
  detail?: string;
}

function hasDurableRateLimitEnv(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return Boolean(url?.trim() && token?.trim());
}

function requiresDurableRateLimit(): boolean {
  return process.env.FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT === 'true' || process.env.VERCEL_ENV === 'production';
}

export function getSponsorRateLimitReadiness(): HealthCheck {
  if (hasDurableRateLimitEnv()) {
    return { name: 'sponsor_rate_limit', ok: true, status: 200, detail: 'durable Redis REST configured' };
  }
  if (requiresDurableRateLimit()) {
    return { name: 'sponsor_rate_limit', ok: false, status: 503, detail: 'durable Redis REST rate limiting is required' };
  }
  return { name: 'sponsor_rate_limit', ok: true, status: 200, detail: 'memory fallback for local development' };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks = await Promise.allSettled<HealthCheck>([
    fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    }).then(async (r) => {
      const body = await r.json().catch(() => null) as { result?: string; error?: { message?: string } } | null;
      const chainId = body?.result ? parseInt(body.result, 16) : 0;
      return {
        name: 'morph_rpc',
        ok: r.ok && chainId === CHAIN_ID,
        status: r.status,
        detail: body?.error?.message ?? `chainId ${chainId}`,
      };
    }),
  ]);

  const results = checks.map((c) =>
    c.status === 'fulfilled'
      ? c.value
      : { name: 'morph_rpc', ok: false, status: 0, detail: c.reason instanceof Error ? c.reason.message : 'check failed' },
  );
  results.push(getSponsorRateLimitReadiness());

  const allOk = results.every((r) => r.ok);

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    networkProfile: { network: 'morph-hoodi', chainId: CHAIN_ID, rpc: RPC_URL },
    checks: results,
  });
}
