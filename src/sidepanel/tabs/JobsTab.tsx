import React from "react";
import { ExternalLink, Search, Trash2 } from "lucide-react";
import type { TrackedJob } from "../../shared/types";
import { Badge, Button, Card, EmptyState, Field } from "../components/UI";
import { recommendationLabel } from "../lib";

function JobNotes({ job, onSave }: { job: TrackedJob; onSave: (job: TrackedJob) => void }) {
  const [draft, setDraft] = React.useState(job.notes ?? "");
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    setDraft(job.notes ?? "");
    // Reset only when switching jobs — refreshes mid-typing must not wipe the draft.
  }, [job.id]);
  const save = (value: string) => onSave({ ...job, notes: value, updatedAt: new Date().toISOString() });
  return (
    <Field label="Notes">
      <textarea
        rows={3}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => save(e.target.value), 600);
        }}
        onBlur={(e) => {
          window.clearTimeout(timer.current);
          if (e.target.value !== (job.notes ?? "")) save(e.target.value);
        }}
      />
    </Field>
  );
}

export function JobsTab({ jobs, onSave, onDelete }: { jobs: TrackedJob[]; onSave: (job: TrackedJob) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const filtered = jobs.filter((job) => (!status || job.status === status) && (!query || `${job.title} ${job.company}`.toLowerCase().includes(query.toLowerCase())));
  return (
    <div className="stack">
      <div className="section-heading"><div><h1>Jobs</h1><p>Track selective applications locally.</p></div></div>
      <Card>
        <div className="filter-grid">
          <label className="search-input"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or title" /></label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["saved","scanned","applied","reached_out","interviewing","rejected","offer","skipped"].map((item) => <option key={item}>{item}</option>)}</select>
        </div>
      </Card>
      {filtered.length ? filtered.map((job) => (
        <Card key={job.id}>
          <div className="card-header"><div><h2>{job.title || "Untitled job"}</h2><p>{[job.company, job.location].filter(Boolean).join(" · ")}</p></div>{job.fitScore ? <Badge tone={job.fitScore.overallScore >= 70 ? "good" : "warn"}>{job.fitScore.overallScore}%</Badge> : null}</div>
          <div className="tag-row"><Badge tone="blue">{job.platform}</Badge><Badge>{recommendationLabel(job.status)}</Badge></div>
          <JobNotes job={job} onSave={onSave} />
          <div className="button-row">
            <select value={job.status} onChange={(e) => onSave({ ...job, status: e.target.value as TrackedJob["status"], updatedAt: new Date().toISOString() })}>{["saved","scanned","applied","reached_out","interviewing","rejected","offer","skipped"].map((item) => <option key={item}>{item}</option>)}</select>
            <a className="button button-secondary" href={job.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open</a>
            <Button variant="danger" onClick={() => onDelete(job.id)}><Trash2 size={16} /> Delete</Button>
          </div>
        </Card>
      )) : <EmptyState title="No tracked jobs" body="Save a scanned job to start your local tracker." />}
    </div>
  );
}
