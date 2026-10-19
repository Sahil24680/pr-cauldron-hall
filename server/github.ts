import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { z } from "zod";
import { type PullRequest, mergeableSchema, reviewDecisionSchema, reviewStateSchema } from "../shared/board";
import { MAX_CLASSIFIED_FILES, summarizeChanges } from "../shared/changes";

const runFile = promisify(execFile);
const GH_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
// One page of 200 PRs with their checks timed out at GitHub's gateway (504); 25 returns in about 2s.
const PAGE_SIZE = 25;
const RETRY_DELAY_MS = 2000;
const FAILED_CONCLUSIONS = new Set(["FAILURE", "ERROR", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"]);
const PASSED_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL"]);
const RUNNING_STATES = new Set(["PENDING", "EXPECTED"]);

const OPEN_PULL_REQUESTS_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: ${PAGE_SIZE}, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url isDraft createdAt updatedAt reviewDecision mergeable
        additions deletions changedFiles baseRefName headRefName
        files(first: ${MAX_CLASSIFIED_FILES}) { nodes { path additions deletions } }
        author { login ... on User { name } }
        reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Bot { login } ... on Team { slug } } } }
        latestReviews(first: 10) { nodes { state author { login ... on User { name } } } }
        commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {
          __typename
          ... on CheckRun { name status conclusion }
          ... on StatusContext { context state }
        } } } } } }
      }
    }
  }
}`;

const actorSchema = z.object({ login: z.string(), name: z.string().nullish() }).nullable();

const checkSchema = z.union([
  z.object({ __typename: z.literal("CheckRun"), name: z.string(), status: z.string(), conclusion: z.string().nullable() }),
  z.object({ __typename: z.literal("StatusContext"), context: z.string(), state: z.string() }),
]);

const pullRequestNodeSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  isDraft: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewDecision: reviewDecisionSchema,
  mergeable: mergeableSchema,
  additions: z.number(),
  deletions: z.number(),
  changedFiles: z.number(),
  files: z.object({ nodes: z.array(z.object({ path: z.string(), additions: z.number(), deletions: z.number() })) }).nullable(),
  baseRefName: z.string(),
  headRefName: z.string(),
  author: actorSchema,
  reviewRequests: z.object({
    nodes: z.array(z.object({ requestedReviewer: z.object({ login: z.string().optional(), slug: z.string().optional() }).nullable() })),
  }),
  latestReviews: z.object({ nodes: z.array(z.object({ state: reviewStateSchema, author: actorSchema })) }),
  commits: z.object({
    nodes: z.array(
      z.object({
        commit: z.object({ statusCheckRollup: z.object({ contexts: z.object({ nodes: z.array(checkSchema.nullable()) }) }).nullable() }),
      }),
    ),
  }),
});

const openPageSchema = z.object({
  data: z.object({
    repository: z.object({
      pullRequests: z.object({
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
        nodes: z.array(pullRequestNodeSchema),
      }),
    }),
  }),
});

const closedOutcomesSchema = z.object({
  data: z.object({ repository: z.record(z.object({ number: z.number(), merged: z.boolean() }).nullable()) }),
});

const viewerSchema = z.object({ login: z.string() });

type PullRequestNode = z.infer<typeof pullRequestNodeSchema>;
type CheckNode = z.infer<typeof checkSchema>;
type CheckResult = "failing" | "running" | "passing" | "skipped";
export type ClosedOutcome = "merged" | "closed";

async function runGh(args: string[]): Promise<unknown> {
  const { stdout } = await runFile("gh", args, { maxBuffer: GH_MAX_BUFFER_BYTES });
  return JSON.parse(stdout);
}

async function runGraphql(query: string, variables: Record<string, string>) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-f", `${key}=${value}`);
  }
  try {
    return await runGh(args);
  } catch {
    await sleep(RETRY_DELAY_MS);
    return runGh(args);
  }
}

function classifyCheckRun(status: string, conclusion: string | null): CheckResult {
  if (status !== "COMPLETED") {
    return "running";
  }
  if (conclusion && FAILED_CONCLUSIONS.has(conclusion)) {
    return "failing";
  }
  if (conclusion && PASSED_CONCLUSIONS.has(conclusion)) {
    return "passing";
  }
  return "skipped";
}

function classifyStatusContext(state: string): CheckResult {
  if (RUNNING_STATES.has(state)) {
    return "running";
  }
  if (FAILED_CONCLUSIONS.has(state)) {
    return "failing";
  }
  if (state === "SUCCESS") {
    return "passing";
  }
  return "skipped";
}

function classifyCheck(node: CheckNode) {
  if (node.__typename === "CheckRun") {
    return { name: node.name, result: classifyCheckRun(node.status, node.conclusion) };
  }
  return { name: node.context, result: classifyStatusContext(node.state) };
}

function summarizeChecks(node: PullRequestNode): PullRequest["checks"] {
  const contexts = node.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? [];
  const classified = contexts.flatMap((check) => (check ? [classifyCheck(check)] : []));
  const namesWith = (result: CheckResult) => [...new Set(classified.filter((check) => check.result === result).map((check) => check.name))];
  return {
    passing: classified.filter((check) => check.result === "passing").length,
    failing: namesWith("failing"),
    running: namesWith("running"),
  };
}

function findFirstName(actor: z.infer<typeof actorSchema>) {
  return actor?.name?.trim().split(/\s+/)[0] || actor?.login || "ghost";
}

function mapPullRequest(node: PullRequestNode, numberByHead: Map<string, number>): PullRequest {
  return {
    number: node.number,
    title: node.title,
    url: node.url,
    author: node.author?.login ?? "ghost",
    authorName: findFirstName(node.author),
    isDraft: node.isDraft,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    reviewDecision: node.reviewDecision,
    mergeable: node.mergeable,
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    changes: node.files ? summarizeChanges(node.files.nodes, node.changedFiles) : null,
    baseRef: node.baseRefName,
    headRef: node.headRefName,
    parent: numberByHead.get(node.baseRefName) ?? null,
    requestedReviewers: node.reviewRequests.nodes.flatMap(({ requestedReviewer }) => {
      const reviewer = requestedReviewer?.login ?? requestedReviewer?.slug;
      return reviewer ? [reviewer] : [];
    }),
    reviews: node.latestReviews.nodes.flatMap((review) =>
      review.author ? [{ login: review.author.login, name: findFirstName(review.author), state: review.state }] : [],
    ),
    checks: summarizeChecks(node),
  };
}

export async function fetchOpenPullRequests(owner: string, name: string) {
  const nodes: PullRequestNode[] = [];
  let cursor: string | null = null;
  do {
    const variables: Record<string, string> = cursor ? { owner, name, cursor } : { owner, name };
    const page = openPageSchema.parse(await runGraphql(OPEN_PULL_REQUESTS_QUERY, variables)).data.repository.pullRequests;
    nodes.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  const numberByHead = new Map(nodes.map((node) => [node.headRefName, node.number]));
  return nodes.map((node) => mapPullRequest(node, numberByHead));
}

export async function fetchClosedOutcomes(owner: string, name: string, numbers: number[]) {
  const outcomes = new Map<number, ClosedOutcome>();
  if (numbers.length === 0) {
    return outcomes;
  }
  const fields = numbers.map((number) => `pr${number}: pullRequest(number: ${number}) { number merged }`).join("\n");
  const response = closedOutcomesSchema.parse(await runGraphql(`query { repository(owner: "${owner}", name: "${name}") { ${fields} } }`, {}));
  for (const pr of Object.values(response.data.repository)) {
    if (pr) {
      outcomes.set(pr.number, pr.merged ? "merged" : "closed");
    }
  }
  return outcomes;
}

export async function fetchViewer() {
  return viewerSchema.parse(await runGh(["api", "user"])).login;
}
