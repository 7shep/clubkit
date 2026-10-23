import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildCatalog, findModule, loadModules, readModuleDocs, repoRoot, verifyModule } from "@clubkit/catalog";

// Read-mostly MCP surface over the monorepo. Agents discover modules here, read
// their contracts, and verify their work; they edit files with their own tools.
const skillsDir = join(repoRoot, "skills");

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const failure = (message: string) => ({ ...text(message), isError: true });

const server = new McpServer({ name: "clubkit", version: "0.1.0" });

server.tool(
  "list_modules",
  "List every clubkit module with its status, summary, and when to use it. Start here.",
  {},
  async () => {
    const { modules, problems } = loadModules();
    return text({ ...buildCatalog(modules), problems });
  },
);

server.tool(
  "get_module",
  "Get one module's full manifest and its MODULE.md usage guide.",
  { name: z.string().describe("Module name from list_modules") },
  async ({ name }) => {
    const module = findModule(name);
    if (!module) return failure(`Unknown module "${name}". Call list_modules for valid names.`);
    return text(`# manifest\n${JSON.stringify(module.manifest, null, 2)}\n\n${readModuleDocs(module)}`);
  },
);

server.tool(
  "verify_module",
  "Run a module's declared verify command and return pass/fail with output. Use after changing a module.",
  { name: z.string() },
  async ({ name }) => {
    const module = findModule(name);
    if (!module) return failure(`Unknown module "${name}".`);
    const result = await verifyModule(module);
    return result.ok ? text(result) : { ...text(result), isError: true };
  },
);

server.tool("list_skills", "List step-by-step playbooks for common club tasks.", {}, async () => {
  const skills = readdirSync(skillsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const firstLine = readFileSync(join(skillsDir, file), "utf8").split("\n")[0] ?? "";
      return { name: file.replace(/\.md$/, ""), title: firstLine.replace(/^#\s*/, "") };
    });
  return text(skills);
});

server.tool(
  "read_skill",
  "Read one playbook from list_skills.",
  { name: z.string().regex(/^[a-z0-9-]+$/) },
  async ({ name }) => {
    try {
      return text(readFileSync(join(skillsDir, `${name}.md`), "utf8"));
    } catch {
      return failure(`Unknown skill "${name}". Call list_skills for valid names.`);
    }
  },
);

await server.connect(new StdioServerTransport());
