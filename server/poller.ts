import type { Board, BoardEvent, PollStatus, PullRequest } from "../shared/board";
import type { Config } from "./config";
import { diffPullRequests, keepKnownMergeable } from "./diff";
import { describeGitHubError } from "./errors";
import type { EventStream } from "./eventStream";
import { fetchClosedOutcomes, fetchOpenPullRequests, fetchViewer } from "./github";
import { saveBoard } from "./store";

const MAX_EVENTS = 200;

export class BoardPoller {
  board: Board | null;
  status: PollStatus = { refreshing: false, error: null, lastPolledAt: null, nextPollAt: null };
  private viewer: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: Config,
    private readonly stream: EventStream,
    savedBoard: Board | null,
  ) {
    this.board = savedBoard;
  }

  async poll() {
    if (this.status.refreshing) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.setStatus({ refreshing: true });
    try {
      this.viewer ??= await fetchViewer();
      const viewer = this.viewer;
      const previous = this.board?.pullRequests ?? null;
      const previousByNumber = new Map((previous ?? []).map((pr) => [pr.number, pr]));
      const fetched = await fetchOpenPullRequests(this.config.owner, this.config.name);
      const pullRequests = fetched
        .filter((pr) => this.config.scope === "all" || pr.author === viewer)
        .map((pr) => keepKnownMergeable(pr, previousByNumber.get(pr.number)));
      const at = new Date().toISOString();
      const events = await this.findEvents(previous, pullRequests, at);
      this.board = { repo: this.config.repo, viewer, fetchedAt: at, pullRequests, events: [...events, ...(this.board?.events ?? [])].slice(0, MAX_EVENTS) };
      await saveBoard(this.config.stateFile, this.board);
      this.stream.broadcast({ event: "board", data: this.board });
      this.status = { ...this.status, error: null, lastPolledAt: at };
    } catch (error) {
      this.status = { ...this.status, error: describeGitHubError(error) };
    } finally {
      this.timer = setTimeout(() => void this.poll(), this.config.pollIntervalMs);
      this.setStatus({ refreshing: false, nextPollAt: new Date(Date.now() + this.config.pollIntervalMs).toISOString() });
    }
  }

  private setStatus(change: Partial<PollStatus>) {
    this.status = { ...this.status, ...change };
    this.stream.broadcast({ event: "status", data: this.status });
  }

  private async findEvents(previous: PullRequest[] | null, next: PullRequest[], at: string): Promise<BoardEvent[]> {
    if (!previous) {
      return [];
    }
    const stillOpen = new Set(next.map((pr) => pr.number));
    const gone = previous.filter((pr) => !stillOpen.has(pr.number)).map((pr) => pr.number);
    const outcomes = await fetchClosedOutcomes(this.config.owner, this.config.name, gone);
    return diffPullRequests(previous, next, outcomes, at);
  }
}
