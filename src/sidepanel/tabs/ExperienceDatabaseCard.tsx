import React from "react";
import { Database, Download, FileUp, Sparkles, Trash2, Upload } from "lucide-react";
import type { CvSource, ExperienceDatabase, Settings } from "../../shared/types";
import { Button, Card, Field, Notice } from "../components/UI";

interface Props {
  database?: ExperienceDatabase;
  cvSources: CvSource[];
  settings: Settings;
  loading: boolean;
  onImportCvs: (files: FileList) => Promise<void>;
  onBuild: () => void;
  onSaveMarkdown: (markdown: string) => void;
  onImportMarkdown: (file: File) => void;
  onExportMarkdown: () => void;
  onClearSources: () => void;
}

export function ExperienceDatabaseCard(props: Props) {
  const [markdown, setMarkdown] = React.useState(props.database?.markdown ?? "");

  const lastIncoming = React.useRef(props.database?.markdown ?? "");
  React.useEffect(() => {
    // Only reset on real content changes — background refresh() must not wipe edits.
    const incoming = props.database?.markdown ?? "";
    if (incoming === lastIncoming.current) return;
    lastIncoming.current = incoming;
    setMarkdown(incoming);
  }, [props.database]);

  return (
    <Card>
      <div className="card-header">
        <div>
          <h2><Database size={18} style={{ display: "inline", verticalAlign: "text-bottom" }} /> Optimized CV database</h2>
          <p>
            Merged markdown from all CV versions. Used with the humanizer prompt when generating answers.
            Match the job against every section, not just one CV.
          </p>
        </div>
      </div>

      <Field
        label="Import CV sources"
        hint="Upload multiple TXT, PDF, or DOCX files. Stored locally until you rebuild the database."
      >
        <label className="button button-secondary">
          <FileUp size={16} /> Upload CV files (multiple)
          <input
            className="sr-only"
            type="file"
            multiple
            accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => event.target.files?.length && props.onImportCvs(event.target.files)}
          />
        </label>
      </Field>

      {props.cvSources.length ? (
        <Notice tone="info">
          {props.cvSources.length} CV source{props.cvSources.length === 1 ? "" : "s"} stored locally:{" "}
          {props.cvSources.map((source) => source.fileName).join(", ")}
        </Notice>
      ) : (
        <Notice tone="warning">No CV sources uploaded yet. You can still edit or import the markdown database below.</Notice>
      )}

      <div className="button-row">
        <Button
          variant="primary"
          loading={props.loading}
          disabled={!props.cvSources.length || props.settings.localOnlyMode || !props.settings.openRouterApiKey}
          onClick={props.onBuild}
        >
          <Sparkles size={16} /> Rebuild from CVs (OpenRouter)
        </Button>
        <Button onClick={props.onExportMarkdown} disabled={!markdown.trim()}>
          <Download size={16} /> Export Markdown
        </Button>
        <label className="button button-secondary">
          <Upload size={16} /> Import Markdown
          <input
            className="sr-only"
            type="file"
            accept=".md,text/markdown,text/plain"
            onChange={(event) => event.target.files?.[0] && props.onImportMarkdown(event.target.files[0])}
          />
        </label>
        {props.cvSources.length ? (
          <Button variant="danger" onClick={props.onClearSources}>
            <Trash2 size={16} /> Clear CV sources
          </Button>
        ) : null}
      </div>

      {props.settings.localOnlyMode || !props.settings.openRouterApiKey ? (
        <Notice tone="info">OpenRouter is required to rebuild from CVs. You can paste or import markdown manually.</Notice>
      ) : null}

      <Field
        label="Optimized experience database (markdown)"
        hint={
          props.database?.updatedAt
            ? `Last updated ${new Date(props.database.updatedAt).toLocaleString()} · ${props.database.sourceFiles.length} source file(s)`
            : "Editable. Saved locally in IndexedDB."
        }
      >
        <textarea
          className="code-editor"
          rows={22}
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          placeholder="# Optimized Experience Database..."
        />
      </Field>

      <div className="button-row">
        <Button variant="primary" disabled={!markdown.trim()} onClick={() => props.onSaveMarkdown(markdown)}>
          Save Database
        </Button>
      </div>
    </Card>
  );
}
