# ApplyOS

ApplyOS is a local-first Chrome extension for selective, honest job applications.

It creates an Experience Profile from a real CV, scans job listings and application forms, scores fit, reuses locally saved answers, and fills only values the user explicitly approves. It never invents experience, auto-submits applications, clicks Apply, chooses random dropdown values, or uploads files programmatically.

## Features

- Manifest V3 Chrome extension with a React side panel
- Local Experience Profile from pasted text, TXT, PDF, or DOCX
- Local heuristic CV parsing with manual structured-profile editing
- Optional user-triggered OpenRouter CV parsing
- ATS adapters for Ashby, Greenhouse, Lever, Workable, Workday, SmartRecruiters, BambooHR, Recruitee, Teamtailor, and iCIMS
- Custom careers page support for company-owned sites such as `/careers`, `/jobs`, and `/apply`
- Job information, requirement, responsibility, nice-to-have, benefits, and salary extraction
- Field detection outside normal `<form>` elements
- Dynamic/Ajax field watching with a 15-second `MutationObserver`
- Safe dependent dropdown insertion with exact and normalized matching
- Local job fit scoring against documented experience
- Local Answer Bank search with Fuse.js
- Safe profile autofill after explicit user action
- Sensitive, compliance, disabled, unclear, and file fields routed to Manual Review
- Local job tracker, scan history, and JSON import/export
- Local Job URL Queue with pasted URL import, deduplication, platform classification, review mode, filters, and JSON/CSV export
- Optional user-triggered OpenRouter Smart Match and experience-backed suggestions
- Explicit `NO_FIT` behavior when relevant documented experience is absent

## Setup

Requirements:

- Node.js 18 or newer
- Chrome with side panel support

Install dependencies:

```bash
npm install
```

Run the Vite development server:

```bash
npm run dev
```

The development server is useful for previewing the side panel UI. Page scanning and Chrome extension messaging require the built unpacked extension.

Build the unpacked extension:

```bash
npm run build
```

The production extension is written to `dist/`.

## Load In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `dist/` directory.
6. Open a normal `http://` or `https://` job page.
7. Click the ApplyOS extension action to open the side panel.
8. If the page was already open before the extension was loaded, refresh it once so the content script can attach.

After code changes, run `npm run build` again and click the extension’s reload button on `chrome://extensions`.

## Core Workflow

1. Open **Experience** and paste a CV or upload TXT, PDF, or DOCX.
2. Click **Parse Experience Profile**.
3. Review and edit the structured JSON. The raw CV remains searchable locally.
4. Open a job listing, careers page, or application form.
5. Open ApplyOS and click **Scan Page**.
6. Review the page classification, extracted job, fit score, and detected fields.
7. Click Apply manually if the page only shows an Apply button, then rescan.
8. Insert saved profile values or Answer Bank answers only after reviewing them.
9. Use **Save Current Answer** to add a manually written page answer to the local Answer Bank.
10. Save the job to the local tracker if it is worth pursuing.

## Job URL Queue

The **Job Queue** tab lets you paste many job or careers URLs and review them one by one. ApplyOS does not read your open Chrome tabs automatically.

To copy Chrome tab URLs on macOS, run:

```bash
osascript -e 'tell application "Google Chrome" to get URL of tabs of windows' | tr ',' '\n' | sed 's/^ *//' | pbcopy
```

Then:

1. Open **Job Queue**.
2. Paste the copied text into **Paste job URLs**.
3. Click **Import URLs**.
4. ApplyOS extracts valid HTTP/HTTPS URLs, removes duplicates, removes common tracking parameters, and classifies known ATS and custom careers URLs.
5. Click **Start Review** to open the first new or manual-review URL.
6. Wait for the page to load, then click **Scan Page**. ApplyOS never silently scans queued URLs.
7. Review the extracted job, fit score, and detected application fields.
8. Mark the queue item as saved, applied, skipped, not relevant, manual review, or open later.
9. Click **Next Job** to continue through the queue.

The queue supports:

- Messy pasted text, comma-separated URLs, JSON arrays, and terminal output
- Ashby, Greenhouse, Lever, Workable, Workday, SmartRecruiters, BambooHR, Recruitee, Teamtailor, iCIMS, custom careers, and unknown URL classification
- Current-tab, new-tab, or background-tab opening behavior in **Settings**
- Optional **Auto-scan after opening (prompt only)** reminder, which never scans silently
- Review Mode keyboard shortcuts: `N` next, `S` save, `K` skip, `A` applied, `R` rescan, and `O` open
- Filters by status and fit recommendation
- Sorting by imported order, fit score, platform, company, status, and date
- JSON and CSV export, JSON import, clear completed, and clear queue

The `tabs` permission is used only for user-triggered queue actions such as **Open**, **Start Review**, **Next Job**, and **Previous Job**, and to send scan messages to the active page. It is not used to read or import all open tabs.

## Privacy Model

ApplyOS is local-first by default:

- CV text is stored in IndexedDB on the local browser profile.
- The Experience Profile, User Profile, Answer Bank, tracked jobs, Job URL Queue, scan history, and settings are stored locally with Dexie.js.
- There is no backend.
- There is no telemetry.
- Pages are scanned only after the user clicks **Scan Page** or enables dynamic field watching.
- ApplyOS does not read your open tabs automatically. You paste URLs manually unless you enable a future optional tabs import feature.
- Queued URLs are opened one at a time only after a user action. They are not mass-opened or scanned in the background.
- ApplyOS never auto-submits an application.
- ApplyOS never clicks Apply or Submit.
- ApplyOS never programmatically uploads files.
- Sensitive and compliance fields are never inferred or included in bulk autofill.

Use **Settings → Export All** to create a local JSON backup. Use **Clear Local Data** to delete ApplyOS data from the current browser profile.

## OpenRouter Setup

OpenRouter is optional and disabled by default.

1. Open **Settings**.
2. Turn off **Local-only mode**.
3. Enter an OpenRouter API key.
4. Choose an OpenRouter model.
5. Enable only the features you want:
   - **Smart Match enabled**
   - **Auto-generate from Experience Profile**
   - **Allow raw CV for extraction**
6. Keep **Show data before sending** enabled to preview request data before each call.

OpenRouter is used only after a user-triggered action:

- **Parse Experience Profile** can send raw CV text only when raw CV extraction is explicitly allowed.
- **Improve Extraction** sends only the visible job description.
- **Smart Match** sends only the detected question and up to five local answer previews, never the full Answer Bank.
- **Suggest From Experience** sends the question, relevant structured Experience Profile snippets, and a small job summary.

Experience-backed suggestions are disabled when the job fit score is below the configured threshold. When no relevant documented experience is found, ApplyOS returns `NO_FIT` instead of inventing an answer.

## Architecture

```text
src/
  background/      Manifest V3 service worker
  content/         Page context, field detection, insertion, dynamic watching
  sidepanel/       React side panel and tabs
  db/              Dexie IndexedDB schema and import/export
  queue/           URL parsing, normalization, classification, and CSV export
  search/          Local search entry point
  ai/              Optional OpenRouter helpers
  adapters/        ATS, custom careers, and generic adapters
  matching/        Text normalization, Answer Bank matching, evidence selection
  parsers/         Local TXT/PDF/DOCX extraction and CV heuristics
  scoring/         Local job fit score
  shared/          TypeScript contracts and constants
```

## Limitations

- Job pages and ATS forms change frequently. Rescan after page changes and review every detected label.
- Some Workday and other ATS flows render application forms inside cross-origin iframes that Chrome content scripts cannot access from the parent page.
- PDF extraction quality depends on the PDF containing selectable text. Image-only or scanned PDFs need OCR outside ApplyOS.
- Local heuristic CV parsing is intentionally conservative and will not reconstruct complex resume layouts perfectly.
- Job fit scoring is a local keyword and seniority heuristic, not a hiring prediction.
- Dynamic field dependency detection is best-effort. ApplyOS never chooses an uncertain dropdown option.
- Browser-managed pages such as `chrome://` pages cannot be scanned.
- Job Queue rejects localhost URLs unless queue dev mode is enabled in Settings.
- The extension does not bypass validation, authentication, CAPTCHA, or site restrictions.

## Product Rules

ApplyOS is a filter first and an assistant second.

It must never generate fake companies, roles, projects, skills, tools, metrics, education, certifications, dates, or languages. Every suggestion should be reviewed by the user before insertion, and every application should be submitted manually.
