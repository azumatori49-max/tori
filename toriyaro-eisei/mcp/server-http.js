#!/usr/bin/env node
/**
 * らくらく衛生管理 の管理者用 read-only MCP サーバー（Streamable HTTP 版）。
 *
 *   - Express + @modelcontextprotocol/sdk の StreamableHTTPServerTransport
 *   - Bearer トークン認証（環境変数 MCP_ACCESS_TOKEN と一致必須。不一致は 401）
 *   - Cloud Run 用: firebase-admin は applicationDefault() で ADC を使う
 *   - ツール本体は tools.js に集約（stdio 版と共通）
 *
 * 想定起動: Cloud Run（asia-northeast1）
 *   PORT: Cloud Run が自動注入（デフォルト 8080）
 *   MCP_ACCESS_TOKEN: サービス作成時に env で設定
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import admin from 'firebase-admin';

import { TOOL_DEFINITIONS, runTool } from './tools.js';

const DATABASE_URL =
  'https://toriyaro-eisei-v2-default-rtdb.asia-southeast1.firebasedatabase.app';

const TOKEN = process.env.MCP_ACCESS_TOKEN;
if (!TOKEN || TOKEN.length < 16) {
  process.stderr.write(
    '[eisei-mcp-http] MCP_ACCESS_TOKEN env var (>=16 chars) is required\n',
  );
  process.exit(1);
}

// ---------- Firebase Admin: ADC で初期化（Cloud Run のサービスアカウントを使う） ----------
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: DATABASE_URL,
});
const db = admin.database();

// ---------- MCP サーバー生成（リクエストごとに独立） ----------
const buildMcpServer = () => {
  const server = new Server(
    { name: 'eisei-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      const result = await runTool(db, name, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${message}` }],
      };
    }
  });

  return server;
};

// ---------- Express ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

const authorize = (req, res, next) => {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match || match[1] !== TOKEN) {
    return res
      .status(401)
      .set('WWW-Authenticate', 'Bearer realm="eisei-mcp"')
      .json({ error: 'unauthorized' });
  }
  next();
};

// ヘルスチェック（Cloud Run 起動確認・監視用。認証不要）
app.get('/', (_req, res) => res.status(200).send('eisei-mcp-http\n'));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// メイン MCP エンドポイント。ステートレス方式（セッション ID を発行しない）
app.post('/mcp', authorize, async (req, res) => {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const cleanup = async () => {
    try {
      await transport.close();
    } catch {
      /* ignore */
    }
    try {
      await server.close();
    } catch {
      /* ignore */
    }
  };
  res.on('close', () => {
    void cleanup();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mcp] handle failed:', err instanceof Error ? err.message : err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal' });
    }
  }
});

// ステートレスなので GET / DELETE の /mcp は非対応
app.get('/mcp', authorize, (_req, res) =>
  res.status(405).json({ error: 'method not allowed' }),
);
app.delete('/mcp', authorize, (_req, res) =>
  res.status(405).json({ error: 'method not allowed' }),
);

const port = Number(process.env.PORT ?? 8080);
app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[eisei-mcp-http] listening on :${port}`);
});
