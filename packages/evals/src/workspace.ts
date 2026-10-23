import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { hiddenTestPath, repoRoot, type Task } from "./tasks";

export type Variant = "clubkit" | "baseline";

// Files that exist only to help agents. The baseline variant removes them so the
// comparison isolates the agent-facing layer; the code itself is identical.
const guidancePaths = ["AGENTS.md", "CLAUDE.md", ".mcp.json", "skills", "docs", "catalog.json"];
/** The same set as `git apply --exclude` globs. */
export const guidanceGlobs = [...guidancePaths.map((p) => (p.includes(".") ? p : `${p}/*`)), "modules/*/MODULE.md"];
const isGuidance = (path: string) =>
  guidancePaths.some((g) => path === g || path.startsWith(`${g}/`)) || /^modules\/[^/]+\/MODULE\.md$/.test(path);

// The tasks, answers, and runner itself. Removed from every workspace so agents
// cannot read the answers and `pnpm check` stays green without them.
const isEvalHarness = (path: string) => path.startsWith("evals/") || path.startsWith("packages/evals/");

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export interface Workspace {
  dir: string;
  baseCommit: string;
  variant: Variant;
}

/**
 * Create a detached git worktree of HEAD for one attempt. The eval harness is
 * always removed; baseline also removes guidance. The removal is committed so
 * the agent sees a clean tree.
 */
export function createWorkspace(dir: string, variant: Variant): Workspace {
  const baseCommit = git(repoRoot, "rev-parse", "HEAD");
  git(repoRoot, "worktree", "add", "--detach", "--force", dir, baseCommit);

  const tracked = git(dir, "ls-files").split("\n");
  const remove = tracked.filter((p) => isEvalHarness(p) || (variant === "baseline" && isGuidance(p)));
  for (const path of remove) rmSync(join(dir, path), { force: true });
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=clubkit-eval", "-c", "user.email=eval@clubkit.invalid", "commit", "-q", "--no-verify", "-m", `eval workspace (${variant})`);
  return { dir, baseCommit, variant };
}

/** Restore guidance files the checks depend on (manifest docs), then add the task's hidden tests. */
export function prepareForChecks(workspace: Workspace, task: Task): void {
  if (workspace.variant === "baseline") {
    const guidance = git(repoRoot, "ls-tree", "-r", "--name-only", workspace.baseCommit).split("\n").filter(isGuidance);
    if (guidance.length > 0) git(workspace.dir, "checkout", workspace.baseCommit, "--", ...guidance);
  }
  const target = join(workspace.dir, "eval-hidden");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target);
  copyFileSync(hiddenTestPath(task.id), join(target, `${task.id}.test.ts`));
}

export function removeWorkspace(workspace: Workspace): void {
  try {
    git(repoRoot, "worktree", "remove", "--force", workspace.dir);
  } catch {
    rmSync(workspace.dir, { recursive: true, force: true });
    git(repoRoot, "worktree", "prune");
  }
}

export interface CommandResult {
  command: string;
  exitCode: number | null;
  output: string;
  durationMs: number;
}

/** Run a shell command in `cwd`, keeping the last `keep` characters of combined output. */
export function runCommand(command: string, cwd: string, timeoutMs = 10 * 60_000, keep = 4000): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolvePromise) => {
    const child = spawn(command, { cwd, shell: true });
    let output = "";
    const append = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-keep);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      output += `\n[killed after ${timeoutMs / 1000}s]`;
      child.kill();
    }, timeoutMs);
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolvePromise({ command, exitCode, output, durationMs: Date.now() - started });
    });
  });
}
