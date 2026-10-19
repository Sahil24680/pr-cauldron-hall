import type { IncomingMessage, ServerResponse } from "node:http";

const HEARTBEAT_MS = 25_000;

export type StreamMessage = { event: string; data: unknown };

// Server-sent events to every open board tab; a comment line every 25 s keeps proxies from closing idle streams.
export class EventStream {
  private readonly clients = new Set<ServerResponse>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor() {
    this.heartbeat = setInterval(() => this.writeAll(": ping\n\n"), HEARTBEAT_MS);
  }

  open(request: IncomingMessage, response: ServerResponse, greeting: StreamMessage[]) {
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    response.write("retry: 3000\n\n");
    this.clients.add(response);
    for (const message of greeting) {
      response.write(format(message));
    }
    request.on("close", () => this.clients.delete(response));
  }

  broadcast(message: StreamMessage) {
    this.writeAll(format(message));
  }

  close() {
    clearInterval(this.heartbeat);
  }

  private writeAll(chunk: string) {
    for (const client of this.clients) {
      client.write(chunk);
    }
  }
}

function format({ event, data }: StreamMessage) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
