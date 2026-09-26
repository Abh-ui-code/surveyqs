"use client";

import { FileText, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-client/client";
import { formatDateTime } from "@/lib/format";
import { useConsentNotices, useConsentRecords } from "../collect/_hooks/use-collect";
import { useSetSurveyConsent, type SurveyRow } from "../../_hooks/use-surveys";

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt";

/**
 * Whether this survey gates its interview on a signed consent step (see
 * mobile's ConsentScreen and the web collection flow's own Consent step),
 * the notice text shown there -- typed directly or extracted from an
 * uploaded PDF/DOCX/TXT, the same document-upload path a sibling app's
 * consent module (crediqs) offers -- and every signature captured against
 * it so far. Each survey owns its own `ConsentNotice` row rather than
 * sharing a tenant-wide one -- see apps/surveys/services.py::set_survey_consent.
 */
export function ConsentSettingsCard({ survey }: { survey: SurveyRow }) {
  const setConsent = useSetSurveyConsent(survey.id);
  const notices = useConsentNotices();
  const currentNotice = notices.data?.results.find((n) => n.id === survey.settings?.consent_notice_id) ?? null;
  const records = useConsentRecords(currentNotice?.id);

  const [required, setRequired] = useState(!!survey.settings?.consent_required);
  const [text, setText] = useState(currentNotice?.text ?? "");
  const [file, setFile] = useState<File | null>(null);

  // The notice's text loads a beat after `survey` itself does -- prefill
  // the textarea once it lands rather than leaving it blank. Only when the
  // agent hasn't already picked a fresh file to replace it with.
  useEffect(() => {
    if (currentNotice && !file) setText(currentNotice.text);
  }, [currentNotice, file]);

  function save() {
    if (required && !file && !text.trim()) {
      toast.error("Add the consent text, or upload a document, before requiring it.");
      return;
    }
    setConsent.mutate(
      { required, text: text.trim(), file: file ?? undefined },
      {
        onSuccess: () => {
          toast.success("Consent settings saved");
          setFile(null);
        },
        onError: (err) => toast.error("Couldn't save consent settings", { description: apiErrorMessage(err) }),
      },
    );
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Consent</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Shown and signed before the respondent&rsquo;s name, phone or anything else is asked.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          Require consent
          <Switch checked={required} onCheckedChange={setRequired} />
        </label>
      </div>

      {required ? (
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-2">
            {file ? (
              <span className="flex h-9 items-center gap-2 rounded-md border border-line bg-paper-raised px-3 text-sm text-ink">
                <FileText className="h-4 w-4 text-ink-faint" />
                {file.name}
                <button type="button" onClick={() => setFile(null)} className="text-ink-faint hover:text-rust">
                  <X className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <label className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border border-line bg-paper-raised px-3 text-sm text-ink-muted hover:bg-paper-sunken">
                <Upload className="h-4 w-4" /> Upload a document
                <input
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) setFile(picked);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {currentNotice?.source_file_url && !file && (
              <a href={currentNotice.source_file_url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                View uploaded file
              </a>
            )}
          </div>
          <p className="text-xs text-ink-faint">
            PDF, DOCX or TXT -- the text below is extracted automatically and stays editable. Or just type it in directly.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="We'd like to ask you some questions about..."
            rows={5}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={save} loading={setConsent.isPending}>
              Save consent settings
            </Button>
          </div>

          {currentNotice && (
            <div className="border-t border-line pt-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Signed consents
                {records.data && records.data.count > 0 && <span> ({records.data.count})</span>}
              </h4>
              {records.isPending ? (
                <p className="text-sm text-ink-faint">Loading…</p>
              ) : !records.data || records.data.results.length === 0 ? (
                <p className="text-sm text-ink-faint">No respondent has signed this notice yet.</p>
              ) : (
                <ul className="space-y-2">
                  {records.data.results.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="text-ink">{r.respondent_name ?? "Unnamed respondent"}</span>
                        <span className="ml-2 text-xs text-ink-faint">{formatDateTime(r.granted_at)}</span>
                        {r.is_withdrawn && (
                          <Badge tone="rust" className="ml-2">
                            Withdrawn
                          </Badge>
                        )}
                      </div>
                      {r.signature_url && (
                        <a href={r.signature_url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-brand hover:underline">
                          View signature
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-ink-faint">
            Agents go straight to the respondent step -- no consent screen or signature is required.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={save} loading={setConsent.isPending}>
              Save consent settings
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
