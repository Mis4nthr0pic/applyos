import React from "react";
import { Download, Trash2, Upload } from "lucide-react";
import type { Settings } from "../../shared/types";
import { Button, Card, Field, Notice } from "../components/UI";

export function SettingsTab({ settings, onSave, onExportAll, onImportAll, onClear }: { settings: Settings; onSave: (settings: Settings) => void; onExportAll: () => void; onImportAll: (file: File) => void; onClear: () => void }) {
  const [draft, setDraft] = React.useState(settings);
  React.useEffect(() => setDraft(settings), [settings]);
  return (
    <div className="stack">
      <div className="section-heading"><div><h1>Settings</h1><p>External AI is optional, disabled by default, and always user-triggered.</p></div></div>
      <Card className="form-grid">
        <Notice tone="success">Local-only mode keeps CV text, profiles, answers, jobs, queued URLs, and scans on this device. ApplyOS has no backend and no telemetry.</Notice>
        <Toggle label="Local-only mode" checked={draft.localOnlyMode} onChange={(value) => setDraft({ ...draft, localOnlyMode: value })} />
        <Field label="OpenRouter API key" hint="Stored locally. No hardcoded secrets."><input type="password" value={draft.openRouterApiKey ?? ""} onChange={(e) => setDraft({ ...draft, openRouterApiKey: e.target.value })} /></Field>
        <Field label="OpenRouter model"><input value={draft.openRouterModel ?? ""} onChange={(e) => setDraft({ ...draft, openRouterModel: e.target.value })} /></Field>
        <Toggle label="Smart Match enabled" checked={draft.smartMatchEnabled} onChange={(value) => setDraft({ ...draft, smartMatchEnabled: value })} />
        <Toggle label="Auto-generate from Experience Profile" checked={draft.generateFromExperienceEnabled} onChange={(value) => setDraft({ ...draft, generateFromExperienceEnabled: value })} />
        <Toggle label="Use optimized multi-CV database for answers" checked={draft.useOptimizedExperienceDatabase} onChange={(value) => setDraft({ ...draft, useOptimizedExperienceDatabase: value })} hint="When enabled, Generate All Answers sends the merged markdown database (Experience tab) with the humanizer prompt instead of the single structured profile JSON." />
        <Toggle label="Show data before sending" checked={draft.showDataBeforeSending} onChange={(value) => setDraft({ ...draft, showDataBeforeSending: value })} />
        <Toggle label="Allow raw CV for extraction" checked={draft.allowRawCvForExtraction} onChange={(value) => setDraft({ ...draft, allowRawCvForExtraction: value })} />
        <Field label={`Job fit threshold: ${draft.jobFitThreshold}%`}><input type="range" min="0" max="100" value={draft.jobFitThreshold} onChange={(e) => setDraft({ ...draft, jobFitThreshold: Number(e.target.value) })} /></Field>
        <Field label="Queue open behavior" hint="Controls only user-triggered Open, Start Review, Next, and Previous actions.">
          <select value={draft.queueOpenBehavior} onChange={(e) => setDraft({ ...draft, queueOpenBehavior: e.target.value as Settings["queueOpenBehavior"] })}>
            <option value="current_tab">Open in current tab</option>
            <option value="new_tab">Open in new tab</option>
            <option value="background_tab">Open in background tab</option>
          </select>
        </Field>
        <Toggle label="Auto-scan after opening (prompt only)" checked={draft.queueAutoScanAfterOpening} onChange={(value) => setDraft({ ...draft, queueAutoScanAfterOpening: value })} />
        <Toggle label="Queue dev mode: allow localhost URLs" checked={draft.queueDevMode} onChange={(value) => setDraft({ ...draft, queueDevMode: value })} />
        <Button variant="primary" onClick={() => onSave({ ...draft, id: "default" })}>Save Settings</Button>
      </Card>
      <Card>
        <h2>Local data</h2>
        <p>Export a complete local backup or clear this device.</p>
        <div className="button-row">
          <Button onClick={onExportAll}><Download size={16} /> Export All</Button>
          <label className="button button-secondary"><Upload size={16} /> Import All<input className="sr-only" type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && onImportAll(e.target.files[0])} /></label>
          <Button variant="danger" onClick={onClear}><Trash2 size={16} /> Clear Local Data</Button>
        </div>
      </Card>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <label className="toggle toggle-card">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint ? <small className="subtle" style={{ display: "block", marginTop: 4 }}>{hint}</small> : null}</span>
    </label>
  );
}
