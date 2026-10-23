import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { referencePatchPath, type Task } from "./tasks";
import { removedGuidance, runCommand, type Workspace } from "./workspace";

export interface AgentOptions {
  model?: string;
  maxBudgetUsd: number;
  timeoutMs: number;
}

export interface AgentResult {
  ok: boolean;
  durationMs: number;
  costUsd?: number;
  turns?: number;
  summary: string;
}

export interface Agent {
  name: string;
  run(task: Task, workspace: Workspace, options: AgentOptions): Promise<AgentResult>;
}

/** Does nothing. Every task should fail; a pass means the task does not measure anything. */
const noop: Agent = {
  name: "noop",
  async run() {
    return { ok: true, durationMs: 0, summary: "made no changes" };
  },
};

/**
 * Applies the known-good patch. Every task should pass; a failure means the task or its checks are broken.
 * In baseline, hunks for the guidance files the workspace lacks are skipped, as they would be for a real agent.
 */
const reference: Agent = {
  name: "reference",
  async run(task, workspace) {
    const excludes = removedGuidance(workspace).map((path) => ` --exclude="${path}"`).join("");
    const result = await runCommand(`git apply --whitespace=nowarn${excludes} "${referencePatchPath(task.id)}"`, workspace.dir);
    return { ok: result.exitCode === 0, durationMs: result.durationMs, summary: result.output || "applied reference patch" };
  },
};

// Tools the agent may use without prompting. Anything else is denied (dontAsk).
const claudeTools = [
  "Read",
  "Edit",
  "Write",
  "Glob",
  "Grep",
  "Bash(pnpm:*)",
  "Bash(git status:*)",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(ls:*)",
  "mcp__clubkit",
];

/** Claude Code in headless mode, confined to the workspace, with only the workspace's MCP config. */
const claude: Agent = {
  name: "claude",
  run(task, workspace, options) {
    const args = [
      "-p",
      "--output-format", "json",
      "--permission-mode", "dontAsk",
      "--allowedTools", ...claudeTools,
      "--setting-sources", "project",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--max-budget-usd", String(options.maxBudgetUsd),
    ];
    const mcpConfig = join(workspace.dir, ".mcp.json");
    if (existsSync(mcpConfig)) args.push("--mcp-config", mcpConfig);
    if (options.model) args.push("--model", options.model);

    const started = Date.now();
    return new Promise((resolvePromise) => {
      const child = spawn("claude", args, { cwd: workspace.dir });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr = (stderr + chunk).slice(-2000)));
      const timer = setTimeout(() => child.kill(), options.timeoutMs);
      child.on("error", (error) => {
        clearTimeout(timer);
        resolvePromise({ ok: false, durationMs: Date.now() - started, summary: `could not start claude: ${error.message}` });
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        const durationMs = Date.now() - started;
        try {
          const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; total_cost_usd?: number; num_turns?: number };
          resolvePromise({
            ok: exitCode === 0 && !out.is_error,
            durationMs,
            costUsd: out.total_cost_usd,
            turns: out.num_turns,
            summary: (out.result ?? "").slice(-2000),
          });
        } catch {
          resolvePromise({ ok: false, durationMs, summary: `exit ${exitCode}; unparseable output.\n${stdout.slice(-1000)}\n${stderr}` });
        }
      });
      child.stdin.end(task.prompt);
    });
  },
};

export const agents: Record<string, Agent> = { noop, reference, claude };
