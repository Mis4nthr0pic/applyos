import {
  AlertTriangle,
  Clipboard,
  FileText,
  RefreshCw,
  Save,
  ScanSearch,
  Sparkles,
  WandSparkles
} from "lucide-react";
import { findAnswerMatches } from "../../matching/answerMatcher";
import {
  DOCUMENT_CATEGORIES,
  EXPERIENCE_QUESTION_CATEGORIES,
  FACTUAL_CATEGORIES,
  SAFE_PROFILE_CATEGORIES,
  SENSITIVE_CATEGORIES
} from "../../shared/constants";
import type {
  AnswerSuggestion,
  DetectedField,
  JobFitScore,
  SavedAnswer,
  ScanResult,
  Settings,
  UserProfile
} from "../../shared/types";
import { profileValueForField, recommendationLabel } from "../lib";
import { Badge, Button, Card, EmptyState, Notice } from "../components/UI";

interface Props {
  scan?: ScanResult;
  fit?: JobFitScore;
  answers: SavedAnswer[];
  userProfile?: UserProfile;
  settings: Settings;
  suggestions: Record<string, AnswerSuggestion>;
  loading: boolean;
  watchDynamic: boolean;
  onWatchDynamic: (value: boolean) => void;
  onScan: () => void;
  onInsert: (field: DetectedField, value: string, savedAnswerId?: string) => void;
  onAutofillSafe: (fields: DetectedField[]) => void;
  onSaveJob: (status: "saved" | "applied" | "skipped") => void;
  onSmartMatch: (field: DetectedField, candidates: SavedAnswer[]) => void;
  onSuggestAllAnswers: () => void;
  onSaveCurrentValue: (field: DetectedField) => void;
  onSaveSuggestion: (field: DetectedField, suggestion: AnswerSuggestion) => void;
  onSkip: (field: DetectedField) => void;
  onImproveJob: () => void;
}

export function DetectedFieldsTab(props: Props) {
  const fields = props.scan?.fields ?? [];
  const safe = fields.filter(
    (field) => field.category && SAFE_PROFILE_CATEGORIES.includes(field.category) && !field.isDisabled
  );
  const application = fields.filter(
    (field) => field.category && EXPERIENCE_QUESTION_CATEGORIES.includes(field.category) && !field.isDynamic
  );
  const factual = fields.filter(
    (field) => field.category && FACTUAL_CATEGORIES.includes(field.category) && !field.isDynamic
  );
  const documents = fields.filter(
    (field) => field.category && DOCUMENT_CATEGORIES.includes(field.category)
  );
  const dynamic = fields.filter((field) => field.isDynamic);
  const manual = fields.filter(
    (field) =>
      field.isDisabled ||
      field.category === "manual_review" ||
      (field.category && SENSITIVE_CATEGORIES.includes(field.category))
  );

  return (
    <div className="stack">
      <Card className="scan-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Current page</p>
            <h2>{props.scan ? recommendationLabel(props.scan.pageType) : "Not scanned yet"}</h2>
          </div>
          {props.scan ? <Badge tone="blue">{props.scan.adapterName}</Badge> : null}
        </div>
        <div className="button-row">
          <Button variant="primary" loading={props.loading} onClick={props.onScan}>
            <ScanSearch size={16} /> {props.scan ? "Rescan Page" : "Scan Page"}
          </Button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={props.watchDynamic}
              onChange={(event) => props.onWatchDynamic(event.target.checked)}
            />
            <span>Watch dynamic fields</span>
          </label>
        </div>
        {props.scan?.message ? <Notice tone="warning">{props.scan.message}</Notice> : null}
        {props.scan ? (
          <p className="subtle">
            {props.scan.fields.length} fields detected · {props.scan.watching ? "Watching" : "Stopped"}
          </p>
        ) : null}
      </Card>

      {props.scan ? (
        <>
          <JobCard {...props} />
          <FitCard fit={props.fit} />
          {fields.length === 0 ? (
            <EmptyState
              title="No fields found"
              body="Make sure the application form is visible. ApplyOS will never click Apply for you."
              action={
                <Button onClick={props.onScan}>
                  <RefreshCw size={16} /> Rescan Page
                </Button>
              }
            />
          ) : null}
          <FieldGroup
            title="Safe Profile Fields"
            description="These can be filled from your saved profile after you approve the action."
            fields={safe}
            action={
              safe.length ? (
                <Button onClick={() => props.onAutofillSafe(safe)}>Autofill All Safe Fields</Button>
              ) : undefined
            }
          >
            {(field) => {
              const value = profileValueForField(field, props.userProfile);
              return (
                <SimpleField
                  field={field}
                  value={value}
                  onInsert={(nextValue) => props.onInsert(field, nextValue)}
                />
              );
            }}
          </FieldGroup>
          <FieldGroup
            title="Application Questions"
            description="Saved answers come first. Generate all experience-backed answers in one OpenRouter batch."
            fields={application}
            action={
              props.settings.generateFromExperienceEnabled &&
              !props.settings.localOnlyMode &&
              props.settings.openRouterApiKey &&
              application.length &&
              props.fit &&
              props.fit.overallScore >= props.settings.jobFitThreshold ? (
                <Button loading={props.loading} onClick={props.onSuggestAllAnswers}>
                  <Sparkles size={16} /> Generate All Answers
                </Button>
              ) : undefined
            }
          >
            {(field) => (
              <ApplicationQuestion
                field={field}
                answers={props.answers}
                suggestion={props.suggestions[field.fieldId]}
                settings={props.settings}
                fit={props.fit}
                onInsert={props.onInsert}
                onSmartMatch={props.onSmartMatch}
                onSaveCurrentValue={props.onSaveCurrentValue}
                onSaveSuggestion={props.onSaveSuggestion}
                onSkip={props.onSkip}
              />
            )}
          </FieldGroup>
          <FieldGroup
            title="Factual / Preference Fields"
            description="ApplyOS uses only values you saved in Profile."
            fields={factual}
          >
            {(field) => {
              const value = profileValueForField(field, props.userProfile);
              return (
                <SimpleField
                  field={field}
                  value={value}
                  onInsert={(nextValue) => props.onInsert(field, nextValue)}
                />
              );
            }}
          </FieldGroup>
          <FieldGroup
            title="Documents"
            description="File uploads always require manual user action."
            fields={documents}
          >
            {(field) => (
              <SimpleField
                field={field}
                value="Upload manually in the page"
                manual
                onInsert={() => undefined}
              />
            )}
          </FieldGroup>
          <FieldGroup
            title="Dynamic Fields"
            description="These appeared after the form changed or a dependency updated."
            fields={dynamic}
          >
            {(field) => (
              <SimpleField
                field={field}
                value={
                  field.dependsOn?.length
                    ? `Depends on ${field.dependsOn.join(" → ")}`
                    : "Appeared dynamically"
                }
                manual
                onInsert={() => undefined}
              />
            )}
          </FieldGroup>
          <FieldGroup
            title="Manual Review"
            description="Sensitive, unclear, disabled, and unsupported fields are never autofilled."
            fields={manual}
          >
            {(field) => (
              <SimpleField
                field={field}
                value="Review and answer manually"
                manual
                onInsert={() => undefined}
              />
            )}
          </FieldGroup>
        </>
      ) : (
        <EmptyState
          title="Scan a job page"
          body="Open a listing, careers page, or application form, then scan it from here."
        />
      )}
    </div>
  );
}

function JobCard(props: Props) {
  const job = props.scan!.jobInfo;
  const hasJob = job.title || job.company || job.description;
  return (
    <Card>
      <div className="card-header">
        <div>
          <p className="eyebrow">Job information</p>
          <h2>{job.title || "Job title not found"}</h2>
          <p>{[job.company, job.location].filter(Boolean).join(" · ") || "No company or location found"}</p>
        </div>
      </div>
      {!hasJob ? <Notice tone="warning">No job information was found on this page.</Notice> : null}
      <div className="button-row">
        <Button onClick={() => props.onSaveJob("saved")}>
          <Save size={16} /> Save Job
        </Button>
        <Button onClick={() => props.onSaveJob("applied")}>Mark Applied</Button>
        <Button onClick={() => props.onSaveJob("skipped")}>Mark Skipped</Button>
        {!props.settings.localOnlyMode && props.settings.openRouterApiKey && job.description ? (
          <Button onClick={props.onImproveJob}>
            <Sparkles size={16} /> Improve Extraction
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function FitCard({ fit }: { fit?: JobFitScore }) {
  if (!fit) return null;
  const tone =
    fit.recommendation === "strong_fit" || fit.recommendation === "good_fit"
      ? "good"
      : fit.recommendation === "partial_fit"
        ? "warn"
        : "bad";
  return (
    <Card className="fit-card">
      <div className="score-line">
        <div className={`score score-${tone}`}>{fit.overallScore}%</div>
        <div>
          <p className="eyebrow">Job fit</p>
          <h2>{recommendationLabel(fit.recommendation)}</h2>
          <p>{fit.reason}</p>
        </div>
      </div>
      <div className="score-grid">
        <ScoreItem label="Required skills" value={fit.breakdown.requiredSkills} />
        <ScoreItem label="Experience level" value={fit.breakdown.experienceLevel} />
        <ScoreItem label="Domain fit" value={fit.breakdown.domainFit} />
        <ScoreItem label="Role fit" value={fit.breakdown.roleFit} />
      </div>
      {fit.matchingHighlights.length ? (
        <div className="evidence">
          <strong>Matching highlights</strong>
          <div className="tag-row">
            {fit.matchingHighlights.slice(0, 6).map((item) => (
              <Badge key={item} tone="good">{item}</Badge>
            ))}
          </div>
        </div>
      ) : null}
      {fit.missingRequirements.length ? (
        <div className="evidence">
          <strong>Missing or unclear</strong>
          <ul>
            {fit.missingRequirements.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function ScoreItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}%</strong>
    </div>
  );
}

function FieldGroup({
  title,
  description,
  fields,
  action,
  children
}: {
  title: string;
  description: string;
  fields: DetectedField[];
  action?: React.ReactNode;
  children: (field: DetectedField) => React.ReactNode;
}) {
  if (!fields.length) return null;
  return (
    <section className="field-group">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {action}
      </div>
      <div className="stack-sm">{fields.map((field) => <div key={field.fieldId}>{children(field)}</div>)}</div>
    </section>
  );
}

function SimpleField({
  field,
  value,
  manual,
  onInsert
}: {
  field: DetectedField;
  value?: string;
  manual?: boolean;
  onInsert: (value: string) => void;
}) {
  return (
    <Card className="field-card">
      <div className="field-title">
        <div>
          <strong>{field.label}</strong>
          <div className="tag-row">
            <Badge>{field.category || "unknown"}</Badge>
            {field.required ? <Badge tone="warn">Required</Badge> : null}
            {field.isDisabled ? <Badge tone="bad">Disabled</Badge> : null}
          </div>
        </div>
      </div>
      <p className={value ? "value-preview" : "subtle"}>{value || "No saved value"}</p>
      {!manual && value ? (
        <div className="button-row">
          <Button onClick={() => navigator.clipboard.writeText(value)}><Clipboard size={15} /> Copy</Button>
          <Button onClick={() => onInsert(value)}>Insert</Button>
          <Button onClick={() => {
            const edited = window.prompt("Edit before inserting", value);
            if (edited) onInsert(edited);
          }}>Edit Before Insert</Button>
        </div>
      ) : null}
    </Card>
  );
}

function ApplicationQuestion({
  field,
  answers,
  suggestion,
  settings,
  fit,
  onInsert,
  onSmartMatch,
  onSaveCurrentValue,
  onSaveSuggestion,
  onSkip
}: {
  field: DetectedField;
  answers: SavedAnswer[];
  suggestion?: AnswerSuggestion;
  settings: Settings;
  fit?: JobFitScore;
  onInsert: (field: DetectedField, value: string, savedAnswerId?: string) => void;
  onSmartMatch: (field: DetectedField, candidates: SavedAnswer[]) => void;
  onSaveCurrentValue: (field: DetectedField) => void;
  onSaveSuggestion: (field: DetectedField, suggestion: AnswerSuggestion) => void;
  onSkip: (field: DetectedField) => void;
}) {
  const matches = findAnswerMatches(field, answers, 3);

  return (
    <Card className="field-card">
      <div className="field-title">
        <div>
          <strong>{field.label}</strong>
          <div className="tag-row">
            <Badge>{field.category || "custom_question"}</Badge>
            {field.required ? <Badge tone="warn">Required</Badge> : null}
          </div>
        </div>
      </div>
      {suggestion ? (
        <Notice tone={suggestion.source === "no_fit" ? "danger" : "success"}>
          <strong>{suggestion.source === "no_fit" ? "NO_FIT" : recommendationLabel(suggestion.source)}</strong>
          <p>{suggestion.answer || suggestion.reason}</p>
          {suggestion.answer && suggestion.answer !== "NO_FIT" ? (
            <div className="button-row">
              <Button onClick={() => navigator.clipboard.writeText(suggestion.answer!)}><Clipboard size={15} /> Copy</Button>
              <Button onClick={() => onInsert(field, suggestion.answer!)}>Insert</Button>
              <Button onClick={() => {
                const edited = window.prompt("Edit before inserting", suggestion.answer);
                if (edited) onInsert(field, edited);
              }}>Edit Before Insert</Button>
              {suggestion.source === "experience_profile" ? (
                <Button onClick={() => onSaveSuggestion(field, suggestion)}>Save to Answer Bank</Button>
              ) : null}
            </div>
          ) : null}
        </Notice>
      ) : null}
      {matches.length ? (
        <div className="match-list">
          {matches.map(({ answer, confidence }) => (
            <div className="answer-match" key={answer.id}>
              <div className="card-header">
                <strong>{answer.title}</strong>
                <Badge tone={confidence >= 0.7 ? "good" : "warn"}>{Math.round(confidence * 100)}% match</Badge>
              </div>
              <p>{answer.answer}</p>
              <div className="button-row">
                <Button onClick={() => navigator.clipboard.writeText(answer.answer)}><Clipboard size={15} /> Copy</Button>
                <Button onClick={() => onInsert(field, answer.answer, answer.id)}>Insert</Button>
                <Button onClick={() => {
                  const edited = window.prompt("Edit before inserting", answer.answer);
                  if (edited) onInsert(field, edited, answer.id);
                }}>Edit Before Insert</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Notice tone="warning">No saved answer match found. ApplyOS will not invent one.</Notice>
      )}
      <div className="button-row">
        {settings.smartMatchEnabled && !settings.localOnlyMode && settings.openRouterApiKey && matches.length ? (
          <Button onClick={() => onSmartMatch(field, matches.map((match) => match.answer))}>
            <WandSparkles size={16} /> Smart Match
          </Button>
        ) : null}
        <Button onClick={() => onSaveCurrentValue(field)}>
          <FileText size={16} /> Save Current Answer
        </Button>
        <Button onClick={() => onSkip(field)}>Skip</Button>
      </div>
      {fit && fit.overallScore < settings.jobFitThreshold ? (
        <Notice tone="warning">
          <AlertTriangle size={16} /> Fit is below your {settings.jobFitThreshold}% threshold. Generated answers are disabled.
        </Notice>
      ) : null}
    </Card>
  );
}
