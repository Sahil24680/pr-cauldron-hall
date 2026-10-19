import { createServer } from "node:http";
import { loadConfig } from "./config";
import { EventStream } from "./eventStream";
import { createRequestHandler } from "./http";
import { BoardPoller } from "./poller";
import { loadSavedBoard } from "./store";

const config = loadConfig();
const stream = new EventStream();
const poller = new BoardPoller(config, stream, await loadSavedBoard(config.stateFile, config.repo));
const server = createServer(createRequestHandler(config, poller, stream));

server.listen(config.port, "127.0.0.1", () => {
  const watching = config.scope === "all" ? "every open PR" : "your open PRs";
  console.log(`PR board server on http://127.0.0.1:${config.port}, watching ${watching} in ${config.repo} every ${config.pollIntervalMs / 1000}s`);
  void poller.poll();
});
