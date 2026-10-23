import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { ModuleManifestSchema, sharedSchemas, type ModuleManifest } from "@clubkit/schemas";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const modulesDir = join(repoRoot, "modules");
export const catalogPath = join(repoRoot, "catalog.json");

export interface LoadedModule {
  dir: string;
  manifest: ModuleManifest;
}

export interface CatalogProblem {
  module: string;
  message: string;
}

/** Read and validate every `modules/<name>/module.json`. Invalid manifests become problems, not throws. */
export function loadModules(): { modules: LoadedModule[]; problems: CatalogProblem[] } {
  const modules: LoadedModule[] = [];
  const problems: CatalogProblem[] = [];

  for (const entry of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(modulesDir, entry.name);
    const manifestPath = join(dir, "module.json");
    if (!existsSync(manifestPath)) {
      problems.push({ module: entry.name, message: "missing module.json" });
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (error) {
      problems.push({ module: entry.name, message: `module.json is not valid JSON: ${String(error)}` });
      continue;
    }

    const parsed = ModuleManifestSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({ module: entry.name, message: `${issue.path.join(".") || "(root)"}: ${issue.message}` });
      }
      continue;
    }
    if (parsed.data.name !== entry.name) {
      problems.push({ module: entry.name, message: `name "${parsed.data.name}" must match its folder` });
    }
    modules.push({ dir, manifest: parsed.data });
  }

  problems.push(...crossCheck(modules));
  modules.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  return { modules, problems };
}

function crossCheck(modules: LoadedModule[]): CatalogProblem[] {
  const problems: CatalogProblem[] = [];
  const names = new Set(modules.map((m) => m.manifest.name));

  for (const { dir, manifest } of modules) {
    const report = (message: string) => problems.push({ module: manifest.name, message });

    for (const dep of manifest.requires) {
      if (!names.has(dep)) report(`requires unknown module "${dep}"`);
    }
    for (const schema of manifest.provides.schemas) {
      if (!(schema in sharedSchemas)) report(`provides unknown schema "${schema}"`);
    }
    if (!existsSync(join(dir, manifest.docs))) report(`docs file ${manifest.docs} is missing`);
    for (const migration of manifest.provides.migrations) {
      if (!existsSync(join(dir, migration))) report(`migration ${migration} is missing`);
    }
    if (manifest.status !== "planned" && !manifest.verify) {
      report(`${manifest.status} modules must declare a verify command`);
    }
  }
  return problems;
}

export interface CatalogEntry {
  name: string;
  status: ModuleManifest["status"];
  version: string;
  summary: string;
  useWhen: string[];
  requires: string[];
  schemas: string[];
  path: string;
}

/** The compact index agents read first; full detail lives in each module's manifest and docs. */
export function buildCatalog(modules: LoadedModule[]): { generatedBy: string; modules: CatalogEntry[] } {
  return {
    generatedBy: "pnpm catalog — do not edit by hand",
    modules: modules.map(({ manifest }) => ({
      name: manifest.name,
      status: manifest.status,
      version: manifest.version,
      summary: manifest.summary,
      useWhen: manifest.useWhen,
      requires: manifest.requires,
      schemas: manifest.provides.schemas,
      path: `modules/${manifest.name}`,
    })),
  };
}

export function writeCatalog(modules: LoadedModule[]): void {
  writeFileSync(catalogPath, JSON.stringify(buildCatalog(modules), null, 2) + "\n");
}

export function findModule(name: string): LoadedModule | undefined {
  return loadModules().modules.find((m) => m.manifest.name === name);
}

export function readModuleDocs(module: LoadedModule): string {
  return readFileSync(join(module.dir, module.manifest.docs), "utf8");
}

export interface VerifyResult {
  module: string;
  ok: boolean;
  command?: string;
  exitCode: number | null;
  output: string;
}

/** Run a module's declared verify command from the repo root and capture its output. */
export function verifyModule(module: LoadedModule): Promise<VerifyResult> {
  const { name, verify } = module.manifest;
  if (!verify) {
    return Promise.resolve({ module: name, ok: false, exitCode: null, output: "No verify command declared." });
  }
  return new Promise((resolvePromise) => {
    const child = spawn(verify, { cwd: repoRoot, shell: true });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (exitCode) => {
      resolvePromise({ module: name, ok: exitCode === 0, command: verify, exitCode, output });
    });
  });
}
