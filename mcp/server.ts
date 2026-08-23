import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerImageTools } from "./tools/image";
import { registerVideoTools } from "./tools/video";
import { registerAudioTools } from "./tools/audio";
import { registerInfoTools } from "./tools/info";

// stdio transport: stdout is reserved for JSON-RPC — log to stderr only.
const server = new McpServer({
  name: "media-converter",
  version: "0.1.0",
});

registerImageTools(server);
registerVideoTools(server);
registerAudioTools(server);
registerInfoTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("media-converter MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
