import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerImageTools } from "./tools/image";
import { registerVideoTools } from "./tools/video";
import { registerAudioTools } from "./tools/audio";
import { registerInfoTools } from "./tools/info";

/**
 * HTTP (Streamable HTTP) entry point so remote agents can connect over a URL,
 * e.g. a Hermes agent running on a VPS. Auth is a shared bearer token:
 * set MCP_HTTP_TOKEN before starting (printed once at startup if unset).
 */

const PORT = Number(process.env.PORT ?? 3100);
const TOKEN = process.env.MCP_HTTP_TOKEN ?? randomBytes(24).toString("hex");

if (!process.env.MCP_HTTP_TOKEN) {
  console.error(`No MCP_HTTP_TOKEN set — generated one for this session: ${TOKEN}`);
}

function createMediaServer(): McpServer {
  const server = new McpServer({ name: "media-converter", version: "0.1.0" });
  registerImageTools(server);
  registerVideoTools(server);
  registerAudioTools(server);
  registerInfoTools(server);
  return server;
}

// One transport per session (Streamable HTTP spec); stateless would lose
// long-running tool state between requests.
const transports = new Map<string, StreamableHTTPServerTransport>();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage): boolean {
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname !== "/mcp") {
    sendJson(res, 404, { error: "Not found. MCP endpoint is /mcp" });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Missing or invalid bearer token" });
    return;
  }

  try {
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body);
          const sessionId = req.headers["mcp-session-id"] as string | undefined;

          let transport = sessionId ? transports.get(sessionId) : undefined;

          if (!transport) {
            if (!isInitializeRequest(parsed)) {
              sendJson(res, 400, {
                error: "Bad request: no session. Send an initialize request first.",
              });
              return;
            }
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomBytes(16).toString("hex"),
              // Register the session as soon as the SDK assigns it — the
              // session id getter can lag until after the response is sent.
              onsessioninitialized: (newSessionId) => {
                transports.set(newSessionId, transport!);
                console.error(`MCP session opened: ${newSessionId}`);
              },
            });
            transport.onclose = () => {
              for (const [id, entry] of transports) {
                if (entry === transport) {
                  transports.delete(id);
                  console.error(`MCP session closed: ${id}`);
                  break;
                }
              }
            };
            transport.onerror = (error) => {
              console.error("MCP transport error:", error);
            };
            await createMediaServer().connect(transport);
          }

          await transport.handleRequest(req, res, parsed);
        } catch (error) {
          if (!res.headersSent) {
            sendJson(res, 400, { error: `Invalid request: ${(error as Error).message}` });
          }
        }
      });
    } else if (req.method === "GET" || req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        sendJson(res, 400, { error: "Bad request: unknown or missing session id" });
        return;
      }
      await transport.handleRequest(req, res);
    } else {
      sendJson(res, 405, { error: "Method not allowed" });
    }
  } catch (error) {
    console.error("MCP HTTP error:", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" });
    }
  }
});

httpServer.listen(PORT, () => {
  console.error(`media-converter MCP (HTTP) listening on http://0.0.0.0:${PORT}/mcp`);
  console.error(`Connect with header: Authorization: Bearer ${TOKEN}`);
});
