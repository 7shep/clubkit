import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const evalsDir = join(repoRoot, "evals");

export const TaskSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  prompt: z.string().min(20),
  modules: z.array(z.string()).min(1),
  checks: z.array(z.string()).min(1).describe("Run from the workspace root after hidden tests are copied in"),
});
export type Task = z.infer<typeof TaskSchema>;

export const hiddenTestPath = (id: string) => join(evalsDir, "hidden", `${id}.eval.ts`);
export const referencePatchPath = (id: string) => join(evalsDir, "reference", `${id}.patch`);

/** Load every task, or only `ids` (in the order given). Throws on an invalid file or unknown id. */
export function loadTasks(ids: string[] = []): Task[] {
  const dir = join(evalsDir, "tasks");
  const tasks = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const task = TaskSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
      if (`${task.id}.json` !== file) throw new Error(`${file}: id "${task.id}" must match the filename`);
      return task;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  if (ids.length === 0) return tasks;
  return ids.map((id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) throw new Error(`Unknown task "${id}". Known: ${tasks.map((t) => t.id).join(", ")}`);
    return task;
  });
}

/** Problems that would make a task unscorable: missing hidden tests or reference solution. */
export function taskProblems(task: Task): string[] {
  const problems: string[] = [];
  if (!existsSync(hiddenTestPath(task.id))) problems.push(`missing evals/hidden/${task.id}.eval.ts`);
  if (!existsSync(referencePatchPath(task.id))) problems.push(`missing evals/reference/${task.id}.patch`);
  return problems;
}
