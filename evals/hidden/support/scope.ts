// Shared checks for "hand out work" tasks, where the agent writes a scope for
// someone else instead of building the feature. Copied to eval-hidden/support/.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

export interface Fact {
  /** What the recipient would be missing without it, shown when the check fails. */
  label: string;
  pattern: RegExp;
}

export interface ScopeSpec {
  path: string;
  /** Modules the work touches; the scope must point at `modules/<name>`. */
  modules: string[];
  /** Commands the recipient must run to prove the work, e.g. "pnpm verify events". */
  commands: string[];
  /** Task-specific facts a recipient needs: requirements from the ask and constraints in the repo. */
  facts: Fact[];
}

interface Section {
  heading: string;
  body: string;
}

// Each section a recipient needs, by the headings people commonly use for it.
const requiredSections: Record<string, RegExp> = {
  "goal or background": /goal|objective|summary|overview|problem|why|background|context|purpose/i,
  "what to build": /^(?!.*(out of|non-goal|not in)).*(scope|deliverable|requirement|what to build|tasks?\b|work|plan|approach|implementation)/i,
  "out of scope": /out of scope|non-goals?|not (in scope|included)|won'?t|excluded|later/i,
  "acceptance criteria": /acceptance|definition of done|done when|success criteria|criteria/i,
  "open questions or assumptions": /question|assumption|decision|unknown|risk|unresolved/i,
};

// Changes the runner makes, not the agent: guidance the baseline variant restores before checks, and the
// lockfile `pnpm install` rewrites because the workspace has no packages/evals.
const notTheAgent = /^(AGENTS\.md|CLAUDE\.md|\.mcp\.json|catalog\.json|pnpm-lock\.yaml|skills\/|docs\/|modules\/[^/]+\/MODULE\.md$)/;

export function sections(markdown: string): Section[] {
  const found: Section[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^\*\*([^*]+)\*\*:?\s*$/);
    if (heading) found.push({ heading: heading[1].trim(), body: "" });
    else if (found.length > 0) found[found.length - 1].body += `${line}\n`;
  }
  return found;
}

const listItems = (body: string) => body.split(/\r?\n/).filter((l) => /^\s*([-*+]|\d+[.)])\s+\S/.test(l)).length;
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Paths the agent changed, ignoring the hidden tests and guidance the runner restored. */
function changedPaths(): string[] {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
  return status
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, "").split(" -> ").pop()!)
    .filter((path) => !path.startsWith("eval-hidden/") && !notTheAgent.test(path));
}

/** Register the standard checks for a scope document. Call inside `describe`. */
export function checkScope(spec: ScopeSpec): void {
  const read = () => {
    expect(existsSync(spec.path), `${spec.path} should exist`).toBe(true);
    return readFileSync(spec.path, "utf8");
  };

  it("hands the work off instead of doing it: only the scope file changed", () => {
    expect(changedPaths()).toEqual([spec.path]);
  });

  it("is a readable brief, not a stub or an essay", () => {
    const text = read();
    expect(text).toMatch(/^#\s+\S/m);
    const count = words(text);
    expect(count, "word count").toBeGreaterThanOrEqual(200);
    expect(count, "word count").toBeLessThanOrEqual(2000);
    expect(text).not.toMatch(/lorem ipsum|\[insert|<placeholder>|\bxxx\b/i);
  });

  it("has every section a recipient needs", () => {
    const headings = sections(read()).map((s) => s.heading);
    for (const [name, pattern] of Object.entries(requiredSections)) {
      expect(headings.some((h) => pattern.test(h)), `missing a "${name}" section; headings: ${headings.join(" | ")}`).toBe(true);
    }
  });

  it("explains the goal and makes acceptance criteria checkable", () => {
    const all = sections(read());
    const goal = all.filter((s) => requiredSections["goal or background"].test(s.heading));
    expect(Math.max(...goal.map((s) => words(s.body))), "goal/background words").toBeGreaterThanOrEqual(25);
    const criteria = all.filter((s) => requiredSections["acceptance criteria"].test(s.heading));
    expect(Math.max(...criteria.map((s) => listItems(s.body))), "acceptance criteria items").toBeGreaterThanOrEqual(3);
    const out = all.filter((s) => requiredSections["out of scope"].test(s.heading));
    expect(Math.max(...out.map((s) => listItems(s.body) || (words(s.body) > 5 ? 1 : 0))), "out-of-scope items").toBeGreaterThanOrEqual(1);
  });

  it("points at the right code and only at code that exists", () => {
    const text = read();
    for (const name of spec.modules) expect(text, `should point at modules/${name}`).toContain(`modules/${name}`);
    // Any module or package it names must be real; new files inside them are fine.
    for (const [, kind, name] of text.matchAll(/\b(modules|packages)\/([a-z0-9-]+)/g)) {
      expect(existsSync(`${kind}/${name}`), `${kind}/${name} does not exist`).toBe(true);
    }
  });

  it("tells the recipient how to verify the work", () => {
    const text = read();
    for (const command of spec.commands) expect(text, `should say to run "${command}"`).toContain(command);
  });

  it.each(spec.facts.map((f) => [f.label, f] as const))("covers: %s", (_label, fact) => {
    // Unwrap lines so a fact split across hard-wrapped Markdown still matches.
    expect(read().replace(/\s+/g, " ")).toMatch(fact.pattern);
  });
}
