import { Badge } from "@/components/ui/badge";

/** Maps a domain status string to a consistent tone + label across the
 * whole app -- survey status, response status and assignment status each
 * get one definitive rendering here rather than being restyled per screen. */
const SURVEY_STATUS: Record<string, { label: string; tone: "neutral" | "brand" | "amber" | "rust" | "moss" }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "brand" },
  paused: { label: "Paused", tone: "amber" },
  closed: { label: "Closed", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
};

const RESPONSE_STATUS: Record<string, { label: string; tone: "neutral" | "brand" | "amber" | "rust" | "moss" }> = {
  submitted: { label: "Submitted", tone: "brand" },
  under_review: { label: "Awaiting review", tone: "amber" },
  approved: { label: "Approved", tone: "moss" },
  rejected: { label: "Rejected", tone: "rust" },
};

const ASSIGNMENT_STATUS: Record<string, { label: string; tone: "neutral" | "brand" | "amber" | "rust" | "moss" }> = {
  active: { label: "Active", tone: "moss" },
  revoked: { label: "Revoked", tone: "neutral" },
};

function renderStatus(map: typeof SURVEY_STATUS, value: string) {
  const entry = map[value] ?? { label: value, tone: "neutral" as const };
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
}

export function SurveyStatusBadge({ status }: { status: string }) {
  return renderStatus(SURVEY_STATUS, status);
}

export function ResponseStatusBadge({ status }: { status: string }) {
  return renderStatus(RESPONSE_STATUS, status);
}

export function AssignmentStatusBadge({ status }: { status: string }) {
  return renderStatus(ASSIGNMENT_STATUS, status);
}
