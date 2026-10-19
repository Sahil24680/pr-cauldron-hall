export function describeGitHubError(error: unknown) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return "The GitHub CLI is not installed. Install gh and run gh auth login.";
  }
  if (error instanceof Error && "stderr" in error && typeof error.stderr === "string" && error.stderr.trim()) {
    return error.stderr.trim().split("\n")[0] ?? "GitHub request failed";
  }
  return error instanceof Error ? error.message : "GitHub request failed";
}
