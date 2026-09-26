"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiErrorMessage } from "@/lib/api-client/client";
import {
  useRemoveDemographicField,
  useReorderDemographicFields,
  type SurveyDemographicFieldRow,
} from "../../_hooks/use-surveys";
import { typeLabel } from "../_question-types";
import { AddDemographicFieldDrawer } from "./add-demographic-field-drawer";

export function DemographicFieldsCard({
  surveyId,
  fields,
}: {
  surveyId: string;
  fields: SurveyDemographicFieldRow[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const reorderFields = useReorderDemographicFields(surveyId);
  const removeField = useRemoveDemographicField(surveyId);

  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const alreadySelectedCodes = new Set(sorted.map((f) => f.code));

  const moveField = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const from = sorted.findIndex((f) => f.id === draggedId);
    const to = sorted.findIndex((f) => f.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderFields.mutate(
      next.map((f) => f.id),
      {
        onError: (err) => toast.error("Couldn't save the new order", { description: apiErrorMessage(err) }),
      },
    );
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Demographic fields</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Shown to the agent in the Respondent step, alongside Full name and Phone.
          </p>
        </div>
        <AddDemographicFieldDrawer
          surveyId={surveyId}
          alreadySelectedCodes={alreadySelectedCodes}
          trigger={
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" /> Add from bank
            </Button>
          }
        />
      </div>

      {sorted.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-faint">
          No demographic fields selected yet -- Full name and Phone are always collected.
        </p>
      ) : (
        <ul>
          {sorted.map((field) => (
            <li
              key={field.id}
              draggable
              onDragStart={(e) => {
                setDraggingId(field.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) moveField(draggingId, field.id);
                setDraggingId(null);
              }}
              className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-ink-faint" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{field.label.en ?? field.code}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                    <span className="font-mono-data">{field.code}</span>
                    <span>·</span>
                    <span>{typeLabel(field.type)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  removeField.mutate(field.id, {
                    onError: (err) => toast.error("Couldn't remove field", { description: apiErrorMessage(err) }),
                  })
                }
                className="shrink-0 rounded-md p-1.5 text-ink-faint hover:bg-rust-soft hover:text-rust"
                title="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
