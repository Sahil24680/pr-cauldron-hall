import { readFile } from "node:fs/promises";
import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import path from "node:path";
import { appearanceSchema, castKeySchema } from "../shared/cast";
import { loadCast, resetCastMember, saveCastMember } from "./castStore";
import type { Config } from "./config";
import type { EventStream } from "./eventStream";
import type { BoardPoller } from "./poller";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

// DNS rebinding guard: a page on another site could otherwise reach this server by resolving its own name to 127.0.0.1.
function isLocalHost(request: IncomingMessage) {
  const host = request.headers.host?.split(":")[0];
  return host === "127.0.0.1" || host === "localhost";
}

const MAX_BODY_BYTES = 16_384;
const CAST_MEMBER_PATH = /^\/api\/cast\/([a-z]+)$/;
const CAST_MEMBER_RESET_PATH = /^\/api\/cast\/([a-z]+)\/reset$/;

async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) {
      throw new RangeError("Request body too large");
    }
  }
  return JSON.parse(body);
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(value));
}

async function updateCastMember(config: Config, key: string, request: IncomingMessage, response: ServerResponse) {
  const member = castKeySchema.safeParse(key);
  const appearance = appearanceSchema.safeParse(await readJson(request).catch(() => null));
  if (!member.success || !appearance.success) {
    response.writeHead(400).end("Invalid cast member");
    return;
  }
  sendJson(response, 200, await saveCastMember(config.castFile, member.data, appearance.data));
}

async function resetMember(config: Config, key: string, response: ServerResponse) {
  const member = castKeySchema.safeParse(key);
  if (!member.success) {
    response.writeHead(400).end("Invalid cast member");
    return;
  }
  sendJson(response, 200, await resetCastMember(config.castFile, member.data));
}

async function serveStatic(distDirectory: string, pathname: string, response: ServerResponse) {
  const requested = path.resolve(distDirectory, `.${pathname}`);
  const file = requested.startsWith(distDirectory) && path.extname(requested) ? requested : path.join(distDirectory, "index.html");
  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

export function createRequestHandler(config: Config, poller: BoardPoller, stream: EventStream): RequestListener {
  return (request, response) => {
    if (!isLocalHost(request)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
    if (pathname === "/api/stream") {
      const greeting = poller.board ? [{ event: "board", data: poller.board }] : [];
      stream.open(request, response, [...greeting, { event: "status", data: poller.status }]);
      return;
    }
    if (pathname === "/api/refresh" && request.method === "POST") {
      void poller.poll();
      response.writeHead(202).end();
      return;
    }
    if (pathname === "/api/cast" && request.method === "GET") {
      void loadCast(config.castFile).then((cast) => sendJson(response, 200, cast));
      return;
    }
    const castMember = CAST_MEMBER_PATH.exec(pathname)?.[1];
    if (castMember && request.method === "PUT") {
      void updateCastMember(config, castMember, request, response);
      return;
    }
    const resetMemberKey = CAST_MEMBER_RESET_PATH.exec(pathname)?.[1];
    if (resetMemberKey && request.method === "POST") {
      void resetMember(config, resetMemberKey, response);
      return;
    }
    if (pathname === "/api/board") {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(poller.board));
      return;
    }
    if (config.isProduction) {
      void serveStatic(config.distDirectory, pathname, response);
      return;
    }
    response.writeHead(404).end("Not found");
  };
}
