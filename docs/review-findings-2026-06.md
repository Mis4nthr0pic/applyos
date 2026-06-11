# ApplyOS code review — June 2026

Multi-agent review across six dimensions (content scripts, adapters, background/storage, sidepanel UX, matching/parsing, security/reliability). Every P0/P1 was adversarially verified against the actual code by an independent pass; two claimed P0s were refuted and are listed at the bottom so they don't get "fixed". P2s and feature items were reviewed once but not independently verified.

> **Status (2026-06-11): all 16 P0/P1 items below are FIXED in the working tree**, plus five hardening items the fix-review found (LLM confidence normalization, defensive `tags` handling, draft-reset guards in CvLibraryCard/ExperienceDatabaseCard, nonce-based injection boundary, polarity-safe `cannot` fallback). Each fix passed an adversarial review; the yes/no-polarity normalizer additionally passes a 27-case test suite covering both review rounds' inversion cases. `tsc` and `vite build` clean. The P2 and FEATURE sections remain open.
>
> **Open follow-ups from the fix review (small, non-blocking):**
> - The "Generated N AI answers and saved them" notice doesn't say when low-confidence answers were withheld for review (`App.tsx:711`), and no UI badge surfaces `requiresEditBeforeInsert` — flagged answers just don't appear.
> - Other prompts still interpolate page text undelimited (lower stakes, no profile data alongside): `recommendCvOpenRouter.ts`, `improveJobExtraction`, `smartMatchAnswer`.
> - Pre-fix Answer Bank entries created by the old always-save path remain; the cleaned `questions-cleaned.json` import supersedes them.
> - JobsTab: first debounced notes save can reorder the list (sorted by `updatedAt`) and steal focus once per edit session; queue notes+status concurrent writes can race (pre-existing).
> - Multi-yes-variant Workday selects are skipped (safe) rather than answered; `extractOptions` still returns no options for unnamed radio groups (pre-existing).

---

## P0 — broken core flows (verified)

### 1. Lever/Ashby radio options are corrupted, so screening radios are silently never filled
`src/content/fieldDetection.ts:365` + `src/content/formSemantics.ts:85-97`

`extractOptions()` maps every same-name radio through `extractFieldLabel(radio)`, which routes to `extractQuestionLabel`, where `extractLeverApplicationLabel` returns the **question** text (`.application-label`) for every radio inside a Lever `.application-field` — before the per-option `label[for]` lookup runs. Every option maps to the same string, and `uniqueStrings` collapses the options array to one bogus entry (the question itself). Downstream, `valueMatchesFieldOptions` (`src/sidepanel/autoInsert.ts:105-118`) can't match "Yes"/"No" against it, so Lever work-authorization/relocation radios are detected but **silently skipped** on every Lever application. Same shadowing hits Ashby entries that use native radios (Ashby's button-style yes/no widgets are unaffected).

**Fix:** in `extractOptions()`, use the existing per-option resolver `getRadioOptionLabel(radio)` (fieldDetection.ts:427) with `radio.value` fallback. The group-level label extraction is fine — only the options array is corrupted.

### 2. Token-overlap fallback inserts wrong saved answers, and its confidence is never checked
`src/matching/answerMatcher.ts:146-156` + `src/sidepanel/autoInsert.ts:173`

When exact/category/fuzzy matching fails for a `screening_question` radio/select, a fallback accepts any saved answer sharing ≥2 tokens longer than 3 chars ("have", "with", "many", "years", "experience" all qualify) and returns hardcoded confidence 0.75. Worse, among qualifying answers it picks by `timesUsed` desc — overlap quality is ignored entirely — and the sole caller never compares the returned confidence to any threshold. Verified blast radius: wrong Yes/No or option answers on radio/select screening questions, e.g. a "professional experience with React?" radio answered from your saved Solidity answer. On real applications, with no review.

**Fix:** require informative-token agreement (strip stopwords), compute confidence from actual overlap, and make `resolveInsertValue` enforce `minConfidence` on this path too.

---

## P1 — verified bugs

### 3. `normalizeYesNoAnswer` inverts sponsorship/eligibility answers
`src/sidepanel/autoInsert.ts:69-86`

The No-branch regex (`requires? sponsorship|need sponsorship|not authorized|...`) runs **before** the `^yes` check and is negation-blind. Verified inversions: "Yes, I will require sponsorship" → selects **No**; "I will need sponsorship to work in the US" → **No**; "I am not eligible to work in the UK" → **Yes**. For someone who genuinely needs Canadian/US sponsorship, this silently submits the opposite of the truth on the most consequential screening question there is. Plain "Yes"/"No" saved answers are safe; sentence-form answers (which the AI answer writer is prompted to produce) trigger it.

**Fix:** resolve a canonical yes/no per category from the saved answer, considering the *question's* polarity (the function currently never looks at the question at all).

### 4. Auto-capture loses most typed answers (shared debounce timer)
`src/content/fieldAutoCapture.ts:19,36`

One module-level timer; any qualifying event on any element clears the pending capture. Type into field A, click field B within 700ms → A's capture is cancelled, B's bails (still empty). Answers entered at normal tabbing speed never reach the answer bank — the feature mostly works only when you idle >700ms between fields.

**Fix:** per-element timers, or flush the pending element's capture immediately when a different target fires.

### 5. Unnamed/id-less radio groups emit n phantom duplicate fields with dead fieldIds
`src/content/fieldDetection.ts:230-233, 282-293`

The group key is hashed from `outerHTML`, but tagging the group writes `data-applyos-*` attributes that change the `outerHTML` mid-pass, so each radio in the group mints a new fieldId and re-tags the group. n-option group → n duplicate DetectedFields; only the last fieldId survives in the DOM, so inserts on the others fail with "field not found". Also churns the field signature on every dynamic-watch tick and rescan, re-spamming `APPLYOS_FIELDS_CHANGED`.

**Fix:** hash a clone stripped of `data-applyos-*` attributes (or key on label + DOM index), and short-circuit in `getOrCreateFieldId` when the radio already carries `data-applyos-field-id`.

### 6. One captured answer is saved twice (background + sidepanel both handle the message)
`src/background/index.ts:52-63` + `src/sidepanel/App.tsx:302-306`

Both contexts listen for `APPLYOS_FIELD_ANSWERED` and both call `saveFieldAnswer`, whose read-check-write isn't atomic — with the panel open, both pass dedupe and insert two rows with different UUIDs (and different `companiesUsedFor`, since only the sidepanel passes the company). This is one source of the duplicate-answer noise the bank cleanup then has to mop up.

**Fix:** handle in background only; sidepanel just refreshes its view on a notification.

### 7. Answer-bank rewrite paths can destroy the whole bank
`src/db/index.ts:133-139` + `src/sidepanel/App.tsx:1095-1101, 1122-1128`

Three places do `clear()` then `bulkPut()` without a transaction. In Dexie each commits separately — close the panel (or hit a quota error) between the two and the entire answer bank is gone. `importAllData` (db/index.ts:178) already wraps the same pattern in `db.transaction`, so this is an inconsistency, not a missing skill.

**Fix:** wrap all three in `db.transaction('rw', ...)`. Cheap insurance for your most valuable local data.

### 8. PDF resume parsing produces zero sections for every PDF
`src/parsers/resume.ts:49-56`

Text items are joined with spaces; `hasEOL` is ignored, so each page collapses to one line. `splitSections` only detects a heading when a trimmed *line* equals it — impossible — so all six sections come back empty for every PDF and the fallback heuristics run on whole-page lines. `recommendCv`'s heuristic summary is equally degraded.

**Fix:** append `\n` when `item.hasEOL` is true. One line; no Y-coordinate math needed.

### 9. `myworkdaysite.com` (Workday's second domain) is unhandled
`src/adapters/workday.ts:2`, `src/shared/reactFormHosts.ts:7`, `src/queue/urlQueue.ts:73`

Only `myworkdayjobs.com` is matched. On `*.wd*.myworkdaysite.com` the React page-world value-tracker fallback never fires, so when Workday reverts an insert the recovery path is skipped, and queue items are misclassified. Add the bare domain in the three places — subdomains are already covered by suffix/substring matching.

### 10. Ashby identity fields get routed to the AI instead of profile autofill
`src/shared/applicationFields.ts:22`

Every Ashby field — name, email, phone, location included — is classified as an AI application field, so basics that should fill instantly from your profile wait on (or consume) LLM calls. Classify by field semantics first; AI only for genuine free-text questions.

### 11. Prompt injection: page text + your profile share one prompt, and the "edit before insert" flag isn't enforced
`src/ai/openrouter.ts:229-237` + `src/sidepanel/autoInsert.ts:143-146`

Job-page text (attacker-controlled) is interpolated into the same message as your profile data and the answer-writing instructions, with no untrusted-data delimiting and no output validation. A malicious posting can poison answers or steer profile data into generated text. Compounding it: `requiresEditBeforeInsert` (set at App.tsx:685) is never checked by `resolveInsertValue`, and `autoInsertFields` defaults to true — so a poisoned answer can be inserted into the attacker's own form without a forced manual edit.

**Fix:** delimit job text as untrusted data in the prompt, enforce `requiresEditBeforeInsert` in the insert path, and consider validating generated answers against profile facts.

### 12. Auto-generate-on-scan silently bypasses "Show data before sending"
`src/sidepanel/App.tsx:639-661, 386-399`

The confirm gate is `options.interactive && showDataBeforeSending && !confirmData(...)`; auto-generate passes `interactive: false`, so with both settings at their defaults your full profile + page text goes to OpenRouter on every scan with no preview — exactly what the settings copy promises won't happen. The panel is open and focused during scans, so showing the dialog is feasible.

### 13. Review Mode notes leak from one job to the next
`src/sidepanel/tabs/JobQueueTab.tsx:181, 318`

`ReviewCard` has no `key` and the textarea is uncontrolled (`defaultValue`), so clicking Next reuses the DOM node — job B shows job A's notes, and saving writes them onto job B. **Fix:** `key={item.id}` on ReviewCard (or a controlled textarea).

### 14. Cmd+A / Cmd+R are hijacked while Review Mode is on
`src/sidepanel/tabs/JobQueueTab.tsx:95-113`

The shortcut handler ignores modifier keys: Cmd+A marks the current job Applied, Cmd+R triggers a rescan. Bail out when `metaKey/ctrlKey/altKey` is set.

### 15. Job notes write to Dexie and re-read all 8 tables on every keystroke
`src/sidepanel/tabs/JobsTab.tsx:24` + `App.tsx:1414`

Controlled textarea whose `onChange` awaits `db.trackedJobs.put` + full `refresh()`. Typing a sentence = a dozen full-store reloads. Debounce the save and skip the global refresh.

### 16. Background `refresh()` wipes unsaved drafts in Settings/Profile/Experience tabs
`src/sidepanel/tabs/SettingsTab.tsx:16` (same pattern in ProfileTab, ExperienceProfileTab)

`useEffect(() => setDraft(settings), [settings])` + `refresh()` always creating fresh object identities = any background refresh (e.g. an auto-saved answer arriving) resets what you're typing. Gate the reset on a deep-equality check or only reset when not dirty.

---

## P2 — reviewed once, not independently verified

- **Insert verification passes on any non-empty value** (`fieldDetection.ts:565`) — `|| committed.length > 0` accepts the *old* value after a framework revert, masking failures and skipping the page-world fallback that exists for exactly this case.
- **`type="date"` (+ datetime-local/month/week/time/search) inputs are never detected** (`fieldDetection.ts:45`) — start-date and DOB fields silently missing from scans.
- **"E-mail" labels never classify as email** (`fieldClassifier.ts:9`) — `normalizeText` turns the hyphen into a space first; the regex can't match.
- **LinkedIn watch scans the whole page after the Easy Apply modal closes** (`content/index.ts:152`) — junk fields (search bar etc.) get pushed mid-watch.
- **BambooHR adapter misses modern `/careers/` URLs** (`bamboohr.ts:2`) — only legacy `/jobs` paths match.
- **Page classifier over-triggers** (`adapters/classifier.ts:9`) — `\bemail\b` + any input = "job application form" on most of the web.
- **JSON-LD `@type` arrays skipped** (`classifier.ts:27`) — `["JobPosting"]` postings aren't recognized.
- **"Company - Role" titles parsed backwards** (`generic.ts:232`) — Lever-style titles yield inverted title/company.
- **Workday multi-step apply URLs defeat listing cache** (`listingResolver.ts:3`) — `/apply/applyManually`, `/login` variants aren't normalized.
- **Batch answer reconciliation can misassign answers positionally** (`ai/openrouter.ts:284-288`) — positional fallback consumes `answers[i]` even when it belongs to a different fieldId.
- **No retry/timeout on OpenRouter calls** (`ai/openrouter.ts:46-77`) — one 429 or hung request kills the whole batch.
- **Sample placeholder answers reseed after a manual clear** (`db/index.ts:130`) — and can be autofilled verbatim into real applications.
- **Auto-capture overwrites curated answers with raw page captures** (`saveFieldAnswer.ts:55-63`) — no source/quality check before replacing.
- **API key in plaintext in IndexedDB and in `Export All` backups** (`db/index.ts:170`) — at minimum, strip it from exports.
- **EEO/self-ID answers (race, gender, disability, veteran status) auto-captured and stored** (`screeningFields.ts:6-36`) — sensitive data in a plaintext export; consider opt-in.
- **Pervasive `.catch(() => undefined)`** (`contentScriptAccess.ts:310` and friends) — injection/messaging failures are invisible; surface a "scan couldn't run on this page" state.
- **Scan results go stale after navigation** (`App.tsx:1172`) — previous job's fields/fit/CV pick stay on screen with live Insert buttons.
- **Queue action row: 9-10 same-weight buttons, two of which do the same thing** (`JobQueueTab.tsx:366-377`).
- **`Button` spreads props after className** (`components/UI.tsx:14`) — caller className wipes base styles.
- **`normalizeText` keeps trailing periods** (`matching/normalize.ts:6`) — "Tell us about yourself." never exact-matches "Tell us about yourself".
- **CV recommendation uses raw substring matching** (`recommendCv.ts:45,68`) — "AI" matches inside "maintain"; margin-blind confidence.
- **Experience-evidence boost fires on stopwords** (`experienceEvidence.ts:61-63`).

## Features worth adding

1. **Checkbox-group support** (`fieldDetection.ts:246`) — same-name checkbox clusters (Lever multi-selects like "Which locations are you open to?") collapse to one field; there's no group handling analogous to radios, so multi-selects always need manual clicking.
2. **Missing ATS adapters** — Greenhouse/Lever/Ashby/SmartRecruiters/iCIMS/Teamtailor/Workable are covered; missing are SAP SuccessFactors, Oracle/Taleo, Jobvite, Personio, Eightfold, ADP. SuccessFactors and Personio are the highest-value adds for EU/enterprise applications.
3. **Retention caps for `scanHistory` and `jobListingCache`** (`App.tsx:365`) — both grow without bound, each scan storing full job descriptions.
4. **Manifest hygiene** — no icons (toolbar shows the gray default), no `minimum_chrome_version`.
5. **Date-field formatting** — once `type="date"` detection exists, format profile values as `yyyy-MM-dd`.

## Refuted claims (verified false — don't "fix" these)

- ~~"Fuse edit-distance can't distinguish questions differing only in key term"~~ — empirically tested with the repo's fuse.js 7.4.1 and exact config: one-token-different questions score 0.42-0.51, below every threshold in the codebase. Also, free-text question fields use the exact-match-only path and never reach Fuse during autofill.
- ~~"Category/tag match returns flat 0.92, bypassing review thresholds"~~ — the 0.92 branch is gated to demographic/EEO categories where answers are question-invariant; salary and notice-period can't reach it. (Residual nit: the screening branch ignores `answerBankMinConfidence` entirely — covered by item 2 above — and `location_eligibility`/`previous_employment` are the only question-dependent categories in the tag list.)

---

## Suggested fix order

| Order | Items | Why |
|---|---|---|
| 1 | #3, #2 | Wrong answers on real applications (sponsorship inversion is the scariest) |
| 2 | #1 | Every Lever screening radio is currently dead weight |
| 3 | #7, #6 | Protects/cleans the answer bank itself |
| 4 | #12, #11 | Privacy contract + injection hardening before heavy LLM use |
| 5 | #4, #8 | Make capture and resume import actually work |
| 6 | #13-#16 | Daily-driver UX papercuts |
| 7 | #5, #9, #10 | Platform-specific reliability |
