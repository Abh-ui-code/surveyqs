"use client";

import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { useMyPermissions } from "@/hooks/use-permissions";
import { apiErrorMessage } from "@/lib/api-client/client";
import { cn } from "@/lib/utils";
import { useSurvey } from "../../_hooks/use-surveys";
import { QuestionField, isQuestionAnswered, type AnswerValue } from "./_components/question-field";
import { RespondentStep } from "./_components/respondent-step";
import {
  SubmissionRejectedError,
  useCaptureConsent,
  useConsentNotices,
  useMyActiveAssignment,
  usePublishedVersions,
  useSubmitResponse,
  useUploadAttachment,
  useVersionSchema,
  type ChoiceListDef,
  type Respondent,
  type SchemaQuestion,
} from "./_hooks/use-collect";

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-6 flex items-center">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i < current
                  ? "bg-brand text-brand-contrast"
                  : i === current
                    ? "border-2 border-brand text-brand-strong"
                    : "border border-line text-ink-faint",
              )}
            >
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm font-medium sm:inline", i <= current ? "text-ink" : "text-ink-faint")}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("mx-3 h-px flex-1", i < current ? "bg-brand" : "bg-line")} />
          )}
        </div>
      ))}
    </div>
  );
}

function displayAnswer(question: SchemaQuestion, value: AnswerValue | undefined, choiceLabel: (code: string, v: string) => string): string {
  if (value === undefined) return "—";
  switch (question.type) {
    case "yes_no":
      return value ? "Yes" : "No";
    case "select_one":
      return choiceLabel(question.config.choice_list as string, value as string);
    case "select_multiple":
      return (value as string[]).map((v) => choiceLabel(question.config.choice_list as string, v)).join(", ");
    case "geopoint": {
      const g = value as { lat: number; lng: number };
      return `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`;
    }
    default:
      return String(value);
  }
}

function CollectContent({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const perms = useMyPermissions();
  const isAdmin = !!(perms.data?.is_admin || perms.data?.is_superadmin);
  const survey = useSurvey(surveyId);
  const assignment = useMyActiveAssignment(surveyId);
  const versions = usePublishedVersions(surveyId);
  const latestVersion = versions.data?.[0];
  const schema = useVersionSchema(surveyId, latestVersion?.version_number);
  const consentNotices = useConsentNotices();
  const captureConsent = useCaptureConsent();
  const submitResponse = useSubmitResponse();
  const uploadAttachment = useUploadAttachment();

  const [startedAt] = useState(() => new Date().toISOString());
  const [step, setStep] = useState(0);
  const [respondent, setRespondent] = useState<Respondent | null>(null);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue | undefined>>({});
  const [imageFiles, setImageFiles] = useState<Record<string, File | undefined>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const choiceLists = useMemo(() => {
    const map: Record<string, ChoiceListDef> = {};
    schema.data?.choice_lists.forEach((cl) => {
      map[cl.name] = cl;
    });
    return map;
  }, [schema.data]);

  const choiceLabel = (listName: string, value: string) => {
    const choice = choiceLists[listName]?.choices.find((c) => c.value === value);
    return choice?.label.en ?? value;
  };

  const questions = useMemo(() => schema.data?.sections.flatMap((s) => s.questions) ?? [], [schema.data]);

  const consentRequired = !!survey.data?.settings?.consent_required && !survey.data?.settings?.anonymous;
  const steps = ["Respondent", ...(consentRequired ? ["Consent"] : []), "Answers", "Review"];
  const answersStepIndex = consentRequired ? 2 : 1;
  const reviewStepIndex = steps.length - 1;

  const stillLoading = survey.isPending || perms.isPending || assignment.isPending || versions.isPending;

  if (stillLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (survey.isError || !survey.data) {
    return <EmptyState title="Couldn't load this survey" description="It may have been removed." />;
  }

  if (survey.data.status !== "published") {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="This survey isn't published"
        description="Ask an administrator to publish it before you can collect responses."
      />
    );
  }

  if (!isAdmin && (!assignment.data || assignment.data.length === 0)) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="You don't have an assignment for this survey"
        description="Ask your supervisor to assign this survey to you before you can collect responses for it."
      />
    );
  }

  if (schema.isPending || !schema.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const activeAssignment = assignment.data?.[0];

  const validateAnswers = (): boolean => {
    const errors: Record<string, string> = {};
    for (const q of questions) {
      if (q.type === "note") continue;
      const value = q.type === "image" ? imageFiles[q.code] : answers[q.code];
      if (!isQuestionAnswered(q, value)) {
        errors[q.code] = "This question is required.";
        continue;
      }
      if (value === undefined) continue;
      if ((q.type === "integer" || q.type === "decimal" || q.type === "rating") && typeof value === "number") {
        const min = q.config.min as number | undefined;
        const max = q.config.max as number | undefined;
        if (min !== undefined && value < min) errors[q.code] = `Must be at least ${min}.`;
        if (max !== undefined && value > max) errors[q.code] = `Must be at most ${max}.`;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(`${Object.keys(errors).length} question(s) need attention`);
      return false;
    }
    return true;
  };

  const goToAnswers = async () => {
    if (consentRequired && step === answersStepIndex - 1) {
      if (!consentAcknowledged) {
        toast.error("Consent must be recorded before continuing.");
        return;
      }
      const notice = consentNotices.data?.results[0];
      if (notice && respondent) {
        try {
          await captureConsent.mutateAsync({
            respondent: respondent.id,
            notice: notice.id,
            method: "verbal_confirmed",
            granted_at: new Date().toISOString(),
          });
        } catch (err) {
          toast.error("Couldn't record consent", { description: apiErrorMessage(err) });
          return;
        }
      }
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = () => {
    const cleanedAnswers: Record<string, unknown> = {};
    for (const [code, value] of Object.entries(answers)) {
      if (value !== undefined) cleanedAnswers[code] = value;
    }
    for (const [code, file] of Object.entries(imageFiles)) {
      if (file) cleanedAnswers[code] = file.name;
    }

    submitResponse.mutate(
      {
        survey_id: surveyId,
        survey_version_id: latestVersion!.id,
        assignment_id: activeAssignment?.id,
        respondent: respondent ? { id: respondent.id } : undefined,
        started_at: startedAt,
        submitted_at: new Date().toISOString(),
        answers: cleanedAnswers,
        was_offline: false,
      },
      {
        onSuccess: async (result) => {
          const uploads = Object.entries(imageFiles).filter(([, f]) => f);
          if (uploads.length > 0 && result.id) {
            try {
              await Promise.all(
                uploads.map(([code, file]) => uploadAttachment.mutateAsync({ responseId: result.id!, questionCode: code, file: file! })),
              );
            } catch {
              toast.warning("Response saved, but one or more photos failed to upload.");
            }
          }
          setSubmittedCode(result.response_code ?? null);
        },
        onError: (err) => {
          if (err instanceof SubmissionRejectedError) {
            if (err.fieldErrors.length > 0) {
              const errors: Record<string, string> = {};
              err.fieldErrors.forEach((fe) => (errors[fe.question_code] = fe.message));
              setFieldErrors(errors);
              setStep(answersStepIndex);
              toast.error("Some answers were rejected", { description: err.message });
            } else {
              toast.error("Couldn't submit response", { description: err.message });
            }
          } else {
            toast.error("Couldn't submit response", { description: apiErrorMessage(err) });
          }
        },
      },
    );
  };

  if (submittedCode) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moss-soft text-moss">
            <Check className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-semibold text-ink">Response submitted</h2>
          <p className="font-mono-data text-sm text-ink-muted">{submittedCode}</p>
          <div className="mt-4 flex w-full gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setStep(0);
                setRespondent(null);
                setConsentAcknowledged(false);
                setAnswers({});
                setImageFiles({});
                setFieldErrors({});
                setSubmittedCode(null);
              }}
            >
              Collect another
            </Button>
            <Button className="flex-1" onClick={() => router.push("/surveys")}>
              Back to surveys
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/surveys" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All surveys
      </Link>
      <h1 className="mb-1 text-xl font-semibold text-ink">{survey.data.title}</h1>
      <p className="mb-6 text-sm text-ink-muted">{survey.data.category.label}</p>

      <Stepper steps={steps} current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who are you interviewing?</CardTitle>
          </CardHeader>
          <CardContent>
            <RespondentStep selected={respondent} onSelect={setRespondent} />
          </CardContent>
        </Card>
      )}

      {consentRequired && step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Consent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {consentNotices.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-md border border-line bg-paper-sunken p-3 text-sm text-ink-muted">
                {consentNotices.data?.results[0]?.text ?? "Read the consent notice aloud to the respondent."}
              </div>
            )}
            <label className="flex items-start gap-2 text-sm text-ink">
              <Checkbox checked={consentAcknowledged} onCheckedChange={(c) => setConsentAcknowledged(c === true)} className="mt-0.5" />
              I have read this notice to the respondent and they have granted consent to proceed.
            </label>
          </CardContent>
        </Card>
      )}

      {step === answersStepIndex && (
        <div className="space-y-4">
          {schema.data.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title.en ?? section.code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    choiceLists={choiceLists}
                    value={answers[q.code]}
                    error={fieldErrors[q.code]}
                    onChange={(v) => setAnswers((a) => ({ ...a, [q.code]: v }))}
                    imageFile={imageFiles[q.code]}
                    onImageChange={(f) => setImageFiles((files) => ({ ...files, [q.code]: f }))}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === reviewStepIndex && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Respondent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink">{respondent?.full_name}</p>
              <p className="text-xs text-ink-muted">{respondent?.phone || respondent?.email || "No contact info"}</p>
            </CardContent>
          </Card>
          {schema.data.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title.en ?? section.code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {section.questions.map((q) => (
                  <div key={q.id} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-ink-muted">{q.label.en}</span>
                    <span className="max-w-[60%] text-right font-medium text-ink">
                      {q.type === "image"
                        ? imageFiles[q.code]?.name ?? "—"
                        : displayAnswer(q, answers[q.code], choiceLabel)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          Back
        </Button>
        {step < reviewStepIndex ? (
          <Button
            onClick={() => {
              if (step === 0 && !respondent) {
                toast.error("Select or add a respondent to continue.");
                return;
              }
              if (step === answersStepIndex) {
                if (!validateAnswers()) return;
                setStep((s) => s + 1);
                return;
              }
              goToAnswers();
            }}
            loading={captureConsent.isPending}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitResponse.isPending || uploadAttachment.isPending}>
            {submitResponse.isPending || uploadAttachment.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Submit response
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CollectResponsePage() {
  const params = useParams<{ id: string }>();
  return (
    <PermissionGate module="responses" action="create" featureName="collecting survey responses">
      <CollectContent surveyId={params.id} />
    </PermissionGate>
  );
}
