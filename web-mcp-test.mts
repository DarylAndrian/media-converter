import { promises as fs } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Smoke test for the website-hosted MCP endpoint (app/api/mcp/route.ts).
 * Start the app with a token first:
 *   $env:MCP_TOKEN='your-token'; npm run dev
 * then run:
 *   $env:MCP_TOKEN='your-token'; node ./node_modules/tsx/dist/cli.mjs web-mcp-test.mts
 * Point MCP_URL at a deployed site to test production, e.g.
 *   $env:MCP_URL='https://<your-site>.netlify.app/api/mcp'
 */

const transport = new StreamableHTTPClientTransport(
  new URL(process.env.MCP_URL ?? "http://localhost:3000/api/mcp"),
  {
    requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_TOKEN}` } },
  },
);

const client = new Client({ name: "web-mcp-test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.error(`Connected. ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);

const logo = await fs.readFile("public/logo.webp");
const result = await client.callTool({
  name: "convert_image",
  arguments: {
    imageBase64: logo.toString("base64"),
    inputFormat: "webp",
    outputFormat: "png",
  },
});

const payload = JSON.parse((result.content as Array<{ text: string }>)[0].text);
console.error(
  `convert_image → .${payload.extension} ${payload.mimeType} (${payload.sizeBytes} bytes, base64 length ${payload.imageBase64.length})`,
);

process.exit(0);
