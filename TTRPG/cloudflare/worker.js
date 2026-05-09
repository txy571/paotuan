/**
 * TTRPG Companion — Cloudflare Worker API Proxy
 *
 * Deploy this to Cloudflare Workers (free tier: 100k req/day) to enable
 * AI KP on GitHub Pages.
 *
 * Deployment:
 * 1. npx wrangler deploy worker.js
 * 2. Copy the URL (e.g., https://ttrpg-proxy.YOURNAME.workers.dev)
 * 3. In the TTRPG app, Settings → enter the Worker URL as "代理端点"
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key, anthropic-version',
        }
      });
    }

    // Health check
    const url = new URL(request.url);
    if (url.pathname === '/ping') {
      return new Response('ok', {
        headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // API proxy endpoint
    if (url.pathname === '/api/proxy' && request.method === 'POST') {
      const target = request.headers.get('X-Proxy-Target');
      if (!target) {
        return new Response('Missing X-Proxy-Target header', { status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      // Forward the request
      const upstreamHeaders = new Headers();
      for (const [key, value] of request.headers) {
        const lk = key.toLowerCase();
        if (!['host', 'connection', 'x-proxy-target'].includes(lk)) {
          upstreamHeaders.set(key, value);
        }
      }

      try {
        const upstreamResp = await fetch(target, {
          method: 'POST',
          headers: upstreamHeaders,
          body: request.body,
        });

        const respHeaders = new Headers(upstreamResp.headers);
        respHeaders.set('Access-Control-Allow-Origin', '*');
        respHeaders.set('X-Proxy-Source', 'cloudflare-worker');

        return new Response(upstreamResp.body, {
          status: upstreamResp.status,
          headers: respHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: { message: err.message } }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
    }

    return new Response('TTRPG Proxy Worker — POST to /api/proxy', {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
    });
  }
};
