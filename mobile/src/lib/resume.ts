import type { InterviewDraft } from "./drafts-store";
import type { RootStackParamList } from "@/navigation/types";

/** Where "Resume" should land, given how far a draft got — respondent is
 * the one gate before the form itself. */
export function resumeRouteFor(draft: InterviewDraft): {
  name: keyof RootStackParamList;
  params: RootStackParamList[keyof RootStackParamList];
} {
  if (!draft.respondent) return { name: "RespondentCapture", params: { mode: "resume", draftId: draft.id } };
  return { name: "FormSection", params: { draftId: draft.id, sectionIndex: draft.currentSectionIndex } };
}
