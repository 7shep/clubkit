import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const MemberSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  pronouns: z.string().optional(),
  email: z.string().email(),
  role: z.string().min(1).describe("Club role, e.g. 'President' or 'Developer'"),
  team: z.string().optional(),
  joinedOn: isoDate.optional(),
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
});
export type Member = z.infer<typeof MemberSchema>;

export const EventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  date: isoDate,
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Expected 24-hour HH:MM")
    .optional(),
  durationMinutes: z.number().int().positive().optional(),
  location: z.string().optional(),
  rsvpCap: z.number().int().positive().optional(),
});
export type Event = z.infer<typeof EventSchema>;

export const ApplicationStatusSchema = z.enum([
  "submitted",
  "reviewing",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  submittedAt: z.string().datetime(),
  fullName: z.string().min(1),
  email: z.string().email(),
  graduationYear: z.number().int().min(2000).max(2100),
  program: z.string().min(1),
  position: z.string().min(1).describe("The role or team applied for"),
  answers: z
    .record(z.string(), z.string())
    .describe("Prompt id -> answer text, defined by the club's application form"),
  resumePath: z.string().optional(),
  consent: z.literal(true),
  status: ApplicationStatusSchema,
});
export type Application = z.infer<typeof ApplicationSchema>;

export const SponsorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  tier: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  logoPath: z.string().optional(),
});
export type Sponsor = z.infer<typeof SponsorSchema>;

// Every email that reaches a real person is drafted, approved by a named exec, then sent once.
export const OutboxStatusSchema = z.enum(["draft", "approved", "sent"]);
export type OutboxStatus = z.infer<typeof OutboxStatusSchema>;

export const OutboxMessageSchema = z.object({
  key: z
    .string()
    .min(1)
    .describe("Idempotency key, e.g. 'decision:<applicationId>'. A key is drafted and sent at most once, ever"),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  status: OutboxStatusSchema,
  createdAt: z.string().datetime(),
  approvedBy: z.string().min(1).optional().describe("The exec who read and approved the message"),
  approvedAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  providerId: z.string().optional().describe("The email provider's id for the sent message"),
});
export type OutboxMessage = z.infer<typeof OutboxMessageSchema>;

/** What a workflow drafts and what an email adapter sends: a message without its outbox state. */
export type OutgoingEmail = Pick<OutboxMessage, "key" | "to" | "subject" | "body">;

export const EmailTemplateSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1).describe("Text with {{field}} placeholders, e.g. {{firstName}}"),
});
export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

/** Registry used by manifests: a module declares the schemas it provides by these names. */
export const sharedSchemas = {
  Member: MemberSchema,
  Event: EventSchema,
  Application: ApplicationSchema,
  Sponsor: SponsorSchema,
  OutboxMessage: OutboxMessageSchema,
  EmailTemplate: EmailTemplateSchema,
} as const;
export type SharedSchemaName = keyof typeof sharedSchemas;
