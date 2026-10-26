import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileRecorder, createRecorder, requireEnv } from "./index";

type Post = { key: string; body: string };
const post = (n: number): Post => ({ key: `post:${n}`, body: `Hello ${n}` });

describe("integration helpers", () => {
  it("records deliveries with the integration's name and mode", async () => {
    const fake = createRecorder<Post>("discord", "fake");
    expect(await fake.send(post(1))).toEqual({ id: "fake-discord-1" });
    expect(fake).toMatchObject({ integration: "discord", mode: "fake", delivered: [post(1)] });

    const preview = createRecorder<Post>("discord", "dry-run");
    expect(await preview.send(post(1))).toEqual({ id: "dry-run-discord-1" });
  });

  it("fails chosen sends, naming the integration and key", async () => {
    const flaky = createRecorder<Post>("slack", "fake", { failOn: (p) => p.key === "post:2" });
    await flaky.send(post(1));
    await expect(flaky.send(post(2))).rejects.toThrow("Fake slack failure sending post:2");
    expect(flaky.delivered).toEqual([post(1)]);
  });

  it("appends deliveries to a file", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "clubkit-recorder-")), "delivered.json");
    const file = createFileRecorder<Post>("email", path);
    await file.send(post(1));
    expect(await file.send(post(2))).toEqual({ id: "fake-email-2" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([post(1), post(2)]);
  });

  it("returns credentials, or names every missing one without printing any value", () => {
    const env = { DISCORD_BOT_TOKEN: " secret-token ", DISCORD_GUILD_ID: "" };
    expect(requireEnv("discord", ["DISCORD_BOT_TOKEN"], { env })).toEqual({ DISCORD_BOT_TOKEN: "secret-token" });

    const missing = () => requireEnv("discord", ["DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID", "DISCORD_APP_ID"], { env, guide: "docs/setup/discord.md" });
    expect(missing).toThrow(
      "The discord integration needs DISCORD_GUILD_ID, DISCORD_APP_ID in .env, and they are missing. See docs/setup/discord.md for how to get them.",
    );
    expect(missing).not.toThrow(/secret-token/);
  });
});
