/**
 * Query-key factories, one namespace per domain. React Query keys are
 * global cache slots -- two modules picking the same key with different
 * payload shapes is a real, confusing bug, so every module gets its keys
 * from here rather than inlining an array literal at the call site.
 *
 * `params` is typed `object` rather than `Record<string, unknown>` so a
 * concrete filter interface (e.g. `ResponseFilters`, whose fields are all
 * individually optional rather than declared via an index signature) can
 * be passed straight through without a cast at the call site.
 */
export const authKeys = {
  me: () => ["me"] as const,
  permissions: () => ["my-permissions"] as const,
  hub: () => ["hub-overview"] as const,
};

export const categoryKeys = {
  list: () => ["categories"] as const,
};

export const questionBankKeys = {
  list: (params: object) => ["question-bank", params] as const,
};

export const questionBankCategoryKeys = {
  list: () => ["question-bank-categories"] as const,
};

export const surveyKeys = {
  list: (params: object) => ["surveys", params] as const,
  detail: (id: string) => ["survey", id] as const,
  draft: (id: string) => ["survey", id, "draft"] as const,
  versions: (id: string) => ["survey", id, "versions"] as const,
  versionSchema: (id: string, versionNumber: number) => ["survey", id, "version", versionNumber] as const,
  preview: (id: string) => ["survey", id, "preview"] as const,
};

export const assignmentKeys = {
  list: (params: object) => ["assignments", params] as const,
  detail: (id: string) => ["assignment", id] as const,
};

export const respondentKeys = {
  list: (params: object) => ["respondents", params] as const,
  detail: (id: string) => ["respondent", id] as const,
};

export const consentKeys = {
  notices: () => ["consent-notices"] as const,
};

export const responseKeys = {
  list: (params: object) => ["responses", params] as const,
  detail: (id: string) => ["response", id] as const,
};

export const reportKeys = {
  dashboard: (params: object) => ["reports", "dashboard", params] as const,
  surveySummary: (surveyId: string) => ["reports", "survey-summary", surveyId] as const,
};

export const teamKeys = {
  list: () => ["teams"] as const,
};
