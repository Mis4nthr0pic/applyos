import React from "react";
import { FileText, Sparkles } from "lucide-react";
import type { CvSource, Settings } from "../../shared/types";
import { Badge, Button, Card, Field, Notice } from "../components/UI";

interface Props {
  cvSources: CvSource[];
  settings: Settings;
  loading: boolean;
  onImportCvs: (files: FileList) => Promise<void>;
  onSaveCv: (cv: CvSource) => Promise<void>;
  onSummarizeCv: (cv: CvSource) => Promise<void>;
}

export function CvLibraryCard(props: Props) {
  return (
    <Card>
      <div className="card-header">
        <div>
          <h2><FileText size={18} style={{ display: "inline", verticalAlign: "text-bottom" }} /> CV library</h2>
          <p>
            One summary per CV version. ApplyOS uses these to recommend which file to upload for each job.
          </p>
        </div>
      </div>

      <Field label="Import CV files" hint="Upload PDF, DOCX, or TXT from your machine. Summaries are stored locally.">
        <label className="button button-secondary">
          <FileText size={16} /> Upload CV files (multiple)
          <input
            className="sr-only"
            type="file"
            multiple
            accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => event.target.files?.length && props.onImportCvs(event.target.files)}
          />
        </label>
      </Field>

      {!props.cvSources.length ? (
        <Notice tone="warning">No CVs in your library yet. Upload your five versions or reload to use bundled seeds.</Notice>
      ) : (
        <div className="stack-sm">
          {props.cvSources.map((cv) => (
            <CvLibraryItem
              key={cv.id}
              cv={cv}
              settings={props.settings}
              loading={props.loading}
              onSave={props.onSaveCv}
              onSummarize={props.onSummarizeCv}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function CvLibraryItem({
  cv,
  settings,
  loading,
  onSave,
  onSummarize
}: {
  cv: CvSource;
  settings: Settings;
  loading: boolean;
  onSave: (cv: CvSource) => Promise<void>;
  onSummarize: (cv: CvSource) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(cv);

  React.useEffect(() => setDraft(cv), [cv]);

  return (
    <Card className="field-card">
      <div className="card-header">
        <div>
          <strong>{cv.fileName}</strong>
          {cv.positioningLabel ? <p className="subtle">{cv.positioningLabel}</p> : null}
        </div>
        {cv.targetRoles?.length ? (
          <div className="tag-row">
            {cv.targetRoles.slice(0, 3).map((role) => (
              <Badge key={role}>{role}</Badge>
            ))}
          </div>
        ) : null}
      </div>

      {cv.localPathHint ? <p className="subtle">Local file: {cv.localPathHint}</p> : null}

      <Field label="Summary">
        <textarea
          rows={3}
          value={draft.summary ?? ""}
          onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          placeholder="2-3 sentence summary of this CV angle..."
        />
      </Field>

      <Field label="When to use">
        <textarea
          rows={2}
          value={draft.whenToUse ?? ""}
          onChange={(event) => setDraft({ ...draft, whenToUse: event.target.value })}
          placeholder="Which jobs should get this CV?"
        />
      </Field>

      {cv.keyStrengths?.length ? (
        <p className="subtle">Strengths: {cv.keyStrengths.join(" · ")}</p>
      ) : null}

      <div className="button-row">
        <Button onClick={() => onSave(draft)}>Save summary</Button>
        {!settings.localOnlyMode && settings.openRouterApiKey ? (
          <Button loading={loading} onClick={() => onSummarize(cv)}>
            <Sparkles size={16} /> Regenerate summary (AI)
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
