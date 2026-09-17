#!/usr/bin/env node
/**
 * らくらく衛生管理 の管理者用 read-only MCP サーバー（stdio 版）。
 *
 * 起動:
 *   EISEI_SA_KEY=/path/to/sa.json node mcp/server.js
 *   （未指定時は mcp/serviceAccountKey.json）
 *
 * ツール本体は tools.js に集約しているので、HTTP 版 (server-http.js) と共通。
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import admin from 'firebase-admin';

import { TOOL_DEFINITIONS, runTool } from './tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_KEY_PATH = resolve(__dirname, 'serviceAccountKey.json');
const DATABASE_URL =
  'https://toriyaro-eisei-v2-default-rtdb.asia-southeast1.firebasedatabase.app';

// ---------- 認証 ----------
const keyPath = process.env.EISEI_SA_KEY
  ? resolve(process.env.EISEI_SA_KEY)
  : DEFAULT_KEY_PATH;

if (!existsSync(keyPath)) {
  process.stderr.write(
    `[eisei-mcp] Service account key not found: ${keyPath}\n` +
      `Set EISEI_SA_KEY or place the JSON at ${DEFAULT_KEY_PATH}\n`,
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(await readFile(keyPath, 'utf-8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL,
});
const db = admin.database();

// ---------- MCP ----------
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

const transport = new StdioServerTransport();
await server.connect(transport);
