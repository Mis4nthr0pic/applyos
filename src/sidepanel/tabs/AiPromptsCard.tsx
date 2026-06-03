import { PROMPT_CATALOG, type PromptKey, resolvePrompt } from "../../ai/prompts";
import type { Settings } from "../../shared/types";
import { Button, Card, Field, Notice } from "../components/UI";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export function AiPromptsCard({ settings, onChange }: Props) {
  function setOverride(key: PromptKey, value: string) {
    onChange({
      ...settings,
      promptOverrides: {
        ...settings.promptOverrides,
        [key]: value
      }
    });
  }

  function clearOverride(key: PromptKey) {
    const next = { ...settings.promptOverrides };
    delete next[key];
    onChange({ ...settings, promptOverrides: next });
  }

  return (
    <Card className="stack">
      <div className="section-heading">
        <div>
          <h2>AI prompts</h2>
          <p>Every OpenRouter system prompt ApplyOS sends. Override the editable ones below; defaults are shown for reference.</p>
        </div>
      </div>

      <Notice tone="info">
        User messages (job text, CV text, questions) are built at runtime and previewed when &quot;Show data before sending&quot; is enabled.
      </Notice>

      {(Object.keys(PROMPT_CATALOG) as PromptKey[]).map((key) => {
        const meta = PROMPT_CATALOG[key];
        const active = resolvePrompt(settings, key);
        const override = settings.promptOverrides?.[key]?.trim();
        return (
          <Field
            key={key}
            label={meta.label}
            hint={meta.description + (meta.editable ? " Editable." : " Read-only reference.")}
          >
            {meta.editable ? (
              <>
                <textarea
                  className="code-editor"
                  rows={Math.min(18, Math.max(8, Math.ceil(active.length / 90)))}
                  value={override ?? meta.default}
                  onChange={(event) => setOverride(key, event.target.value)}
                />
                <div className="button-row">
                  <Button onClick={() => clearOverride(key)} disabled={!override}>
                    Reset to default
                  </Button>
                </div>
              </>
            ) : (
              <textarea className="code-editor" rows={6} value={meta.default} readOnly />
            )}
          </Field>
        );
      })}
    </Card>
  );
}
