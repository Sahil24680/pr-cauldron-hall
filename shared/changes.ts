import type { ChangeSummary } from "./board";

// GitHub caps a connection page at 100; bigger PRs get a summary marked partial rather than a second round trip per PR.
export const MAX_CLASSIFIED_FILES = 100;

export type FileChange = { path: string; additions: number; deletions: number };

const TEST_FOLDERS = new Set(["__tests__", "test", "tests", "e2e", "playwright", "fixtures", "__fixtures__", "__snapshots__", "snapshots"]);
const TEST_FILE_NAME = /\.(test|spec)\.|\.snap$/;

export function isTestPath(path: string) {
  const segments = path.toLowerCase().split("/");
  const fileName = segments.pop() ?? "";
  return TEST_FILE_NAME.test(fileName) || segments.some((segment) => TEST_FOLDERS.has(segment));
}

export function summarizeChanges(files: FileChange[], changedFiles: number): ChangeSummary {
  const summary: ChangeSummary = {
    code: { additions: 0, deletions: 0 },
    tests: { additions: 0, deletions: 0 },
    partial: files.length < changedFiles,
  };
  for (const file of files) {
    const lines = isTestPath(file.path) ? summary.tests : summary.code;
    lines.additions += file.additions;
    lines.deletions += file.deletions;
  }
  return summary;
}
