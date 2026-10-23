import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { agents, type Agent, type AgentOptions, type AgentResult } from "./agents";
import { evalsDir, loadTasks, repoRoot, taskProblems, type Task } from "./tasks";
import { createWorkspace, prepareForChecks, removeWorkspace, runCommand, type CommandResult, type Variant } from "./workspace";

const usage = `Usage: pnpm eval [options]

  --agent <name>       claude (default), noop, or reference
  --variant <name>     clubkit, baseline, or both (default)
  --task <id>          Run only this task; repeatable
  --trials <n>         Attempts per task and variant (default 1)
  --model <model>      Model passed to the agent
  --max-budget <usd>   Per-attempt spend cap for claude (default 2)
  --timeout-min <n>    Per-attempt agent time limit (default 20)
  --keep               Keep workspaces for inspection

Sanity checks: noop must pass nothing and reference must pass everything.`;

interface Attempt {
  task: string;
  tags: string[];
  variant: Variant;
  trial: number;
  passed: boolean;
  agent: AgentResult;
  checks: CommandResult[];
  workspace?: string;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      agent: { type: "string", default: "claude" },
      variant: { type: "string", default: "both" },
      task: { type: "string", multiple: true, default: [] },
      trials: { type: "string", default: "1" },
      model: { type: "string" },
      "max-budget": { type: "string", default: "2" },
      "timeout-min": { type: "string", default: "20" },
      keep: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(usage);
    return 0;
  }

  const agent = agents[values.agent];
  if (!agent) throw new Error(`Unknown agent "${values.agent}". Choose: ${Object.keys(agents).join(", ")}`);
  const variants: Variant[] =
    values.variant === "both" ? ["clubkit", "baseline"] : values.variant === "clubkit" || values.variant === "baseline" ? [values.variant] : [];
  if (variants.length === 0) throw new Error(`Unknown variant "${values.variant}"`);
  const trials = positiveInt(values.trials, "--trials");
  const options = {
    model: values.model,
    maxBudgetUsd: Number(values["max-budget"]),
    timeoutMs: positiveInt(values["timeout-min"], "--timeout-min") * 60_000,
  };

  const tasks = loadTasks(values.task);
  const problems = tasks.flatMap((t) => taskProblems(t).map((p) => `${t.id}: ${p}`));
  if (problems.length > 0) throw new Error(`Unscorable tasks:\n${problems.join("\n")}`);

  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" }).trim() !== "";
  if (dirty) console.warn("! Uncommitted changes are not evaluated: workspaces are built from HEAD.\n");

  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${agent.name}`;
  const runDir = join(tmpdir(), "clubkit-evals", runId);
  mkdirSync(runDir, { recursive: true });
  console.log(`Run ${runId} · agent ${agent.name}${options.model ? ` (${options.model})` : ""} · commit ${commit}\n`);

  const attempts: Attempt[] = [];
  for (const task of tasks) {
    for (const variant of variants) {
      for (let trial = 1; trial <= trials; trial++) {
        const dir = join(runDir, `${task.id}-${variant}-${trial}`);
        const attempt = await runAttempt({ task, variant, trial, dir, agent, options, keep: values.keep });
        attempts.push(attempt);
        const cost = attempt.agent.costUsd === undefined ? "" : ` · $${attempt.agent.costUsd.toFixed(2)}`;
        const failedCheck = attempt.checks.find((c) => c.exitCode !== 0);
        console.log(
          `${attempt.passed ? "✓" : "✗"} ${task.id} [${variant} #${trial}] ${Math.round(attempt.agent.durationMs / 1000)}s${cost}` +
            (failedCheck ? ` · failed: ${failedCheck.command}` : ""),
        );
      }
    }
  }

  const summary = Object.fromEntries(
    variants.map((variant) => {
      const mine = attempts.filter((a) => a.variant === variant);
      const passed = mine.filter((a) => a.passed).length;
      const cost = mine.reduce((sum, a) => sum + (a.agent.costUsd ?? 0), 0);
      return [variant, { passed, total: mine.length, rate: mine.length ? passed / mine.length : 0, costUsd: cost }];
    }),
  );

  console.log("");
  for (const [variant, s] of Object.entries(summary)) {
    console.log(`${variant.padEnd(9)} ${s.passed}/${s.total} passed (${Math.round(s.rate * 100)}%)${s.costUsd ? ` · $${s.costUsd.toFixed(2)}` : ""}`);
  }

  if (!values.keep) rmSync(runDir, { recursive: true, force: true });

  const resultsDir = join(evalsDir, "results");
  mkdirSync(resultsDir, { recursive: true });
  const resultsPath = join(resultsDir, `${runId}.json`);
  const meta = { runId, agent: agent.name, model: options.model ?? null, commit, dirty, trials, date: new Date().toISOString(), node: process.version };
  writeFileSync(resultsPath, JSON.stringify({ ...meta, summary, attempts }, null, 2) + "\n");
  console.log(`\nResults: ${resultsPath}`);

  // Sanity agents fail the command when the task set stops discriminating.
  if (agent.name === "noop") return attempts.some((a) => a.passed) ? 1 : 0;
  if (agent.name === "reference") return attempts.every((a) => a.passed) ? 0 : 1;
  return 0;
}

interface AttemptSpec {
  task: Task;
  variant: Variant;
  trial: number;
  dir: string;
  agent: Agent;
  options: AgentOptions;
  keep: boolean;
}

async function runAttempt({ task, variant, trial, dir, agent, options, keep }: AttemptSpec): Promise<Attempt> {
  const workspace = createWorkspace(dir, variant, task);
  try {
    const install = await runCommand("pnpm install --prefer-offline --reporter=silent", dir);
    if (install.exitCode !== 0) throw new Error(`pnpm install failed in ${dir}:\n${install.output}`);

    const agentResult = await agent.run(task, workspace, options);

    prepareForChecks(workspace, task);
    const checks = [await runCommand("pnpm install --prefer-offline --reporter=silent", dir)];
    for (const command of task.checks) checks.push(await runCommand(command, dir));
    return {
      task: task.id,
      tags: task.tags,
      variant,
      trial,
      passed: checks.every((c) => c.exitCode === 0),
      agent: agentResult,
      checks,
      workspace: keep ? dir : undefined,
    };
  } finally {
    if (!keep) removeWorkspace(workspace);
  }
}

function positiveInt(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} must be a positive integer`);
  return n;
}

main()
  .then((code) => (process.exitCode = code))
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
