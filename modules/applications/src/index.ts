import { renderTemplate } from "@clubkit/outbox";
import {
  ApplicationSchema,
  type Application,
  type ApplicationStatus,
  type EmailTemplate,
  type OutgoingEmail,
} from "@clubkit/schemas";

/** Validate an incoming application. New submissions must arrive with status "submitted". */
export function parseApplication(input: unknown, options: { deadline?: string; now?: Date } = {}): Application {
  const application = ApplicationSchema.parse(input);
  if (application.status !== "submitted") {
    throw new Error(`New applications must have status "submitted", got "${application.status}"`);
  }
  const now = options.now ?? new Date();
  if (options.deadline && now > new Date(options.deadline)) {
    throw new Error(`Applications closed at ${options.deadline}`);
  }
  return application;
}

// The review pipeline as an explicit state machine. Decisions are final; an
// applicant can withdraw from any open state.
const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  submitted: ["reviewing", "rejected", "withdrawn"],
  reviewing: ["interview", "accepted", "rejected", "withdrawn"],
  interview: ["accepted", "rejected", "withdrawn"],
  accepted: [],
  rejected: [],
  withdrawn: [],
};

export function allowedTransitions(status: ApplicationStatus): readonly ApplicationStatus[] {
  return transitions[status];
}

/** Return a copy of the application in its new status, or throw if the move is not allowed. */
export function transition(application: Application, to: ApplicationStatus): Application {
  if (!transitions[application.status].includes(to)) {
    const allowed = transitions[application.status].join(", ") || "none (final)";
    throw new Error(`Cannot move application from "${application.status}" to "${to}". Allowed: ${allowed}`);
  }
  return { ...application, status: to };
}

/** Count applications per status, optionally for one position. Every status appears, even at zero. */
export function pipelineSummary(applications: Application[], position?: string): Record<ApplicationStatus, number> {
  const summary = Object.fromEntries(Object.keys(transitions).map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const application of applications) {
    if (position === undefined || application.position === position) summary[application.status]++;
  }
  return summary;
}

/**
 * One decision email per accepted or rejected applicant, ready for `draft` in the outbox.
 * Withdrawn and undecided applicants get none. The key is `decision:<id>`, so an applicant
 * gets at most one decision email however often this runs. Templates can use
 * {{firstName}}, {{fullName}}, and {{position}}.
 */
export function decisionEmails(
  applications: Application[],
  templates: { accepted: EmailTemplate; rejected: EmailTemplate },
): OutgoingEmail[] {
  return applications.flatMap((application) => {
    if (application.status !== "accepted" && application.status !== "rejected") return [];
    const fields = {
      firstName: application.fullName.trim().split(/\s+/)[0],
      fullName: application.fullName,
      position: application.position,
    };
    return [{ key: `decision:${application.id}`, to: application.email, ...renderTemplate(templates[application.status], fields) }];
  });
}
