import { z } from "zod";

// The contract every module's `module.json` must satisfy. See docs/module-spec.md.
export const ModuleManifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "Lowercase kebab-case"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Semver"),
  status: z.enum(["stable", "experimental", "planned"]),
  summary: z.string().min(10).max(200),
  useWhen: z.array(z.string()).min(1).describe("Tasks an agent should reach for this module for"),
  provides: z.object({
    schemas: z.array(z.string()).default([]),
    exports: z.array(z.string()).default([]),
    migrations: z.array(z.string()).default([]),
  }),
  requires: z.array(z.string()).default([]).describe("Other module names this module depends on"),
  config: z
    .record(
      z.string(),
      z.object({
        type: z.enum(["string", "number", "boolean"]),
        description: z.string(),
        required: z.boolean().default(false),
        default: z.union([z.string(), z.number(), z.boolean()]).optional(),
      }),
    )
    .default({}),
  verify: z.string().optional().describe("Shell command, run from the repo root, that proves the module works"),
  docs: z.string().default("MODULE.md"),
});
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;
