import { existsSync, readFileSync } from "node:fs";
import { ClubConfigSchema, type Approver, type ClubConfig, type ModuleManifest } from "@clubkit/schemas";
import type { CatalogProblem, LoadedModule } from "./index";

type Setting = string | number | boolean;

/**
 * Read and validate a club config, then check its `modules` section against the module manifests.
 * Problems name the field and what is allowed, so an agent can fix the file and re-run.
 */
export function loadClubConfig(path: string, modules: LoadedModule[]): { config?: ClubConfig; problems: CatalogProblem[] } {
  if (!existsSync(path)) {
    return { problems: [{ module: "club.config.json", message: `${path} does not exist. Copy club.config.example.json and fill it in` }] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { problems: [{ module: "club.config.json", message: `not valid JSON: ${String(error)}` }] };
  }
  const parsed = ClubConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map((issue) => ({ module: "club.config.json", message: `${issue.path.join(".") || "(root)"}: ${issue.message}` })),
    };
  }
  return { config: parsed.data, problems: checkModuleConfig(parsed.data, modules) };
}

/** Every `modules.<name>.<key>` must exist in that module's manifest with the declared type; required keys must resolve. */
export function checkModuleConfig(config: ClubConfig, modules: LoadedModule[]): CatalogProblem[] {
  const problems: CatalogProblem[] = [];
  const byName = new Map(modules.map((m) => [m.manifest.name, m.manifest]));

  for (const [name, settings] of Object.entries(config.modules)) {
    const report = (message: string) => problems.push({ module: "club.config.json", message: `modules.${name}${message}` });
    const manifest = byName.get(name);
    if (!manifest) {
      report(`: no module named "${name}". Known modules: ${[...byName.keys()].join(", ")}`);
      continue;
    }
    const allowed = Object.keys(manifest.config);
    for (const [key, value] of Object.entries(settings)) {
      const spec = manifest.config[key];
      if (!spec) {
        report(`.${key}: ${name} has no setting "${key}". Allowed: ${allowed.join(", ") || "none"}`);
      } else if (typeof value !== spec.type) {
        report(`.${key}: expected a ${spec.type}, got ${JSON.stringify(value)}`);
      }
    }
  }

  for (const manifest of byName.values()) {
    if (manifest.status === "planned") continue;
    const resolved = moduleConfig(config, manifest);
    for (const [key, spec] of Object.entries(manifest.config)) {
      if (spec.required && resolved[key] === undefined) {
        problems.push({ module: "club.config.json", message: `modules.${manifest.name}.${key} is required: ${spec.description}` });
      }
    }
  }
  return problems;
}

/**
 * A module's settings for this club. Each key comes from `modules.<name>.<key>`, else a
 * top-level club field of the same name and type (e.g. `timezone`), else the manifest default.
 */
export function moduleConfig(config: ClubConfig, manifest: ModuleManifest): Record<string, Setting> {
  const explicit = config.modules[manifest.name] ?? {};
  const clubWide = config as unknown as Record<string, unknown>;
  const resolved: Record<string, Setting> = {};
  for (const [key, spec] of Object.entries(manifest.config)) {
    const inherited = typeof clubWide[key] === spec.type ? (clubWide[key] as Setting) : undefined;
    const value = explicit[key] ?? inherited ?? spec.default;
    if (value !== undefined) resolved[key] = value;
  }
  return resolved;
}

/** The club approver called `name`, ignoring case and surrounding spaces, or undefined if there is none. */
export function findApprover(config: ClubConfig, name: string): Approver | undefined {
  const wanted = name.trim().toLowerCase();
  return config.approvers.find((a) => a.name.toLowerCase() === wanted);
}
