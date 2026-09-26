/** A fresh interview has no draft yet — one is only created once the agent
 * agrees to consent (when required) or, for a survey with none, once they
 * enter a respondent and tap Continue — so backing out beforehand leaves
 * nothing behind. Resuming an in-progress draft always carries a real
 * draftId instead. */
export type RespondentCaptureParams =
  | { mode: "new"; assignmentId: string; surveyId: string; surveyTitle: string; versionId: string; schemaHash: string }
  | { mode: "resume"; draftId: string };

/** Every field a fresh interview starts from, before any draft exists —
 * the same shape `RespondentCaptureParams`'s "new" case carries, since
 * ConsentCapture hands off to RespondentCapture with exactly these. */
export type ConsentCaptureParams = {
  assignmentId: string;
  surveyId: string;
  surveyTitle: string;
  versionId: string;
  schemaHash: string;
};

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  ConsentCapture: ConsentCaptureParams;
  RespondentCapture: RespondentCaptureParams;
  FormSection: { draftId: string; sectionIndex: number };
  ReviewSubmit: { draftId: string };
  ResponseDetail: { responseId: string };
};

export type TabParamList = {
  Surveys: undefined;
  MyWork: undefined;
  Sync: undefined;
  Profile: undefined;
};
