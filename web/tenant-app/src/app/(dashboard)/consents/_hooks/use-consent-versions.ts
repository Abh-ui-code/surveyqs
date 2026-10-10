"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-client/client";

export interface ConsentSurveySummary {
  survey_id: string;
  title: string;
  category_label: string;
  survey_status: string;
  consent_required: boolean;
  versions: number;
  latest_version: number | null;
  latest_uploaded_at: string | null;
  latest_has_file: boolean;
  consents: number;
  withdrawn: number;
  last_consent_at: string | null;
}

export interface ConsentVersionsOverview {
  totals: { surveys: number; with_consent: number; versions: number; consents: number };
  surveys: ConsentSurveySummary[];
}

export interface ConsentVersion {
  id: string;
  version_number: number;
  language: string;
  uploaded_at: string;
  is_latest: boolean;
  /** The version the survey is using right now (always the latest in practice). */
  is_current: boolean;
  has_file: boolean;
  filename: string | null;
  text: string;
  consents: number;
  withdrawn: number;
  first_consent_at: string | null;
  last_consent_at: string | null;
}

export interface ConsentSurveyDetail {
  survey: { id: string; title: string; category_label: string; status: string; consent_required: boolean };
  totals: { versions: number; latest_version: number | null; consents: number; withdrawn: number; respondents: number };
  versions: ConsentVersion[];
}

export interface ConsentRecordRow {
  id: string;
  respondent: string | null;
  respondent_name: string | null;
  version_number: number | null;
  method: string;
  granted_at: string;
  captured_by_name: string | null;
  captured_offline: boolean;
  is_withdrawn: boolean;
  signature_url: string | null;
  response_count: number;
}

export function useConsentVersions() {
  return useQuery({
    queryKey: ["consent-versions"],
    queryFn: () => api.get<ConsentVersionsOverview>("/consent-versions/"),
  });
}

export function useConsentSurvey(surveyId: string) {
  return useQuery({
    queryKey: ["consent-versions", surveyId],
    queryFn: () => api.get<ConsentSurveyDetail>(`/consent-versions/${surveyId}/`),
    enabled: !!surveyId,
  });
}

export function useConsentRecords(surveyId: string, params: { version?: number; page: number; page_size: number }) {
  return useQuery({
    queryKey: ["consent-versions", surveyId, "records", params],
    queryFn: () =>
      api.list<ConsentRecordRow>(`/consent-versions/${surveyId}/records/`, {
        version: params.version,
        page: params.page,
        page_size: params.page_size,
      }),
    enabled: !!surveyId,
    placeholderData: (prev) => prev,
  });
}

function filenameFromContentDisposition(value: string | undefined): string | undefined {
  return value ? /filename="?([^"]+)"?/.exec(value)?.[1] : undefined;
}

/** Downloads one version's document -- the uploaded file as-is, or the text
 * as a .txt when it was typed in rather than uploaded. Fetched through the
 * API client (not a bare link) so the request carries the auth token. */
export function useDownloadConsentVersion() {
  return useMutation({
    mutationFn: async ({ noticeId, fallbackName }: { noticeId: string; fallbackName: string }) => {
      const { blob, headers } = await api.getBlob(`/consent-versions/notices/${noticeId}/download/`);
      const filename = filenameFromContentDisposition(headers["content-disposition"]) ?? fallbackName;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: (err) => toast.error("Couldn't download the document", { description: apiErrorMessage(err) }),
  });
}
