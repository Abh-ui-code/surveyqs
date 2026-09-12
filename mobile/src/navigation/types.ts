/** A fresh interview has no draft yet — one is only created once the agent
 * enters a respondent and taps Continue, so backing out beforehand leaves
 * nothing behind. Resuming an in-progress draft, or editing a rejected
 * response, always carries a real draftId instead. */
export type RespondentCaptureParams =
  | { mode: "new"; assignmentId: string; surveyId: string; surveyTitle: string; versionId: string; schemaHash: string }
  | { mode: "resume"; draftId: string };

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
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
