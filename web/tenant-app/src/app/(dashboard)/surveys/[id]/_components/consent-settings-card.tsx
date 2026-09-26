"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useConsentNotices } from "../collect/_hooks/use-collect";
import { useSetSurveyConsent, type SurveyRow } from "../../_hooks/use-surveys";

/**
 * Whether this survey gates its interview on a signed consent step (see
 * mobile's ConsentScreen and the web collection flow's own Consent step),
 * and the notice text shown there. Each survey owns its own `ConsentNotice`
 * row rather than sharing a tenant-wide one -- see
 * apps/surveys/services.py::set_survey_consent.
 */
export function ConsentSettingsCard({ survey }: { survey: SurveyRow }) {
  const setConsent = useSetSurveyConsent(survey.id);
  const notices = useConsentNotices();
  const currentNotice = notices.data?.results.find((n) => n.id === survey.settings?.consent_notice_id) ?? null;

  const [required, setRequired] = useState(!!survey.settings?.consent_required);
  const [text, setText] = useState(currentNotice?.text ?? "");

  // The notice's text loads a beat after `survey` itself does -- prefill
  // the textarea once it lands rather than leaving it blank.
  useEffect(() => {
    if (currentNotice) setText(currentNotice.text);
  }, [currentNotice]);

  function save() {
    if (required && !text.trim()) {
      toast.error("Add the consent text before requiring it.");
      return;
    }
    setConsent.mutate(
      { required, text: text.trim() },
      {
        onSuccess: () => toast.success("Consent settings saved"),
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

      <div className="space-y-3 px-5 py-4">
        {required ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="We'd like to ask you some questions about..."
            rows={5}
          />
        ) : (
          <p className="text-sm text-ink-faint">
            Agents go straight to the respondent step -- no consent screen or signature is required.
          </p>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={save} loading={setConsent.isPending}>
            Save consent settings
          </Button>
        </div>
      </div>
    </Card>
  );
}
