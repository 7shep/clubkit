import { z } from "zod";
import { EmailTemplateSchema } from "./club";

// One club's settings, in `club.config.json` at the repo root. An agent writes it by
// asking the execs questions; workflows and module `config` fields read from it.

function isTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const ApproverSchema = z
  .object({
    name: z.string().trim().min(1).describe("How the exec signs approvals, e.g. 'Priya Shah'"),
    role: z.string().min(1).optional().describe("Their exec role, e.g. 'President'"),
    discordId: z.string().regex(/^\d{17,20}$/, "Discord user id: 17–20 digits (Developer Mode → Copy User ID)").optional(),
    slackId: z.string().regex(/^[UW][A-Z0-9]+$/, "Slack member id, e.g. U012AB3CD (Profile → Copy member ID)").optional(),
  })
  .strict();
export type Approver = z.infer<typeof ApproverSchema>;

export const ChannelSchema = z
  .object({
    platform: z.enum(["discord", "slack"]),
    id: z.string().min(1).describe("The platform's channel id, not its display name"),
    name: z.string().min(1).optional().describe("Display name, for humans reading the config"),
  })
  .strict();
export type Channel = z.infer<typeof ChannelSchema>;

const ModuleSettingsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export const ClubConfigSchema = z
  .object({
    name: z.string().min(1).describe("The club's full name"),
    shortName: z.string().min(1).optional().describe("What members call it, e.g. 'QWeb'"),
    timezone: z.string().refine(isTimezone, "Expected an IANA timezone, e.g. 'America/Toronto'"),
    websiteUrl: z.string().url().optional(),
    approvers: z
      .array(ApproverSchema)
      .min(1, "List at least one exec who can approve messages before they go out")
      .describe("The only execs who may approve outbox messages"),
    channels: z
      .record(z.string(), ChannelSchema)
      .default({})
      .describe("Named channels. Workflows use 'announcements' for posts and 'approvals' for exec review"),
    positions: z.array(z.string().min(1)).default([]).describe("Roles applicants can apply for"),
    templates: z
      .record(z.string(), EmailTemplateSchema)
      .default({})
      .describe("Named message templates, e.g. 'decision-accepted' and 'decision-rejected'"),
    branding: z
      .object({
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex colour, e.g. '#1f6feb'").optional(),
        logoPath: z.string().min(1).optional(),
      })
      .strict()
      .default({}),
    modules: z
      .record(z.string(), ModuleSettingsSchema)
      .default({})
      .describe("Per-module settings, keyed by module name; keys must match the module manifest's config"),
  })
  .strict()
  .superRefine((config, ctx) => {
    const seen = new Set<string>();
    config.approvers.forEach((approver, i) => {
      const name = approver.name.toLowerCase();
      if (seen.has(name)) ctx.addIssue({ code: "custom", path: ["approvers", i, "name"], message: `Approver "${approver.name}" is listed twice` });
      seen.add(name);
    });
  });
export type ClubConfig = z.infer<typeof ClubConfigSchema>;
