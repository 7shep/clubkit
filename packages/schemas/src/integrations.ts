import { z } from "zod";
import type { OutgoingEmail } from "./club";

// How clubkit reaches the world. Every integration (email, Discord, Slack, ...) is an
// adapter injected into workflows, with three modes. See docs/integration-spec.md.

export const IntegrationModeSchema = z.enum(["live", "fake", "dry-run"]).describe(
  "live: the real provider. fake: records deliveries as if sent, for tests and evals. " +
    "dry-run: records what would be sent, and the outbox leaves those messages unsent",
);
export type IntegrationMode = z.infer<typeof IntegrationModeSchema>;

/**
 * Delivers one message of type `T`. `message.key` is the outbox idempotency key: a live
 * adapter passes it to the provider as its idempotency key wherever the provider has one.
 */
export interface Adapter<T extends { key: string }> {
  /** The integration's name, e.g. "email" or "discord". */
  readonly integration: string;
  readonly mode: IntegrationMode;
  /** Resolves with the provider's id for the delivery; throws on failure so the caller can re-run. */
  send(message: T): Promise<{ id: string }>;
}

/** Sends one email. Real providers and the test fake implement it; workflows receive it injected. */
export type EmailAdapter = Adapter<OutgoingEmail>;
