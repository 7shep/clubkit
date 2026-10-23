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
  /** Commands that prove the work; the scope must name at least one, e.g. "pnpm verify events" or "pnpm check". */
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
  "goal or background": /goal|objective|summary|overview|problem|why|background|context|purpose|what (already )?exists|current state|today/i,
  "what to build": /^(?!.*(out of|non-goal|not in)).*(scope|deliverable|requirement|build|tasks?\b|work|plan|approach|implementation)/i,
  "out of scope": /out of scope|non-goals?|not (in scope|included)|won'?t|excluded|later/i,
  "acceptance criteria": /acceptance|\bdone\b|success criteria|criteria|finished when/i,
  "open questions or assumptions": /question|assumption|decision|unknown|risk|unresolved|open (items|issues)/i,
};

// Changes the runner makes, not the agent: guidance the baseline variant restores before checks, and the
// lockfile `pnpm install` rewrites because the workspace has no packages/evals.
const notTheAgent = /^(AGENTS\.md|CLAUDE\.md|\.mcp\.json|catalog\.json|pnpm-lock\.yaml|skills\/|docs\/|modules\/[^/]+\/MODULE\.md$)/;

/** Sections by heading. A brief's opening paragraph under its `#` title counts as its summary. */
export function sections(markdown: string): Section[] {
  const found: Section[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bold = line.match(/^\*\*([^*]+)\*\*:?\s*$/);
    if (heading) found.push({ heading: heading[1] === "#" ? "Summary" : heading[2].trim(), body: "" });
    else if (bold) found.push({ heading: bold[1].trim(), body: "" });
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
    // Any module or package it names must be real, unless the same line proposes it as new. packages/evals
    // is the eval harness: removed from the workspace, but the README still mentions it.
    for (const line of text.split(/\r?\n/)) {
      for (const [, kind, name] of line.matchAll(/\b(modules|packages)\/([a-z0-9-]+)/g)) {
        if ((kind === "packages" && name === "evals") || /\bnew\b/i.test(line)) continue;
        expect(existsSync(`${kind}/${name}`), `${kind}/${name} does not exist`).toBe(true);
      }
    }
  });

  it("tells the recipient how to verify the work", () => {
    const text = read();
    expect(spec.commands.some((c) => text.includes(c)), `should name one of: ${spec.commands.join(", ")}`).toBe(true);
  });

  it.each(spec.facts.map((f) => [f.label, f] as const))("covers: %s", (_label, fact) => {
    // Unwrap lines so a fact split across hard-wrapped Markdown still matches.
    expect(read().replace(/\s+/g, " ")).toMatch(fact.pattern);
  });
}
