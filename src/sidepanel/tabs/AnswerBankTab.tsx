import React from "react";
import { Copy, Download, Plus, Search, Trash2, Upload } from "lucide-react";
import { cleanupAnswerBank } from "../../shared/answerBankCleanup";
import { sanitizeSavedQuestion } from "../../shared/answerBankQuestions";
import type { AnswerCategory, SavedAnswer } from "../../shared/types";
import { normalizeText } from "../../matching/normalize";
import { Badge, Button, Card, EmptyState, Field, Notice } from "../components/UI";

interface Props {
  answers: SavedAnswer[];
  onSave: (answer: SavedAnswer) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onCleanup: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

const CATEGORIES: AnswerCategory[] = [
  "why_company",
  "why_role",
  "about_me",
  "hard_problem",
  "leadership",
  "conflict",
  "salary",
  "relocation",
  "work_auth",
  "visa_sponsorship",
  "portfolio",
  "custom"
];

export function AnswerBankTab({ answers, onSave, onDelete, onClearAll, onCleanup, onExport, onImport }: Props) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [editing, setEditing] = React.useState<SavedAnswer | null>(null);

  const filtered = answers
    .filter((answer) => {
      const matchesCategory = !category || answer.category === category;
      const haystack = normalizeText([answer.title, answer.originalQuestion, answer.answer, ...answer.tags].join(" "));
      return matchesCategory && (!query || haystack.includes(normalizeText(query)));
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const totalCount = answers.length;
  const showingCount = filtered.length;
  const countLabel =
    totalCount === 0
      ? "No answers saved yet"
      : showingCount === totalCount
        ? `${totalCount} answer${totalCount === 1 ? "" : "s"}`
        : `${showingCount} of ${totalCount} answers`;

  function handleCleanup(): void {
    if (!totalCount) return;
    const preview = cleanupAnswerBank(answers);
    if (!preview.removed.length && !preview.fixed.length) {
      window.alert("Nothing to clean up — no broken or duplicate entries found.");
      return;
    }
    const detail = [
      preview.removed.length ? `${preview.removed.length} broken/duplicate entries will be removed` : "",
      preview.fixed.length ? `${preview.fixed.length} question labels will be corrected` : ""
    ]
      .filter(Boolean)
      .join("\n");
    const confirmed = window.confirm(
      `Clean up your Answer Bank?\n\n${detail}\n\n${preview.kept.length} answer${preview.kept.length === 1 ? "" : "s"} will remain.`
    );
    if (confirmed) onCleanup();
  }

  function handleClearAll(): void {
    if (!totalCount) return;
    const confirmed = window.confirm(
      `Delete all ${totalCount} answer${totalCount === 1 ? "" : "s"} from your Answer Bank?\n\nThis cannot be undone. You can regenerate answers with AI after scanning application forms.`
    );
    if (confirmed) onClearAll();
  }

  return (
    <div className="stack">
      <div className="section-heading">
        <div>
          <h1>Answer Bank</h1>
          <p>
            Reusable answers you have reviewed and approved. <strong>{countLabel}</strong>
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing(newAnswer())}>
          <Plus size={16} /> New
        </Button>
      </div>

      <Card>
        <div className="filter-grid">
          <label className="search-input">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search answers" />
          </label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="button-row">
          <Button onClick={onExport} disabled={!totalCount}>
            <Download size={16} /> Export
          </Button>
          <label className="button button-secondary">
            <Upload size={16} /> Import
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = "";
              }}
            />
          </label>
          <Button onClick={handleCleanup} disabled={!totalCount}>
            Clean up
          </Button>
          <Button variant="danger" disabled={!totalCount} onClick={handleClearAll}>
            <Trash2 size={16} /> Delete all
          </Button>
        </div>
        <Notice tone="info">
          Use <strong>Clean up</strong> to remove broken auto-saves (profile fields, wrong matches, duplicates) and
          fix polluted question labels. Export saves a JSON backup you can re-import later.
        </Notice>
      </Card>

      {editing ? (
        <AnswerEditor
          answer={editing}
          onCancel={() => setEditing(null)}
          onSave={(answer) => {
            onSave(answer);
            setEditing(null);
          }}
        />
      ) : null}

      {filtered.length ? (
        filtered.map((answer) => (
          <Card key={answer.id}>
            <div className="card-header">
              <div>
                <h2>{answer.title}</h2>
                <p>{answer.originalQuestion}</p>
              </div>
              <Badge>{answer.category}</Badge>
            </div>
            <p className="value-preview">{answer.answer}</p>
            <div className="tag-row">
              <Badge tone="blue">{answer.source}</Badge>
              <Badge>{answer.timesUsed} uses</Badge>
              {answer.derivedFromRole ? <Badge>Role: {answer.derivedFromRole}</Badge> : null}
              {answer.derivedFromProject ? <Badge>Project: {answer.derivedFromProject}</Badge> : null}
              {answer.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
            <div className="button-row">
              <Button onClick={() => setEditing(answer)}>Edit</Button>
              <Button
                onClick={() =>
                  setEditing({
                    ...answer,
                    id: crypto.randomUUID(),
                    title: `${answer.title} copy`,
                    timesUsed: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  })
                }
              >
                <Copy size={16} /> Duplicate
              </Button>
              <Button variant="danger" onClick={() => onDelete(answer.id)}>
                <Trash2 size={16} /> Delete
              </Button>
            </div>
          </Card>
        ))
      ) : (
        <EmptyState
          title={totalCount ? "No answers match your filters" : "No answers yet"}
          body={
            totalCount
              ? "Try a different search or category filter."
              : "Scan an application form to auto-save screening answers, or import a JSON backup."
          }
        />
      )}
    </div>
  );
}

function AnswerEditor({
  answer,
  onCancel,
  onSave
}: {
  answer: SavedAnswer;
  onCancel: () => void;
  onSave: (answer: SavedAnswer) => void;
}) {
  const [draft, setDraft] = React.useState(answer);
  return (
    <Card className="editor-card">
      <h2>{answer.title ? "Edit answer" : "New answer"}</h2>
      <Field label="Title">
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </Field>
      <Field label="Category">
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as AnswerCategory })}
        >
          {CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Original question">
        <textarea value={draft.originalQuestion} onChange={(e) => setDraft({ ...draft, originalQuestion: e.target.value })} />
      </Field>
      <Field label="Answer">
        <textarea rows={6} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
      </Field>
      <Field label="Tags" hint="Comma-separated">
        <input
          value={draft.tags.join(", ")}
          onChange={(e) =>
            setDraft({
              ...draft,
              tags: e.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            })
          }
        />
      </Field>
      <div className="button-row">
        <Button
          variant="primary"
          onClick={() =>
            onSave({
              ...draft,
              title: sanitizeSavedQuestion(draft.title || draft.originalQuestion).slice(0, 80),
              originalQuestion: sanitizeSavedQuestion(draft.originalQuestion),
              normalizedQuestion: normalizeText(sanitizeSavedQuestion(draft.originalQuestion)),
              updatedAt: new Date().toISOString()
            })
          }
        >
          Save Answer
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function newAnswer(): SavedAnswer {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    category: "custom",
    originalQuestion: "",
    normalizedQuestion: "",
    answer: "",
    tags: [],
    roleTypes: [],
    companiesUsedFor: [],
    source: "manual",
    timesUsed: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
