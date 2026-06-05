# AI and prompts

This document explains **exactly** how ApplyOS uses AI: when it runs, what data each
feature sends, and every prompt involved — including which ones you can edit.

Read this before turning AI on. ApplyOS works fully without it.

---

## Ground rules

- **AI is off by default.** *Local-only mode* is on out of the box, so ApplyOS makes **no
  network calls** until you turn it off, add an OpenRouter key, and trigger an action.
- **Every AI call is user-triggered.** Nothing is sent in the background. Scanning a page
  is local; only the explicit AI actions below reach the network.
- **One provider, one endpoint.** All requests go to OpenRouter:
  `POST https://openrouter.ai/api/v1/chat/completions`, with
  `Authorization: Bearer <your key>`, `temperature: 0`, and JSON-only output. The request
  also sends an `X-Title: ApplyOS` header. Your key is stored locally and never embedded in
  the build.
- **Facts only.** Answer generation is constrained to your **documented** experience. When
  there is no relevant evidence, the model must return the literal token `NO_FIT` (with
  confidence 0) rather than invent anything.
- **Preview first.** With *Show data before sending* enabled (default), you see the payload
  before it leaves your machine.

---

## How a request is assembled

Every feature sends a **system prompt** (the rules) plus a **user message** (your data for
that task). The system prompt comes from the prompt catalog below; the editable ones can be
replaced in **Settings → AI prompts**.

The answer-writing feature is special: its system prompt is the **answer-writing prompt
followed by the de-AI-ify prompt**, concatenated. So both are in force for every generated
answer.

---

## The AI features, and what each sends

| Feature | Where you trigger it | System prompt(s) | What is sent to OpenRouter | What comes back |
| --- | --- | --- | --- | --- |
| **Parse CV → Profile** | Experience tab → *Parse Experience Profile* (when AI is on) | `parseCv` | Your raw CV text | Structured Experience Profile JSON |
| **Summarize CV** | Experience tab → importing a CV into the CV Library | `cvSummarize` | One CV's text | `positioningLabel`, `summary`, `targetRoles`, `keyStrengths`, `whenToUse`, `keywords` |
| **Build CV database** | Experience tab → build merged database | `buildDatabase` | The text of multiple CV variants | One merged markdown document |
| **Recommend CV for job** | Detected Fields tab → CV recommendation | `cvRecommendation` | The job info + each CV's **summary** (not full text) | Best `recommendedFileName`, confidence, reason, alternatives |
| **Improve job extraction** | Detected Fields tab → re-extract job info | `improveJob` | The job description text | Structured job info (requirements, responsibilities, etc.) |
| **Generate All Answers** | Detected Fields tab → *Generate All Answers*, or auto on scan | `answerWriting` + `deAiify` | Your grounding source (Experience Database **or** structured profile), per-question evidence snippets, your job search context, and the batch of questions | One answer per question, or `NO_FIT`, each with a source citation, confidence, and reason |
| **Smart Match** | When *Smart Match enabled* is on | `smartMatch` | The questions + your saved Answer Bank entries | Which saved answer best fits each question (selection only — it does not write new text) |

Notes:

- **Recommend CV** sends only the short CV **summaries**, not the full CV files.
- **Generate All Answers** uses the merged **Experience Database** as grounding when *Use
  optimized multi-CV database for answers* is on (default); otherwise it sends the
  structured profile JSON.
- **Smart Match** never generates or rewrites text. It classifies a question and picks the
  best existing saved answer.

---

## The prompt catalog

ApplyOS ships eight named prompts. Five are **editable** in **Settings → AI prompts**
(your edits are saved as part of settings); three are **fixed** because they must return a
strict machine-readable shape.

| Key | Label in Settings | Editable | Purpose |
| --- | --- | --- | --- |
| `answerWriting` | Answer writing (Generate All Answers) | ✅ | Core rules for batch answers: facts-only, length, batch JSON format. |
| `deAiify` | De-AI-ify (human voice) | ✅ | Appended to every generated answer; strips jargon, cover-letter tone, and chatbot tells. |
| `buildDatabase` | Build CV database | ✅ | Merges multiple CVs into one optimized markdown database. |
| `cvSummarize` | Summarize CV | ✅ | Generates a CV Library summary on import. |
| `cvRecommendation` | Recommend CV for job | ✅ | Picks which CV to upload for a role. |
| `parseCv` | Parse CV to profile | ❌ | Structured Experience Profile extraction. |
| `improveJob` | Improve job extraction | ❌ | Re-extracts job requirements from the description. |
| `smartMatch` | Smart Match | ❌ | Matches questions to saved Answer Bank entries. |

If you clear an editable override, ApplyOS falls back to the built-in default for that
prompt.

### Editing a prompt safely

The editable prompts are full system prompts. When you customize one, keep these intact or
you will break parsing:

- **`answerWriting`**: must keep the **facts-only** rules, the **`NO_FIT`** instruction, and
  the exact **`{ "answers": [ { "fieldId", "answer", "sourceExperience", "confidence",
  "reason" } ] }`** output contract. Every input question must map to exactly one answer
  with the same `fieldId`.
- **`cvSummarize`** / **`cvRecommendation`** / **`buildDatabase`**: keep their **"Return
  JSON only: { … }"** shape. The app parses the JSON and will error on prose.
- All of them: keep "use only stated facts; do not invent" — this is the core promise of
  ApplyOS.

---

## What the answer-writing and de-AI-ify prompts actually enforce

These two run together for every generated answer, so they are worth understanding.

**`answerWriting`** makes the model:

1. Answer **every** question in the batch.
2. Use **only** documented experience from your profile/database and the per-question
   evidence snippets.
3. Never invent or embellish companies, roles, metrics, tools, or achievements.
4. Return `NO_FIT` (confidence 0) when there is no relevant evidence and no applicable job
   search context.
5. Keep answers concise (usually 2–4 sentences).
6. Never mention AI or tools.
7. Run an internal Draft → Audit → De-AI-ify → Final pass and return only the final text.

**`deAiify`** then forces the output to read like a human typed it in a form box, not a
cover letter or chatbot reply. It bans a long list of tells (em dashes, "leverage",
"passionate about", "proven track record", forced rule-of-three, generic closers, etc.),
prefers concrete statements naming real employers, and caps most answers at a short
paragraph.

The net effect: answers are grounded strictly in your real experience **and** stripped of
generic AI phrasing — and if your experience does not support a question, the field is left
for you rather than filled with invention.

---

## Job search context

The **Job search context** setting (free text) is sent with answer generation so the model
can answer open-ended questions like "Why are you looking for a change?" or "What motivates
you?" using *your* stated reasons and goals, combined with your CV — not generic enthusiasm.
Leave it blank and those questions fall back to CV facts only (and may return `NO_FIT`).

---

## Choosing a model

Presets are grouped by provider (Google Gemini, OpenAI, Anthropic, DeepSeek, Meta,
Mistral), or you can enter any OpenRouter `provider/model` ID. The default is
**`google/gemini-2.0-flash-lite-001`** — fast and cheap, a good default for batch answers.
Heavier models (e.g. Claude Sonnet, GPT-4.1, Gemini 2.5 Pro) produce stronger writing at
higher cost. All features use whichever single model you select.

---

## Cost and rate notes

- You pay OpenRouter directly for usage; ApplyOS adds no markup and has no billing of its
  own.
- *Generate All Answers* batches all unanswered questions on a page into **one** request to
  keep cost down, and skips a call entirely when every question already has a saved answer.
- Generated answers are saved to your Answer Bank, so re-scanning the same form reuses them
  instead of calling the model again.
