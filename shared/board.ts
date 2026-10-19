import { z } from "zod";

export const stageSchema = z.enum(["draft", "review", "changes", "approved"]);
export const reviewStateSchema = z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED", "PENDING"]);
export const reviewDecisionSchema = z.enum(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"]).nullable();
export const mergeableSchema = z.enum(["MERGEABLE", "CONFLICTING", "UNKNOWN"]);

const lineCountSchema = z.object({ additions: z.number(), deletions: z.number() });

export const changeSummarySchema = z.object({ code: lineCountSchema, tests: lineCountSchema, partial: z.boolean() });

export const pullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  author: z.string(),
  authorName: z.string(),
  isDraft: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewDecision: reviewDecisionSchema,
  mergeable: mergeableSchema,
  additions: z.number(),
  deletions: z.number(),
  changedFiles: z.number(),
  changes: changeSummarySchema.nullable().default(null),
  baseRef: z.string(),
  headRef: z.string(),
  parent: z.number().nullable(),
  requestedReviewers: z.array(z.string()),
  reviews: z.array(z.object({ login: z.string(), name: z.string(), state: reviewStateSchema })),
  checks: z.object({ passing: z.number(), failing: z.array(z.string()), running: z.array(z.string()) }),
});

export const boardEventKindSchema = z.enum(["opened", "moved", "ci-failed", "ci-passed", "conflict", "merged", "closed"]);

export const boardEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  kind: boardEventKindSchema,
  number: z.number(),
  title: z.string(),
  author: z.string(),
  authorName: z.string(),
  from: stageSchema.optional(),
  to: stageSchema.optional(),
});

export const boardSchema = z.object({
  repo: z.string(),
  viewer: z.string(),
  fetchedAt: z.string(),
  pullRequests: z.array(pullRequestSchema),
  events: z.array(boardEventSchema),
});

export const pollStatusSchema = z.object({
  refreshing: z.boolean(),
  error: z.string().nullable(),
  lastPolledAt: z.string().nullable(),
  nextPollAt: z.string().nullable(),
});

export type Stage = z.infer<typeof stageSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type PullRequest = z.infer<typeof pullRequestSchema>;
export type ChangeSummary = z.infer<typeof changeSummarySchema>;
export type BoardEventKind = z.infer<typeof boardEventKindSchema>;
export type BoardEvent = z.infer<typeof boardEventSchema>;
export type Board = z.infer<typeof boardSchema>;
export type PollStatus = z.infer<typeof pollStatusSchema>;
