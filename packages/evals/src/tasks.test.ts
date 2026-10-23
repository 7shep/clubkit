import { describe, expect, it } from "vitest";
import { loadTasks, taskProblems } from "./tasks";

describe("eval tasks", () => {
  const tasks = loadTasks();

  it("all parse and have unique ids", () => {
    expect(tasks.length).toBeGreaterThan(0);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
  });

  it.each(tasks.map((t) => [t.id, t] as const))("%s has hidden tests and a reference solution", (_id, task) => {
    expect(taskProblems(task)).toEqual([]);
    expect(task.checks).toContain("pnpm vitest run eval-hidden");
  });
});
