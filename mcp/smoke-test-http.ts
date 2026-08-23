import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Smoke test for the HTTP transport. Start the server first:
 *   $env:MCP_HTTP_TOKEN='your-token'; npm run mcp:http
 * then run:
 *   $env:MCP_HTTP_TOKEN='your-token'; node ./node_modules/tsx/dist/cli.mjs mcp/smoke-test-http.ts
 */

const baseUrl = process.env.MCP_URL ?? "http://localhost:3100/mcp";
const token = process.env.MCP_HTTP_TOKEN;

if (!token) {
  console.error("Set MCP_HTTP_TOKEN (and optionally MCP_URL) first.");
  process.exit(1);
}

const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});

const client = new Client({ name: "http-smoke-test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.error(`Connected. ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);

const result = await client.callTool({ name: "list_formats", arguments: { mediaType: "image" } });
console.error("list_formats →", (result.content as Array<{ text: string }>)[0].text);

await client.close();
process.exit(0);
