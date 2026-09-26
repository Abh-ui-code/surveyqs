"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GripVertical, Pencil, Plus, Trash2, UserCog } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { branchParentCode, sortByBranchAdjacency } from "@surveyqs/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { cn } from "@/lib/utils";
import { surveyKeys } from "@/lib/query-keys";
import { AddQuestionDrawer } from "./_components/add-question-drawer";
import { AddSectionDrawer } from "./_components/add-section-drawer";
import { AssignAgentsDrawer } from "./_components/assign-agents-drawer";
import { ConsentSettingsCard } from "./_components/consent-settings-card";
import { DemographicFieldsCard } from "./_components/demographic-fields-card";
import { EditQuestionDrawer } from "./_components/edit-question-drawer";
import { PublishDialog } from "./_components/publish-dialog";
import { typeLabel } from "./_question-types";
import {
  useDeleteQuestion,
  useReorderQuestions,
  useSurvey,
  useSurveyDraft,
  type Section,
  type SurveyDraft,
} from "../_hooks/use-surveys";

function BuilderContent({ surveyId }: { surveyId: string }) {
  const survey = useSurvey(surveyId);
  const draft = useSurveyDraft(surveyId);
  const deleteQuestion = useDeleteQuestion(surveyId);
  const reorderQuestions = useReorderQuestions(surveyId);
  const qc = useQueryClient();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /** Drops `draggedId` at `targetId`'s position, then re-sorts by branch
   * adjacency -- so a drop that would split a branch question from its
   * parent (or drag the parent past its own children) self-corrects
   * instead of persisting the split. Same rule the server re-applies in
   * `QuestionViewSet.reorder`, so this is never fighting the server over
   * where things end up. */
  function moveQuestion(section: Section, draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const ordered = sortByBranchAdjacency(section.questions);
    const from = ordered.findIndex((q) => q.id === draggedId);
    const to = ordered.findIndex((q) => q.id === targetId);
    if (from === -1 || to === -1) return;

    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const normalized = sortByBranchAdjacency(next);
    if (normalized.every((q, i) => q.id === ordered[i]?.id)) return;

    qc.setQueryData<SurveyDraft>(surveyKeys.draft(surveyId), (prev) =>
      prev
        ? { ...prev, sections: prev.sections.map((s) => (s.id === section.id ? { ...s, questions: normalized } : s)) }
        : prev,
    );
    reorderQuestions.mutate(
      normalized.map((q) => q.id),
      {
        onError: (err) => {
          toast.error("Couldn't save the new order", { description: apiErrorMessage(err) });
          qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) });
        },
      },
    );
  }

  if (survey.isPending || draft.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (survey.isError || !survey.data) {
    return <EmptyState title="Couldn't load this survey" description="It may have been removed." />;
  }

  const isPublished = survey.data.status !== "draft";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/surveys" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> All surveys
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{survey.data.title}</h1>
            <SurveyStatusBadge status={survey.data.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {survey.data.category.label}
            {isPublished && ` · ${survey.data.response_count} response${survey.data.response_count === 1 ? "" : "s"} collected`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AssignAgentsDrawer
            surveyId={surveyId}
            trigger={
              <Button variant="secondary">
                <UserCog className="h-4 w-4" /> Assign agents
              </Button>
            }
          />
          <PublishDialog surveyId={surveyId} trigger={<Button>Publish</Button>} />
        </div>
      </div>

      {isPublished && (
        <div className="mb-4 rounded-md border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-strong">
          You&rsquo;re editing a working draft. Version {draft.data?.version_number ?? "—"} stays live for agents until
          you publish these changes.
        </div>
      )}

      <ConsentSettingsCard survey={survey.data} />

      <DemographicFieldsCard surveyId={surveyId} fields={draft.data?.demographic_fields ?? []} />

      <div className="space-y-4">
        {draft.data?.sections.length === 0 && (
          <EmptyState
            title="No sections yet"
            description="Start by adding a section, then add questions to it."
            action={
              <AddSectionDrawer
                surveyId={surveyId}
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" /> Add section
                  </Button>
                }
              />
            }
          />
        )}

        {draft.data?.sections.map((section) => (
          <Card key={section.id}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-ink-faint" />
                <h3 className="text-sm font-semibold text-ink">{section.title.en ?? section.code}</h3>
              </div>
              <AddQuestionDrawer
                surveyId={surveyId}
                sectionId={section.id}
                sections={draft.data?.sections ?? []}
                choiceLists={draft.data?.choice_lists ?? []}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" /> Question
                  </Button>
                }
              />
            </div>

            {section.questions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-faint">No questions in this section yet.</p>
            ) : (
              <ul>
                {sortByBranchAdjacency(section.questions).map((q) => {
                  const isBranch = branchParentCode(q, section.questions) !== null;
                  return (
                    <li
                      key={q.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(q.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggingId) moveQuestion(section, draggingId, q.id);
                        setDraggingId(null);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={cn(
                        "flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-0",
                        draggingId === q.id && "opacity-40",
                        isBranch && "ml-6 border-l-2 border-brand/25 pl-4",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-ink-faint active:cursor-grabbing" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">
                            {q.label.en}
                            {q.is_required === "true" && <span className="ml-1 text-rust">*</span>}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                            <span className="font-mono-data">{q.code}</span>
                            <span>·</span>
                            <span>{typeLabel(q.type)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <EditQuestionDrawer
                          surveyId={surveyId}
                          question={q}
                          sections={draft.data?.sections ?? []}
                          choiceLists={draft.data?.choice_lists ?? []}
                          trigger={
                            <button className="rounded-md p-1.5 text-ink-faint hover:bg-paper-sunken hover:text-ink" title="Edit question">
                              <Pencil className="h-4 w-4" />
                            </button>
                          }
                        />
                        <button
                          onClick={() =>
                            deleteQuestion.mutate(q.id, {
                              onError: (err) => toast.error("Couldn't remove question", { description: apiErrorMessage(err) }),
                            })
                          }
                          className="rounded-md p-1.5 text-ink-faint hover:bg-rust-soft hover:text-rust"
                          title="Remove question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}

        {draft.data && draft.data.sections.length > 0 && (
          <AddSectionDrawer
            surveyId={surveyId}
            trigger={
              <Button variant="secondary" size="sm">
                <Plus className="h-4 w-4" /> Add section
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

export default function SurveyBuilderPage() {
  const params = useParams<{ id: string }>();
  return (
    <PermissionGate module="surveys" action="edit" featureName="the survey builder">
      <BuilderContent surveyId={params.id} />
    </PermissionGate>
  );
}
