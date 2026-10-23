import { findModule, loadModules, verifyModule, writeCatalog } from "@clubkit/catalog";

const usage = `Usage: pnpm clubkit <command>

Commands:
  list              List modules and their status
  validate          Check every module manifest; exit 1 on problems
  catalog           Validate, then regenerate catalog.json
  verify [module]   Run one module's verify command, or every non-planned module's`;

async function main(argv: string[]): Promise<number> {
  const [command, arg] = argv;
  const { modules, problems } = loadModules();

  switch (command) {
    case "list":
      for (const { manifest } of modules) {
        console.log(`${manifest.name.padEnd(14)} ${manifest.status.padEnd(13)} ${manifest.summary}`);
      }
      return 0;

    case "validate":
    case "catalog": {
      if (problems.length > 0) {
        for (const p of problems) console.error(`✗ ${p.module}: ${p.message}`);
        return 1;
      }
      console.log(`✓ ${modules.length} module manifests valid`);
      if (command === "catalog") {
        writeCatalog(modules);
        console.log("✓ wrote catalog.json");
      }
      return 0;
    }

    case "verify": {
      const targets = arg
        ? [findModule(arg)].filter((m) => m !== undefined)
        : modules.filter((m) => m.manifest.status !== "planned");
      if (arg && targets.length === 0) {
        console.error(`Unknown module "${arg}"`);
        return 1;
      }
      let failed = 0;
      for (const module of targets) {
        const result = await verifyModule(module);
        console.log(`${result.ok ? "✓" : "✗"} ${result.module}`);
        if (!result.ok) {
          failed++;
          console.log(result.output);
        }
      }
      return failed === 0 ? 0 : 1;
    }

    default:
      console.log(usage);
      return command ? 1 : 0;
  }
}

process.exitCode = await main(process.argv.slice(2));
