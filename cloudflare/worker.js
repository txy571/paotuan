/**
 * TTRPG Companion — Cloudflare Worker (API Proxy + Multiplayer Relay)
 *
 * Deploy:
 *   1. npx wrangler deploy
 *   2. Copy URL → configure in app as 代理端点
 *
 * Endpoints:
 *   POST /api/proxy    — AI API proxy (for GitHub Pages)
 *   GET  /ping         — health check
 *   WS   /room/:id     — multiplayer WebSocket relay (Durable Object)
 */

// ==================== Durable Object: Game Room ====================
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // playerId → { ws, name, isHost }
    this.storage = state.storage;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426,
        headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, ['_session']);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    switch (data.type) {
      case '_join': {
        const pid = data.playerId;
        ws._session = { playerId: pid, playerName: data.playerName, isHost: data.isHost };
        this.sessions.set(pid, ws);

        // Send current room state to the new joiner
        const playerList = {};
        for (const [id, s] of this.sessions) {
          playerList[id] = { name: s.playerName, isHost: s.isHost, playerId: id };
        }
        ws.send(JSON.stringify({
          type: 'welcome',
          roomId: this.state.id.toString(),
          hostId: data.isHost ? pid : [...this.sessions.values()].find(s => s.isHost)?.playerId,
          hostName: [...this.sessions.values()].find(s => s.isHost)?.playerName || '',
          players: playerList,
          playerId: pid,
        }));

        // Notify others
        this.broadcast(pid, {
          type: 'player-joined',
          playerId: pid,
          playerName: data.playerName,
          charData: data.charData || {},
        });
        return;
      }

      case '_hello': {
        // Client-registered char data — session already set in _join; silently acknowledge.
        if (ws._session && data.charData) {
          ws._session.charData = data.charData;
          ws._session.charName = data.charData.name || '';
        }
        return;
      }

      case '_leave': {
        this.removeSession(ws);
        return;
      }

      case '_ping': {
        ws.send(JSON.stringify({ type: '_pong' }));
        return;
      }

      default: {
        // Route game messages
        if (data._target) {
          // Direct message to a specific player
          const target = this.sessions.get(data._target);
          if (target && target.readyState === 1) {
            const clean = { ...data };
            delete clean._target; delete clean._targetExclude; delete clean._all;
            target.send(JSON.stringify(clean));
          }
        } else if (data._all) {
          // Broadcast to ALL (including sender)
          const clean = { ...data };
          delete clean._target; delete clean._targetExclude; delete clean._all;
          for (const [, s] of this.sessions) {
            if (s.readyState === 1) s.send(JSON.stringify(clean));
          }
        } else {
          // Broadcast to all EXCEPT sender
          const senderId = ws._session?.playerId;
          this.broadcast(senderId, data);
        }
      }
    }
  }

  async webSocketClose(ws) {
    this.removeSession(ws);
  }

  async webSocketError(ws, error) {
    this.removeSession(ws);
  }

  broadcast(excludeId, data) {
    const skip = new Set([excludeId]);
    if (data._targetExclude) skip.add(data._targetExclude);
    for (const [id, s] of this.sessions) {
      if (!skip.has(id) && s.readyState === 1) {
        // Strip internal fields before forwarding
        const clean = { ...data };
        delete clean._target;
        delete clean._targetExclude;
        delete clean._all;
        s.send(JSON.stringify(clean));
      }
    }
  }

  removeSession(ws) {
    const session = ws._session;
    if (!session) return;
    const pid = session.playerId;
    this.sessions.delete(pid);
    this.broadcast(pid, {
      type: 'player-left',
      playerId: pid,
      playerName: session.playerName,
    });
    ws._session = null;
  }
}

// ==================== Main Worker ====================
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key, anthropic-version, x-proxy-target',
        }
      });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/ping') {
      return new Response('ok', {
        headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // API proxy — only allow known AI API endpoints
    if (url.pathname === '/api/proxy' && request.method === 'POST') {
      const target = request.headers.get('X-Proxy-Target');
      if (!target) {
        return new Response('Missing X-Proxy-Target header', { status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      // Whitelist: only allow requests to AI API providers
      const ALLOWED_HOSTS = [
        'api.anthropic.com',
        'api.openai.com',
        'api.deepseek.com',
      ];
      let allowed = false;
      try {
        const targetHost = new URL(target).hostname;
        allowed = ALLOWED_HOSTS.some(h => targetHost === h || targetHost.endsWith('.' + h));
      } catch {}
      if (!allowed) {
        return new Response('Proxy target not allowed', { status: 403,
          headers: { 'Access-Control-Allow-Origin': '*' } });
      }

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
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Multiplayer room → Durable Object
    if (url.pathname.startsWith('/room/')) {
      const roomId = url.pathname.split('/')[2];
      if (!roomId) {
        return new Response('Missing room ID', { status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('TTRPG Worker — POST /api/proxy | WS /room/:id', {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
    });
  }
};
