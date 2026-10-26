import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Adapter } from "@clubkit/schemas";

// Shared pieces every integration builds on: recorders for its fake and dry-run modes,
// and credential checks that say what's missing without ever printing a secret.

export type Recorder<T extends { key: string }> = Adapter<T> & { delivered: T[] };

/**
 * An adapter that records messages in memory instead of delivering them. Use mode "fake" in
 * tests and evals; mode "dry-run" to preview a send. `failOn` makes chosen sends throw.
 */
export function createRecorder<T extends { key: string }>(
  integration: string,
  mode: "fake" | "dry-run",
  options: { failOn?: (message: T) => boolean } = {},
): Recorder<T> {
  const delivered: T[] = [];
  return {
    integration,
    mode,
    delivered,
    async send(message) {
      if (options.failOn?.(message)) throw new Error(`Fake ${integration} failure sending ${message.key}`);
      delivered.push(message);
      return { id: `${mode}-${integration}-${delivered.length}` };
    },
  };
}

/** A fake adapter that appends each message to a JSON file, so a CLI run's deliveries can be read afterwards. */
export function createFileRecorder<T extends { key: string }>(integration: string, path: string): Adapter<T> {
  return {
    integration,
    mode: "fake",
    async send(message) {
      const delivered = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T[]) : [];
      delivered.push(message);
      writeFileSync(path, JSON.stringify(delivered, null, 2) + "\n");
      return { id: `fake-${integration}-${delivered.length}` };
    },
  };
}

/**
 * Read an integration's credentials from the environment. Throws naming every missing
 * variable and where to set it up; values are never included in errors or output.
 */
export function requireEnv<Name extends string>(
  integration: string,
  names: readonly Name[],
  options: { env?: Record<string, string | undefined>; guide?: string } = {},
): Record<Name, string> {
  const env = options.env ?? process.env;
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    const guide = options.guide ? ` See ${options.guide} for how to get ${missing.length === 1 ? "it" : "them"}.` : "";
    throw new Error(`The ${integration} integration needs ${missing.join(", ")} in .env, and ${missing.length === 1 ? "it is" : "they are"} missing.${guide}`);
  }
  return Object.fromEntries(names.map((name) => [name, env[name]!.trim()])) as Record<Name, string>;
}
