import React from "react";
import { Download, FileUp, Sparkles, Trash2, Upload } from "lucide-react";
import type { CvSource, ExperienceDatabase, ExperienceProfile, Settings } from "../../shared/types";
import { Button, Card, Field, Notice } from "../components/UI";
import { CvLibraryCard } from "./CvLibraryCard";
import { ExperienceDatabaseCard } from "./ExperienceDatabaseCard";

interface Props {
  profile?: ExperienceProfile;
  database?: ExperienceDatabase;
  cvSources: CvSource[];
  settings: Settings;
  loading: boolean;
  onExtractFile: (file: File) => Promise<{ text: string; sourceType: ExperienceProfile["sourceType"] }>;
  onParse: (text: string, sourceType: ExperienceProfile["sourceType"]) => void;
  onSave: (profile: ExperienceProfile) => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onImportCvs: (files: FileList) => Promise<void>;
  onBuildDatabase: () => void;
  onSaveDatabaseMarkdown: (markdown: string) => void;
  onImportDatabaseMarkdown: (file: File) => void;
  onExportDatabaseMarkdown: () => void;
  onClearCvSources: () => void;
  onSaveCv: (cv: CvSource) => Promise<void>;
  onSummarizeCv: (cv: CvSource) => Promise<void>;
}

export function ExperienceProfileTab(props: Props) {
  const [rawText, setRawText] = React.useState(props.profile?.rawText ?? "");
  const [sourceType, setSourceType] = React.useState<ExperienceProfile["sourceType"]>(props.profile?.sourceType ?? "pasted_text");
  const [json, setJson] = React.useState(JSON.stringify(props.profile ?? {}, null, 2));
  const [message, setMessage] = React.useState("");

  const lastIncoming = React.useRef(JSON.stringify(props.profile ?? {}));
  React.useEffect(() => {
    // Only reset on real content changes — background refresh() must not wipe edits.
    const incoming = JSON.stringify(props.profile ?? {});
    if (incoming === lastIncoming.current) return;
    lastIncoming.current = incoming;
    setRawText(props.profile?.rawText ?? "");
    setSourceType(props.profile?.sourceType ?? "pasted_text");
    setJson(JSON.stringify(props.profile ?? {}, null, 2));
  }, [props.profile]);

  async function handleFile(file: File) {
    try {
      const extracted = await props.onExtractFile(file);
      setRawText(extracted.text);
      setSourceType(extracted.sourceType);
      setMessage(`Extracted ${extracted.text.length.toLocaleString()} characters locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "File extraction failed.");
    }
  }

  function saveJson() {
    try {
      const parsed = JSON.parse(json) as ExperienceProfile;
      props.onSave({ ...parsed, id: "default", rawText: parsed.rawText || rawText, sourceType, parsedAt: new Date().toISOString() });
      setMessage("Structured Experience Profile saved.");
    } catch {
      setMessage("The structured profile JSON is invalid.");
    }
  }

  return (
    <div className="stack">
      <div className="section-heading">
        <div><h1>Experience Profile</h1><p>Your documented background is the only source of truth.</p></div>
      </div>
      <Card>
        <Field label="Paste CV or resume text" hint="Stored locally in IndexedDB.">
          <textarea rows={10} value={rawText} onChange={(e) => { setRawText(e.target.value); setSourceType("pasted_text"); }} placeholder="Paste your real CV text here..." />
        </Field>
        <div className="button-row">
          <label className="button button-secondary"><FileUp size={16} /> Upload TXT / PDF / DOCX<input className="sr-only" type="file" accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} /></label>
          <Button variant="primary" disabled={!rawText.trim()} onClick={() => props.onParse(rawText, sourceType)}><Sparkles size={16} /> Parse Experience Profile</Button>
        </div>
        {message ? <Notice>{message}</Notice> : null}
        {props.settings.localOnlyMode || !props.settings.openRouterApiKey ? (
          <Notice tone="info">Local heuristic parsing is active. You can edit the structured profile below.</Notice>
        ) : !props.settings.allowRawCvForExtraction ? (
          <Notice tone="warning">OpenRouter is configured, but raw CV extraction is disabled in Settings. Local parsing will be used.</Notice>
        ) : null}
      </Card>
      <Card>
        <div className="card-header"><div><h2>Structured profile</h2><p>Edit the JSON directly. Nothing is inferred automatically.</p></div></div>
        <textarea className="code-editor" rows={18} value={json} onChange={(e) => setJson(e.target.value)} />
        <div className="button-row">
          <Button variant="primary" onClick={saveJson}>Save Structured Profile</Button>
          <Button onClick={props.onExport}><Download size={16} /> Export</Button>
          <label className="button button-secondary"><Upload size={16} /> Import<input className="sr-only" type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && props.onImport(e.target.files[0])} /></label>
          <Button variant="danger" onClick={props.onDelete}><Trash2 size={16} /> Delete</Button>
        </div>
      </Card>
      <CvLibraryCard
        cvSources={props.cvSources}
        settings={props.settings}
        loading={props.loading}
        onImportCvs={props.onImportCvs}
        onSaveCv={props.onSaveCv}
        onSummarizeCv={props.onSummarizeCv}
      />
      <ExperienceDatabaseCard
        database={props.database}
        cvSources={props.cvSources}
        settings={props.settings}
        loading={props.loading}
        onImportCvs={props.onImportCvs}
        onBuild={props.onBuildDatabase}
        onSaveMarkdown={props.onSaveDatabaseMarkdown}
        onImportMarkdown={props.onImportDatabaseMarkdown}
        onExportMarkdown={props.onExportDatabaseMarkdown}
        onClearSources={props.onClearCvSources}
      />
    </div>
  );
}
